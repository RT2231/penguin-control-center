// main.js — Electronメインプロセス
// ウィンドウ生成とIPCハンドラの登録のみを担当する。
// OS操作の実処理はcore/配下のモジュールに委譲する（責務分離）。

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

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
  setupAutoUpdater();
  if (process.env.PCC_SMOKE_TEST) setupSmokeTest();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- スモークテスト(CI用) ----
// PCC_SMOKE_TEST=1 で起動すると、実際にレンダラーを描画した上で
// (1) preloadエラー/未捕捉例外が出ていないか (2) プラグイン一覧が実際に表示されているか
// を確認し、結果に応じたexit codeで終了する。
// `node --check`(構文)や`npm test`(ロジック単体)では検出できない「Electronとして
// 実際に起動できるか」を検証するための最終防衛ライン。
function setupSmokeTest() {
  const rendererErrors = [];

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (/Unable to load preload|Uncaught|No handler registered for/i.test(message)) {
      rendererErrors.push(message);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    rendererErrors.push(`renderer process gone: ${details.reason}`);
  });

  (async () => {
    await new Promise((r) => setTimeout(r, 2000)); // 初期描画・IPC往復待ち

    let pluginItemCount = -1;
    try {
      pluginItemCount = await mainWindow.webContents.executeJavaScript(
        "document.querySelectorAll('#plugin-list .plugin-item').length"
      );
    } catch (err) {
      rendererErrors.push(`executeJavaScript失敗: ${err.message}`);
    }

    console.log(`SMOKE_TEST pluginItemCount=${pluginItemCount} errorCount=${rendererErrors.length}`);
    for (const err of rendererErrors) console.log('SMOKE_TEST_ERROR:', err);

    const ok = rendererErrors.length === 0 && pluginItemCount > 0;
    console.log(ok ? 'SMOKE_TEST_RESULT=PASS' : 'SMOKE_TEST_RESULT=FAIL');

    app.exit(ok ? 0 : 1);
  })();
}

// ---- 自動アップデート ----
// GitHub Releasesを更新元として使用する(package.jsonのbuild.publish設定)。
// Linuxではdeb形式の自動更新はサポートされていないため、AppImageとして
// 実行されている場合のみチェックする(それ以外は静かにスキップ)。
function setupAutoUpdater() {
  if (!app.isPackaged) return; // 開発中(npm start)はチェックしない
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    console.log('AppImage以外(.deb等)での実行のため、自動アップデートはスキップします。');
    return;
  }

  autoUpdater.autoDownload = false; // ユーザーの同意なしに勝手にダウンロードしない

  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['あとで', 'ダウンロードする'],
      defaultId: 1,
      cancelId: 0,
      title: 'アップデートが利用可能です',
      message: `新しいバージョン ${info.version} が利用可能です。ダウンロードしますか？`,
    });
    if (response === 1) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['あとで再起動', '今すぐ再起動してインストール'],
      defaultId: 1,
      cancelId: 0,
      title: 'アップデートの準備ができました',
      message: 'ダウンロードが完了しました。再起動してインストールしますか？',
    });
    if (response === 1) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('自動アップデート確認中にエラー:', err.message);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('アップデート確認に失敗しました:', err.message);
  });
}

// ---- IPCハンドラ ----
// レンダラーからのすべての要求はここを経由する。
// 「宣言されたプラグイン・アクションのみ実行可能」という制約をここで担保する。

ipcMain.handle('pcc:listPlugins', async () => {
  return pluginLoader.listPlugins();
});

// ---- パラメータ付きアクション ----
// 検証・置換ロジックはcore/paramSubstitution.jsに切り出し、単体テスト可能にしている。
const { buildCliWithParams } = require('./core/paramSubstitution');

