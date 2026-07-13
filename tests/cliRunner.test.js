const { test } = require('node:test');
const assert = require('node:assert/strict');
const cliRunner = require('../core/cliRunner');

test('run: 標準出力を正しく取得できる', async () => {
  const result = await cliRunner.run(['echo', 'hello-pcc-test'], { privileged: false });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /hello-pcc-test/);
  assert.equal(result.command, 'echo hello-pcc-test');
});

test('run: 終了コードが非0の場合も例外を投げずexitCodeで返す', async () => {
  const result = await cliRunner.run(['node', '-e', 'process.exit(3)'], { privileged: false });
  assert.equal(result.exitCode, 3);
});

test('run: privileged:trueの場合pkexecが前置される(表示コマンドのみ検証)', async () => {
  // 実際にpkexecを実行すると認証UIが必要になるため、
  // ここではcliRunnerが組み立てるコマンド表示(displayCommand)のみを検証する。
  // pkexec自体が存在しない/失敗する環境でもテストが通るよう、結果の成否は問わない。
  const result = await cliRunner.run(['systemctl', 'status', 'dummy.service'], { privileged: true });
  assert.equal(result.command, 'pkexec systemctl status dummy.service');
});

test('run: 実行履歴に記録される', async () => {
  await cliRunner.run(['echo', 'history-check'], { privileged: false });
  const history = cliRunner.getHistory();
  assert.ok(history.length > 0);
  assert.equal(history[0].command, 'echo history-check');
});
