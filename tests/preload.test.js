const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// preload.jsはBrowserWindowでsandbox:trueが指定されているため、
// Electronのサンドボックス化されたpreload環境で実行される。
// この環境ではrequire()でローカルの自作モジュール(相対パス)を読み込めない
// (許可されるのはElectron/Node組み込みモジュールの一部のみ)。
// 過去に実際にこの制約を見落として`require('./core/diffLines')`を書いてしまい、
// アプリ全体が起動不能になる障害を起こしたため、再発防止として静的にチェックする。

test('preload.js はローカルの自作モジュールをrequireしていない', () => {
  const preloadPath = path.join(__dirname, '..', 'preload.js');
  const source = fs.readFileSync(preloadPath, 'utf-8');

  const relativeRequirePattern = /require\(\s*['"]\.\.?\//g;
  const matches = source.match(relativeRequirePattern);

  assert.equal(
    matches,
    null,
    `preload.jsが相対パスでローカルモジュールをrequireしています(sandbox:true環境では動作しません): ${matches}`
  );
});
