// main.js — Electronメインプロセス
// ウィンドウ生成とIPCハンドラの登録のみを担当する。
// OS操作の実処理はcore/配下のモジュールに委譲する（責務分離）。

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

const pluginLoader = require('./core/pluginLoader');
const cliRunner = require('./core/cliRunner');
const configManager = require('./core/configManager');
const logReader = require('./core/logReader');
const storeClient = require('./core/storeClient');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#1b1f23',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // レンダラーとNode環境を分離（必須）
      nodeIntegration: false, // レンダラーからNode APIへの直接アクセスを禁止
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 多層防御: 悪意あるプラグインdocs.md等からのリンクでも、
  // 新規ウィンドウは常に拒否し、http/https/mailtoのみ既定ブラウザで開く。
  // レンダラー内でのアプリ外URLへのナビゲーションも禁止する。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPCハンドラ ----
// レンダラーからのすべての要求はここを経由する。
// 「宣言されたプラグイン・アクションのみ実行可能」という制約をここで担保する。

ipcMain.handle('pcc:listPlugins', async () => {
  return pluginLoader.listPlugins();
});

ipcMain.handle('pcc:runAction', async (event, pluginId, actionId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin) throw new Error(`不明なプラグインです: ${pluginId}`);

  const action = plugin.manifest.actions.find((a) => a.id === actionId);
  if (!action) throw new Error(`不明なアクションです: ${actionId}`);

  // 特権操作は実行前にネイティブ確認ダイアログを出す
  if (action.privileged) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['キャンセル', '実行する'],
      defaultId: 0,
      cancelId: 0,
      title: '管理者権限が必要な操作です',
      message: `「${action.label}」を実行しますか？`,
      detail: `実行コマンド: ${action.cli.join(' ')}\n\nOSの認証ダイアログが表示される場合があります。`,
    });
    if (response !== 1) {
      return { cancelled: true };
    }
  }

  return cliRunner.run(action.cli, { privileged: !!action.privileged });
});

ipcMain.handle('pcc:getCliHistory', async () => {
  return cliRunner.getHistory();
});

ipcMain.handle('pcc:readConfig', async (event, pluginId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.configPath) {
    throw new Error('このプラグインには設定ファイルが定義されていません');
  }
  return configManager.readConfig(plugin.manifest.service.configPath);
});

ipcMain.handle('pcc:writeConfig', async (event, pluginId, content) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.configPath) {
    throw new Error('このプラグインには設定ファイルが定義されていません');
  }
  return configManager.writeConfig(plugin.manifest.service.configPath, content);
});

ipcMain.handle('pcc:readLog', async (event, pluginId, lines) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.systemdUnit) {
    throw new Error('このプラグインにはsystemdユニットが定義されていません');
  }
  return logReader.readServiceLog(plugin.manifest.service.systemdUnit, lines || 200);
});

ipcMain.handle('pcc:readDocs', async (event, pluginId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin) throw new Error(`不明なプラグインです: ${pluginId}`);
  return pluginLoader.readDocs(plugin);
});

// ---- ストア(プラグインの取得・インストール) ----

ipcMain.handle('pcc:listStorePlugins', async () => {
  const catalog = await storeClient.fetchCatalog();
  const installed = pluginLoader.listPlugins();

  return catalog.map((entry) => {
    const local = installed.find((p) => p.id === entry.id);
    return {
      ...entry,
      installed: !!local,
      installedVersion: local ? local.version : null,
      updateAvailable: !!local && local.version !== entry.version,
    };
  });
});

ipcMain.handle('pcc:installStorePlugin', async (event, pluginId) => {
  const catalog = await storeClient.fetchCatalog();
  const entry = catalog.find((e) => e.id === pluginId);
  if (!entry) throw new Error(`ストアにプラグインが見つかりません: ${pluginId}`);

  await storeClient.installPlugin(entry);
  return pluginLoader.reload();
});

ipcMain.handle('pcc:uninstallPlugin', async (event, pluginId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin) throw new Error(`不明なプラグインです: ${pluginId}`);

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['キャンセル', 'アンインストールする'],
    defaultId: 0,
    cancelId: 0,
    title: 'プラグインのアンインストール',
    message: `「${plugin.manifest.name}」をアンインストールしますか？`,
    detail:
      `plugins/${pluginId}/ 以下のファイルが削除されます。この操作は取り消せません。\n\n` +
      `※ 管理対象ソフトウェア自体（実際のchronyやDockerなど）はアンインストールされません。` +
      `PCC上の管理用プラグインのみが削除されます。`,
  });
  if (response !== 1) return { cancelled: true };

  const plugins = pluginLoader.uninstall(pluginId);
  return { cancelled: false, plugins };
});
