// core/pluginLoader.js — plugins/配下をスキャンし、マニフェストを読み込む。

const fs = require('fs');
const path = require('path');
const { getPluginsDir } = require('./pluginsPath');

let cache = null; // { [pluginId]: { manifest, dir, handler } }

function loadAll() {
  const pluginsDir = getPluginsDir();
  const result = {};
  if (!fs.existsSync(pluginsDir)) return result;

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(pluginsDir, entry.name);
    const manifestPath = path.join(dir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      validateManifest(manifest);

      let handler = null;
      const handlerPath = path.join(dir, 'handler.js');
      if (fs.existsSync(handlerPath)) {
        handler = require(handlerPath);
      }

      result[manifest.id] = { manifest, dir, handler };
    } catch (err) {
      console.error(`プラグイン読み込み失敗: ${entry.name}`, err);
    }
  }
  return result;
}

function validateManifest(manifest) {
  if (!manifest.id || !manifest.name || !Array.isArray(manifest.actions)) {
    throw new Error('マニフェストの必須フィールド(id, name, actions)が不足しています');
  }
  for (const action of manifest.actions) {
    if (!action.id || !action.label || !Array.isArray(action.cli) || action.cli.length === 0) {
      throw new Error(`アクション定義が不正です: ${JSON.stringify(action)}`);
    }
  }
}

function listPlugins() {
  if (!cache) cache = loadAll();
  return Object.values(cache).map((p) => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    description: p.manifest.description,
    actions: p.manifest.actions,
    hasConfig: !!(p.manifest.service && p.manifest.service.configPath),
    hasLog: !!(p.manifest.service && p.manifest.service.systemdUnit),
  }));
}

function getPlugin(pluginId) {
  if (!cache) cache = loadAll();
  return cache[pluginId] || null;
}

function readDocs(plugin) {
  if (!plugin.manifest.docs) return '# ドキュメントは未登録です';
  const docsPath = path.join(plugin.dir, plugin.manifest.docs);
  if (!fs.existsSync(docsPath)) return '# ドキュメントファイルが見つかりません';
  return fs.readFileSync(docsPath, 'utf-8');
}

function uninstall(pluginId) {
  const plugin = getPlugin(pluginId);
  if (!plugin) throw new Error(`不明なプラグインです: ${pluginId}`);

  // 安全対策: 削除対象が必ずplugins/配下に収まっていることを確認してから削除する
  const pluginsDir = getPluginsDir();
  const resolvedDir = path.resolve(plugin.dir);
  const resolvedRoot = path.resolve(pluginsDir);
  if (resolvedDir !== path.join(resolvedRoot, pluginId) || !resolvedDir.startsWith(resolvedRoot + path.sep)) {
    throw new Error('不正なプラグインパスのため削除を中止しました');
  }

  fs.rmSync(resolvedDir, { recursive: true, force: true });
  return reload();
}

function reload() {
  cache = loadAll();
  return listPlugins();
}

function validateManifestForTest(manifest) {
  // テスト用に検証ロジックだけを外部から呼べるようにするエクスポート
  validateManifest(manifest);
}

module.exports = { listPlugins, getPlugin, readDocs, reload, uninstall, validateManifest: validateManifestForTest };
