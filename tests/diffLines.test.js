const { test } = require('node:test');
const assert = require('node:assert/strict');
const { diffLines } = require('../core/diffLines');

test('diffLines: 差分なしの場合はすべてctx', () => {
  const result = diffLines('a\nb\nc', 'a\nb\nc');
  assert.deepEqual(result, [
    { type: 'ctx', text: 'a' },
    { type: 'ctx', text: 'b' },
    { type: 'ctx', text: 'c' },
  ]);
});

test('diffLines: 1行置換をdel+addとして検出する', () => {
  const oldText = 'server ntp1.example.com iburst\nserver ntp2.example.com iburst\ndriftfile /var/lib/chrony/drift';
  const newText = 'server ntp1.example.com iburst\nserver ntp3.example.com iburst\ndriftfile /var/lib/chrony/drift\nlogdir /var/log/chrony';

  const result = diffLines(oldText, newText);
  assert.deepEqual(result, [
    { type: 'ctx', text: 'server ntp1.example.com iburst' },
    { type: 'del', text: 'server ntp2.example.com iburst' },
    { type: 'add', text: 'server ntp3.example.com iburst' },
    { type: 'ctx', text: 'driftfile /var/lib/chrony/drift' },
    { type: 'add', text: 'logdir /var/log/chrony' },
  ]);
});

test('diffLines: 全行削除(空文字列は1行の空行として扱われる)', () => {
  // ''.split('\n') は [''] (要素1つの空行)になるため、削除2行+空行追加として現れる
  const result = diffLines('a\nb', '');
  assert.deepEqual(result, [
    { type: 'del', text: 'a' },
    { type: 'del', text: 'b' },
    { type: 'add', text: '' },
  ]);
});

test('diffLines: 全行追加(空文字列から)', () => {
  const result = diffLines('', 'a\nb');
  assert.deepEqual(result, [
    { type: 'del', text: '' },
    { type: 'add', text: 'a' },
    { type: 'add', text: 'b' },
  ]);
});
