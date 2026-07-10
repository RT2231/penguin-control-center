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

function listBackups(configPath) {
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  if (!fs.existsSync(dir)) return [];

  const prefix = `${base}.bak.`;
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      return { path: fullPath, name, savedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)); // 新しい順
}

function restoreBackup(configPath, backupPath) {
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  const prefix = `${base}.bak.`;

  // 安全対策: 復元元は必ず「同じ設定ファイルの、同じディレクトリ内にあるバックアップ」に限定する
  // (任意パスの読み取り/上書きを防ぐ)
  const resolvedBackup = path.resolve(backupPath);
  const resolvedDir = path.resolve(dir);
  if (
    path.dirname(resolvedBackup) !== resolvedDir ||
    !path.basename(resolvedBackup).startsWith(prefix)
  ) {
    throw new Error('不正なバックアップファイルのため復元を中止しました');
  }
  if (!fs.existsSync(resolvedBackup)) {
    throw new Error('指定されたバックアップが見つかりません');
  }

  // 復元前の状態も念のためバックアップしておく(Undoに対するUndoを可能にする)
  const currentBackup = writeConfig(configPath, fs.readFileSync(resolvedBackup, 'utf-8'));
  return currentBackup;
}

module.exports = { readConfig, writeConfig, listBackups, restoreBackup };
