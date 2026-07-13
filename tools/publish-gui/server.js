// tools/publish-gui/server.js
//
// メンテナ専用のローカルツール。
// plugins/配下のプラグインを docs/downloads/*.zip として書き出し、
// docs/catalog.json（プラグインストアのカタログ）を更新する。
// 一般ユーザーに配布するアプリ本体(main.js等)とは独立している。
//
// 依存パッケージなし（Node標準ライブラリ + システムの`zip`コマンドのみ使用）。
//
// 起動: node tools/publish-gui/server.js
// ブラウザ: http://localhost:5178

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..'); // リポジトリルート
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const DOWNLOADS_DIR = path.join(ROOT, 'docs', 'downloads');
const PLUGIN_DOCS_DIR = path.join(ROOT, 'docs', 'plugin-docs');
const CATALOG_PATH = path.join(ROOT, 'docs', 'catalog.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 5178;

function readCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeCatalog(catalog) {
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
}

function listPluginDirs() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function getPlugins() {
  const catalog = readCatalog();
  const ids = listPluginDirs();
  const result = [];

  for (const id of ids) {
    const manifestPath = path.join(PLUGINS_DIR, id, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (err) {
      result.push({ id, error: `plugin.jsonの読み込みに失敗: ${err.message}` });
      continue;
    }

    const validation = validateManifest(manifest);
    const existing = catalog.find((c) => c.id === id) || {};
    const zipPath = path.join(DOWNLOADS_DIR, `${id}-plugin.zip`);
    const hasHandler = fs.existsSync(path.join(PLUGINS_DIR, id, 'handler.js'));

    result.push({
      id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      published: !!catalog.find((c) => c.id === id),
      publishedVersion: existing.version || null,
      zipExists: fs.existsSync(zipPath),
      valid: validation.ok,
      validationError: validation.ok ? null : validation.error,
      author: existing.author || 'PCC公式',
      tags: existing.tags || [],
      requires: existing.requires || [],
      hasHandler,
    });
  }
  return result;
}

function validateManifest(manifest) {
  if (!manifest.id || !manifest.name || !Array.isArray(manifest.actions) || manifest.actions.length === 0) {
    return { ok: false, error: '必須フィールド(id, name, actions)が不足しています' };
  }
  for (const action of manifest.actions) {
    if (!action.id || !action.label || !Array.isArray(action.cli) || action.cli.length === 0) {
      return { ok: false, error: `不正なアクション定義: ${JSON.stringify(action)}` };
    }
  }
  return { ok: true };
}

function publishPlugin(id, { author, tags, requires }) {
  const pluginDir = path.join(PLUGINS_DIR, id);
  const manifestPath = path.join(pluginDir, 'plugin.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`プラグインが見つかりません: ${id}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const validation = validateManifest(manifest);
  if (!validation.ok) throw new Error(`plugin.jsonが不正です: ${validation.error}`);

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const zipName = `${id}-plugin.zip`;
  const zipPath = path.join(DOWNLOADS_DIR, zipName);

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // zip -r の追記を避けるため作り直す

  // システムのzipコマンドを使用（プラグインディレクトリ内から相対パスで固める）
  execFileSync('zip', ['-r', zipPath, '.', '-x', '*.DS_Store'], { cwd: pluginDir });

  // docs.md をストアサイト(GitHub Pages)からも閲覧できるようコピーする
  let docsRelPath = null;
  if (manifest.docs) {
    const srcDocsPath = path.join(pluginDir, manifest.docs);
    if (fs.existsSync(srcDocsPath)) {
      fs.mkdirSync(PLUGIN_DOCS_DIR, { recursive: true });
      const docsFileName = `${id}.md`;
      fs.copyFileSync(srcDocsPath, path.join(PLUGIN_DOCS_DIR, docsFileName));
      docsRelPath = `plugin-docs/${docsFileName}`;
    }
  }

  const catalog = readCatalog();
  const hasHandler = fs.existsSync(path.join(pluginDir, 'handler.js'));
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  const entry = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: author || 'PCC公式',
    download: `downloads/${zipName}`,
    docs: docsRelPath,
    sha256,
    requires: requires || [],
    tags: tags || [],
    hasCode: hasHandler,
  };

  const idx = catalog.findIndex((c) => c.id === id);
  if (idx >= 0) catalog[idx] = entry;
  else catalog.push(entry);

  writeCatalog(catalog);

  return { zipPath: path.relative(ROOT, zipPath), catalogPath: path.relative(ROOT, CATALOG_PATH) };
}

// ---- 超簡易HTTPサーバー ----

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/plugins' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getPlugins()));
    return;
  }

  if (req.url === '/api/publish' && req.method === 'POST') {
    try {
      const body = await readBody(req);

      // idは実在するplugins/配下のディレクトリ名と完全一致するものだけ許可
      // (リクエストのidをそのままパス結合しない = パストラバーサル対策)
      const validIds = listPluginDirs();
      if (typeof body.id !== 'string' || !validIds.includes(body.id)) {
        throw new Error(`不正なプラグインIDです: ${body.id}`);
      }

      const result = publishPlugin(body.id, {
        author: body.author,
        tags: (body.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
        requires: (body.requires || '').split(',').map((s) => s.trim()).filter(Boolean),
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, ...result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  serveStatic(req, res);
});

// メンテナ専用ツールのため、ローカルホストからのみ待ち受ける
// (ホスト未指定だと全ネットワークインターフェースで待受してしまうため明示)
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Publish GUI: http://localhost:${PORT}`);
});
