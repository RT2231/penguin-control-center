const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCliWithParams } = require('../core/paramSubstitution');

const domainParam = {
  id: 'domain',
  label: 'ドメイン名',
  required: true,
  pattern: '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$',
};

const emailParam = {
  id: 'email',
  label: 'メールアドレス',
  required: true,
  pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
};

function makeAction(params) {
  return {
    id: 'obtain',
    label: '証明書を発行',
    cli: ['certbot', 'certonly', '-d', '{{domain}}', '-m', '{{email}}', '--agree-tos'],
    params,
  };
}

test('buildCliWithParams: paramsがなければcliをそのまま返す', () => {
  const action = { cli: ['systemctl', 'status', 'chrony.service'] };
  const result = buildCliWithParams(action, {});
  assert.deepEqual(result, ['systemctl', 'status', 'chrony.service']);
});

test('buildCliWithParams: 正常な値でプレースホルダーが1要素として置換される', () => {
  const action = makeAction([domainParam, emailParam]);
  const result = buildCliWithParams(action, { domain: 'example.com', email: 'admin@example.com' });
  assert.deepEqual(result, ['certbot', 'certonly', '-d', 'example.com', '-m', 'admin@example.com', '--agree-tos']);
});

test('buildCliWithParams: 値にスペースや記号が含まれても1つの引数のまま(配列の要素数が変わらない)', () => {
  // pattern制約のないパラメータで検証する(パターンで弾かれること自体は別テストで確認済みのため、
  // ここでは純粋に「配列の要素数・構造が壊れないこと」だけを見る)
  const freeTextParam = { id: 'note', label: 'メモ', required: false };
  const action = {
    id: 'echo-note',
    label: 'メモを表示',
    cli: ['echo', '{{note}}'],
    params: [freeTextParam],
  };

  const result = buildCliWithParams(action, { note: 'a b; rm -rf / && echo pwned #' });
  // 要素数が変わらないこと = コマンドの構造が壊れていないことの確認
  assert.equal(result.length, 2);
  assert.equal(result[0], 'echo');
  assert.equal(result[1], 'a b; rm -rf / && echo pwned #');
});

test('buildCliWithParams: 必須パラメータが空なら例外', () => {
  const action = makeAction([domainParam, emailParam]);
  assert.throws(() => buildCliWithParams(action, { domain: '', email: 'admin@example.com' }), /ドメイン名/);
});

test('buildCliWithParams: patternに一致しない値は例外', () => {
  const action = makeAction([domainParam, emailParam]);
  assert.throws(
    () => buildCliWithParams(action, { domain: 'not a domain!!', email: 'admin@example.com' }),
    /ドメイン名/
  );
  assert.throws(
    () => buildCliWithParams(action, { domain: 'example.com', email: 'not-an-email' }),
    /メールアドレス/
  );
});

test('buildCliWithParams: 長すぎる値は例外', () => {
  const action = makeAction([domainParam, emailParam]);
  const longValue = 'a'.repeat(300) + '.com';
  assert.throws(() => buildCliWithParams(action, { domain: longValue, email: 'admin@example.com' }), /長すぎます/);
});
