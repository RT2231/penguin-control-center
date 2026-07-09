// core/logReader.js — journalctlによるサービスログの取得。

const { execFile } = require('child_process');

function readServiceLog(systemdUnit, lines = 200) {
  return new Promise((resolve) => {
    execFile(
      'journalctl',
      ['-u', systemdUnit, '-n', String(lines), '--no-pager', '--output=short-iso'],
      { timeout: 10_000 },
      (error, stdout, stderr) => {
        resolve({
          unit: systemdUnit,
          ok: !error,
          log: stdout || '',
          error: error ? (stderr || error.message) : null,
        });
      }
    );
  });
}

module.exports = { readServiceLog };