ipcMain.handle('pcc:runAction', async (event, pluginId, actionId, paramValues) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin) throw new Error(`不明なプラグインです: ${pluginId}`);

  const action = plugin.manifest.actions.find((a) => a.id === actionId);
  if (!action) throw new Error(`不明なアクションです: ${actionId}`);

  // パラメータの検証・置換はここで行う(不正な値は例外としてrejectされ、実行に進まない)
  const resolvedCli = buildCliWithParams(action, paramValues);

  // 競合チェック: サービスを起動する系のアクションで、宣言的に競合するプラグインが
  // 現在稼働中の場合は警告する(例: Apache稼働中にNginxを起動するとポートが競合する等)
  if (['start', 'enable', 'restart'].includes(action.id) && Array.isArray(plugin.manifest.conflictsWith)) {
    for (const conflictId of plugin.manifest.conflictsWith) {
      const conflictPlugin = pluginLoader.getPlugin(conflictId);
      const conflictUnit = conflictPlugin?.manifest?.service?.systemdUnit;
      if (!conflictUnit) continue;

      const statusResult = await cliRunner.run(['systemctl', 'is-active', conflictUnit], {
        privileged: false,
        pluginId: conflictId,
      });
      if ((statusResult.stdout || '').trim() === 'active') {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['キャンセル', '続行する'],
          defaultId: 0,
          cancelId: 0,
          title: 'プラグインの競合の可能性',
          message: `「${conflictPlugin.manifest.name}」が現在稼働中です`,
          detail:
            `「${plugin.manifest.name}」と「${conflictPlugin.manifest.name}」は同時に稼働すると` +
            `ポート等が競合する可能性があります。続行しますか？`,
        });
        if (response !== 1) return { cancelled: true };
      }
    }
  }

  // 特権操作は実行前にネイティブ確認ダイアログを出す(置換後の実コマンドを表示)
  if (action.privileged) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['キャンセル', '実行する'],
      defaultId: 0,
      cancelId: 0,
      title: '管理者権限が必要な操作です',
      message: `「${action.label}」を実行しますか？`,
      detail: `実行コマンド: ${resolvedCli.join(' ')}\n\nOSの認証ダイアログが表示される場合があります。`,
    });
    if (response !== 1) {
      return { cancelled: true };
    }
  }

  return cliRunner.run(resolvedCli, { privileged: !!action.privileged, pluginId });
});

ipcMain.handle('pcc:getCliHistory', async (event, pluginId) => {
  return cliRunner.getHistory(pluginId);
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

ipcMain.handle('pcc:listConfigBackups', async (event, pluginId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.configPath) {
    throw new Error('このプラグインには設定ファイルが定義されていません');
  }
  return configManager.listBackups(plugin.manifest.service.configPath);
});

ipcMain.handle('pcc:restoreConfigBackup', async (event, pluginId, backupPath) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.configPath) {
    throw new Error('このプラグインには設定ファイルが定義されていません');
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['キャンセル', '復元する'],
    defaultId: 0,
    cancelId: 0,
    title: '設定ファイルの復元',
    message: 'このバックアップの内容で設定ファイルを上書きしますか？',
    detail: `復元先: ${plugin.manifest.service.configPath}\n現在の内容は復元前に自動でバックアップされます。`,
  });
  if (response !== 1) return { cancelled: true };

  configManager.restoreBackup(plugin.manifest.service.configPath, backupPath);
  return { cancelled: false, content: configManager.readConfig(plugin.manifest.service.configPath) };
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

ipcMain.handle('pcc:getServiceStatus', async (event, pluginId) => {
  const plugin = pluginLoader.getPlugin(pluginId);
  if (!plugin || !plugin.manifest.service || !plugin.manifest.service.systemdUnit) {
    return { status: 'unknown' };
  }
  // systemctl is-active は非特権で実行可能な読み取り専用コマンド。
  // サイドバーの状態ドット表示専用の軽量チェック(CLIタブの履歴にも記録される=透明性を維持)。
  const result = await cliRunner.run(['systemctl', 'is-active', plugin.manifest.service.systemdUnit], {
    privileged: false,
    pluginId,
  });
  const status = (result.stdout || '').trim() || 'unknown';
  return { status };
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
