// core/paramSubstitution.js — パラメータ付きアクションの検証・置換ロジック。
//
// plugin.jsonのactionsは、cli配列内に "{{paramId}}" というトークンを含められる。
// これはactions[].paramsで宣言された入力値と1対1で対応し、実行時に「配列の1要素として」
// 置換される(文字列結合ではない)。execFileは配列の各要素を1つの引数として扱うため、
// 入力値にどんな文字が含まれていても、それは常に「1つの引数の中身」でしかなく、
// コマンドの構造(引数の数や区切り)自体を変えることはできない。これにより
// 「配列引数のみを使い、シェル文字列を組み立てない」という既存の安全性を維持したまま
// ユーザー入力を受け付けられる。

function buildCliWithParams(action, paramValues) {
  if (!Array.isArray(action.params) || action.params.length === 0) {
    return action.cli;
  }

  const values = paramValues || {};

  for (const param of action.params) {
    const raw = values[param.id];
    const value = raw === undefined || raw === null ? '' : String(raw);

    if (param.required && value.trim() === '') {
      throw new Error(`「${param.label}」を入力してください`);
    }
    if (value.length > 255) {
      throw new Error(`「${param.label}」が長すぎます（255文字以内にしてください）`);
    }
    if (value !== '' && param.pattern && !new RegExp(param.pattern).test(value)) {
      throw new Error(`「${param.label}」の形式が正しくありません`);
    }
  }

  return action.cli.map((token) => {
    const match = /^\{\{(\w+)\}\}$/.exec(token);
    if (!match) return token;
    const raw = values[match[1]];
    return raw === undefined || raw === null ? '' : String(raw);
  });
}

module.exports = { buildCliWithParams };
