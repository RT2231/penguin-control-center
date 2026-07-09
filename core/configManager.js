// core/configManager.js — 設定ファイルの読み書きと自動バックアップ。

const fs = require('fs');
const path = require('path');

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { exists: false, path: configPath, content: '' };
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  const stat = fs.statSync(configPath);
  return {
    exists: true,
    path: configPath,
    content,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function writeConfig(configPath, newContent) {
  let backupPath = null;

  if (fs.existsSync(configPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${configPath}.bak.${timestamp}`;
    fs.copyFileSync(configPath, backupPath);
  } else {
    // 設定ファイルが存在しない場合、親ディレクトリを作成してから書き込む
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }

  fs.writeFileSync(configPath, newContent, 'utf-8');

  return { path: configPath, backupPath, savedAt: new Date().toISOString() };
}

module.exports = { readConfig, writeConfig };
