// core/storeClient.js — 公式プラグインストアからのカタログ取得・ダウンロード・展開。
//
// 依存パッケージなし（Node標準の https/fs/path + システムの unzip コマンドのみ使用）。
// zip展開前に「絶対パス」「..を含むパス」を含むエントリがないか検証する(zip slip対策)。

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEFAULT_STORE_BASE_URL = 'https://rt2231.github.io/penguin-control-center/';
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`カタログのJSON解析に失敗しました: ${err.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          downloadFile(new URL(res.headers.location, url).toString(), destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

async function fetchCatalog(baseUrl = DEFAULT_STORE_BASE_URL) {
  const catalog = await fetchJson(new URL('catalog.json', baseUrl).toString());
  if (!Array.isArray(catalog)) throw new Error('カタログの形式が不正です');
  return catalog;
}

function assertSafeZipEntries(zipPath) {
  let listing;
  try {
    listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf-8' });
  } catch (err) {
    throw new Error(`zipの検証に失敗しました（unzipコマンドが必要です）: ${err.message}`);
  }
  const entries = listing.split('\n').filter(Boolean);
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.split('/').includes('..')) {
      throw new Error(`安全でないzip構成のため展開を中止しました: ${entry}`);
    }
  }
}

async function installPlugin(entry, baseUrl = DEFAULT_STORE_BASE_URL) {
  if (!entry || !entry.id || !entry.download) {
    throw new Error('プラグインのカタログ情報が不正です');
  }

  const zipUrl = new URL(entry.download, baseUrl).toString();
  const tmpZip = path.join(os.tmpdir(), `pcc-plugin-${entry.id}-${Date.now()}.zip`);

  await downloadFile(zipUrl, tmpZip);

  try {
    assertSafeZipEntries(tmpZip);

    const destDir = path.join(PLUGINS_DIR, entry.id);
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync('unzip', ['-o', tmpZip, '-d', destDir]);

    const manifestPath = path.join(destDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('展開結果にplugin.jsonが見つかりません。パッケージが壊れている可能性があります。');
    }

    return { installedTo: destDir };
  } finally {
    fs.unlink(tmpZip, () => {});
  }
}

module.exports = { fetchCatalog, installPlugin, DEFAULT_STORE_BASE_URL };
