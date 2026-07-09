// preload.js — レンダラーに公開する唯一の窓口。
// ここに列挙したAPI以外、レンダラーはメインプロセス/OSに一切触れられない。

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcc', {
  listPlugins: () => ipcRenderer.invoke('pcc:listPlugins'),
  runAction: (pluginId, actionId) => ipcRenderer.invoke('pcc:runAction', pluginId, actionId),
  getCliHistory: () => ipcRenderer.invoke('pcc:getCliHistory'),
  readConfig: (pluginId) => ipcRenderer.invoke('pcc:readConfig', pluginId),
  writeConfig: (pluginId, content) => ipcRenderer.invoke('pcc:writeConfig', pluginId, content),
  readLog: (pluginId, lines) => ipcRenderer.invoke('pcc:readLog', pluginId, lines),
  readDocs: (pluginId) => ipcRenderer.invoke('pcc:readDocs', pluginId),
});
