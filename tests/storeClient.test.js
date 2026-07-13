const { test } = require('node:test');
const assert = require('node:assert/strict');
const storeClient = require('../core/storeClient');

// ネットワークアクセスが必要なダウンロード成功系はここでは検証しない(CI環境依存のため)。
// ダウンロードを試みる前段の入力検証ロジック(パストラバーサル対策・オリジン検証)のみを
// 単体テストする。これらは検証に失敗した場合、実際のネットワークアクセス前に例外を投げる設計。

test('installPlugin: id/downloadが欠けたエントリは拒否する', async () => {
  await assert.rejects(() => storeClient.installPlugin({}), /カタログ情報が不正/);
  await assert.rejects(() => storeClient.installPlugin({ id: 'x' }), /カタログ情報が不正/);
});

test('installPlugin: パストラバーサルを含むIDは拒否する', async () => {
  await assert.rejects(
    () => storeClient.installPlugin({ id: '../../etc', download: 'downloads/x.zip' }),
    /不正なプラグインID/
  );
});

test('installPlugin: 記号を含む不正なIDは拒否する', async () => {
  await assert.rejects(
    () => storeClient.installPlugin({ id: 'foo/bar', download: 'downloads/x.zip' }),
    /不正なプラグインID/
  );
});

test('installPlugin: ストアと異なるオリジンからのダウンロードは拒否する', async () => {
  await assert.rejects(
    () =>
      storeClient.installPlugin(
        { id: 'chrony', download: 'https://evil.example.com/malicious.zip' },
        'https://rt2231.github.io/penguin-control-center/'
      ),
    /異なるオリジン/
  );
});

test('installPlugin: 正常な相対パスのdownloadはオリジン検証を通過する(この先のネットワーク処理は検証しない)', async () => {
  // オリジン検証自体は通過するはずなので、エラーが出るとしても
  // 「オリジン」に関するものではないことだけを確認する(実ネットワークには依存しない形で)。
  try {
    await storeClient.installPlugin(
      { id: 'chrony', download: 'downloads/chrony-plugin.zip' },
      'https://rt2231.github.io/penguin-control-center/'
    );
  } catch (err) {
    assert.doesNotMatch(err.message, /異なるオリジン/);
    assert.doesNotMatch(err.message, /不正なプラグインID/);
  }
});
