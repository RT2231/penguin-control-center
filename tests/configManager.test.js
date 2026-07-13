const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const configManager = require('../core/configManager');

function makeTempConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-config-test-'));
  return path.join(dir, 'test.conf');
}

test('readConfig: 存在しないファイルはexists:falseを返す', () => {
  const p = makeTempConfigPath();
  const result = configManager.readConfig(p);
  assert.equal(result.exists, false);
  assert.equal(result.content, '');
});

test('writeConfig: 新規作成時はバックアップを作らない', () => {
  const p = makeTempConfigPath();
  const result = configManager.writeConfig(p, 'version=1\n');
  assert.equal(result.backupPath, null);
  assert.equal(fs.readFileSync(p, 'utf-8'), 'version=1\n');
});

test('writeConfig: 既存ファイルへの書き込みは自動バックアップを作る', () => {
  const p = makeTempConfigPath();
  configManager.writeConfig(p, 'version=1\n');
  const result = configManager.writeConfig(p, 'version=2\n');

  assert.ok(result.backupPath);
  assert.ok(fs.existsSync(result.backupPath));
  assert.equal(fs.readFileSync(result.backupPath, 'utf-8'), 'version=1\n');
  assert.equal(fs.readFileSync(p, 'utf-8'), 'version=2\n');
});

test('listBackups: 新しい順に並ぶ', async () => {
  const p = makeTempConfigPath();
  configManager.writeConfig(p, 'v1\n');
  await new Promise((r) => setTimeout(r, 5));
  configManager.writeConfig(p, 'v2\n');
  await new Promise((r) => setTimeout(r, 5));
  configManager.writeConfig(p, 'v3\n');

  const backups = configManager.listBackups(p);
  assert.equal(backups.length, 2); // v1→v2, v2→v3 の2回分
  assert.ok(backups[0].savedAt >= backups[1].savedAt);
});

test('restoreBackup: 正しいバックアップから復元できる', () => {
  const p = makeTempConfigPath();
  configManager.writeConfig(p, 'v1\n');
  const r2 = configManager.writeConfig(p, 'v2\n');

  configManager.restoreBackup(p, r2.backupPath);
  assert.equal(fs.readFileSync(p, 'utf-8'), 'v1\n');
});

test('restoreBackup: 無関係なファイルパスは拒否する(パストラバーサル対策)', () => {
  const p = makeTempConfigPath();
  configManager.writeConfig(p, 'v1\n');

  const outsideFile = makeTempConfigPath(); // 別ディレクトリの無関係なファイル
  fs.writeFileSync(outsideFile, 'secret');

  assert.throws(() => configManager.restoreBackup(p, outsideFile), /不正なバックアップファイル/);
  assert.throws(() => configManager.restoreBackup(p, '/etc/passwd'), /不正なバックアップファイル/);
});
