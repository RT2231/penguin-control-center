// core/cliRunner.js — コマンド実行と実行履歴の管理。
//
// 重要: execFileにはプログラム名+引数を「配列」で渡す。
// シェル文字列を組み立てないため、コマンドインジェクションの余地がない。
//
// 各実行記録にはpluginIdを付与し、CLIタブでプラグインごとに履歴を絞り込めるようにする
// (以前はアプリ全体の履歴が全プラグインのCLIタブに混ざって表示されていたため)。

const { execFile } = require('child_process');

const MAX_HISTORY = 200;
const history = [];

function run(cliArgs, { privileged = false, pluginId = null } = {}) {
  return new Promise((resolve) => {
    const program = privileged ? 'pkexec' : cliArgs[0];
    const args = privileged ? cliArgs : cliArgs.slice(1);

    const startedAt = Date.now();
    const displayCommand = privileged ? `pkexec ${cliArgs.join(' ')}` : cliArgs.join(' ');

    execFile(program, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startedAt;
      const record = {
        pluginId,
        command: displayCommand,
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : ''),
        durationMs,
        timestamp: new Date().toISOString(),
      };

      history.unshift(record);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

      resolve(record);
    });
  });
}

function getHistory(pluginId) {
  if (!pluginId) return history;
  return history.filter((h) => h.pluginId === pluginId);
}

module.exports = { run, getHistory };
