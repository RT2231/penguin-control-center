const { test } = require('node:test');
const assert = require('node:assert/strict');
const pluginLoader = require('../core/pluginLoader');

test('listPlugins: リポジトリ内の全プラグインを読み込める', () => {
  const plugins = pluginLoader.listPlugins();
  assert.ok(plugins.length >= 11, `プラグイン数が想定より少ない: ${plugins.length}`);

  const ids = plugins.map((p) => p.id);
  for (const expected of ['chrony', 'openssh', 'docker', 'apache2', 'nginx', 'ufw', 'fail2ban']) {
    assert.ok(ids.includes(expected), `${expected} が読み込まれていない`);
  }
});

test('listPlugins: 各プラグインが必須フィールドを持つ', () => {
  const plugins = pluginLoader.listPlugins();
  for (const p of plugins) {
    assert.ok(p.id, 'idが空');
    assert.ok(p.name, `${p.id}: nameが空`);
    assert.ok(Array.isArray(p.actions) && p.actions.length > 0, `${p.id}: actionsが空`);
    for (const action of p.actions) {
      assert.ok(Array.isArray(action.cli) && action.cli.length > 0, `${p.id}/${action.id}: cliが配列でない`);
    }
  }
});

test('validateManifest: 必須フィールド欠如を検出する', () => {
  assert.throws(() => pluginLoader.validateManifest({}), /必須フィールド/);
  assert.throws(
    () => pluginLoader.validateManifest({ id: 'x', name: 'X', actions: [{}] }),
    /アクション定義が不正/
  );
});

test('validateManifest: 正常なマニフェストはエラーにならない', () => {
  assert.doesNotThrow(() =>
    pluginLoader.validateManifest({
      id: 'x',
      name: 'X',
      actions: [{ id: 'status', label: '状態確認', cli: ['echo', 'ok'] }],
    })
  );
});

test('getPlugin: 存在しないIDはnullを返す(例外にしない)', () => {
  assert.equal(pluginLoader.getPlugin('__does_not_exist__'), null);
});

test('uninstall: 存在しないプラグインIDは例外を投げる(実削除はしない)', () => {
  assert.throws(() => pluginLoader.uninstall('__does_not_exist__'), /不明なプラグインです/);
});
