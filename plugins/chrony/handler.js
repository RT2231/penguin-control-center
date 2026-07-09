// plugins/chrony/handler.js
// マニフェストだけでは表現しづらい「複雑な処理」の例として、
// `chronyc tracking` の出力から同期状態を簡易パースするユーティリティを提供する。
// (現時点ではcore側から自動呼び出しはしていない。将来のGUI状態表示強化用の拡張ポイント)

function parseTracking(stdout) {
  const lines = stdout.split('\n');
  const result = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    result[key.trim()] = rest.join(':').trim();
  }

  const offsetLine = result['System time'] || '';
  const isSynced = !!result['Reference ID'] && result['Reference ID'] !== '00000000';

  return {
    synced: isSynced,
    referenceId: result['Reference ID'] || null,
    stratum: result['Stratum'] || null,
    systemTimeOffset: offsetLine || null,
    raw: result,
  };
}

module.exports = { parseTracking };
