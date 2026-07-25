// preload.js — レンダラーに公開する唯一の窓口。
// ここに列挙したAPI以外、レンダラーはメインプロセス/OSに一切触れられない。
//
// 注意: BrowserWindowにsandbox:trueを指定しているため、このpreloadスクリプトは
// Electronのサンドボックス化されたpreload環境で動作する。この環境では
// require()でローカルの自作モジュール(相対パス)を読み込むことができない
// (許可されるのはElectron/Node組み込みモジュールの一部のみ)。
// そのため diffLines は core/diffLines.js と同じ実装をここに直接持つ
// (core/diffLines.js側は単体テストの対象として引き続き利用する)。

const { contextBridge, ipcRenderer } = require('electron');

function diffLines(oldText, newText) {
  const a = String(oldText).split('\n');
  const b = String(newText).split('\n');
  const m = a.length;
  const n = b.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'ctx', text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', text: a[i] });
      i++;
    } else {
      result.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) { result.push({ type: 'del', text: a[i] }); i++; }
  while (j < n) { result.push({ type: 'add', text: b[j] }); j++; }
  return result;
}

contextBridge.exposeInMainWorld('pcc', {
  listPlugins: () => ipcRenderer.invoke('pcc:listPlugins'),
  runAction: (pluginId, actionId, paramValues) => ipcRenderer.invoke('pcc:runAction', pluginId, actionId, paramValues),
  getCliHistory: (pluginId) => ipcRenderer.invoke('pcc:getCliHistory', pluginId),
  readConfig: (pluginId) => ipcRenderer.invoke('pcc:readConfig', pluginId),
  writeConfig: (pluginId, content) => ipcRenderer.invoke('pcc:writeConfig', pluginId, content),
  listConfigBackups: (pluginId) => ipcRenderer.invoke('pcc:listConfigBackups', pluginId),
  restoreConfigBackup: (pluginId, backupPath) => ipcRenderer.invoke('pcc:restoreConfigBackup', pluginId, backupPath),
  readLog: (pluginId, lines) => ipcRenderer.invoke('pcc:readLog', pluginId, lines),
  readDocs: (pluginId) => ipcRenderer.invoke('pcc:readDocs', pluginId),
  getServiceStatus: (pluginId) => ipcRenderer.invoke('pcc:getServiceStatus', pluginId),
  listStorePlugins: () => ipcRenderer.invoke('pcc:listStorePlugins'),
  installStorePlugin: (pluginId) => ipcRenderer.invoke('pcc:installStorePlugin', pluginId),
  uninstallPlugin: (pluginId) => ipcRenderer.invoke('pcc:uninstallPlugin', pluginId),
  diffLines: (oldText, newText) => diffLines(oldText, newText),
});
