// docs/admin.js
//
// メンテナ専用の管理画面ロジック。GitHub Pages(静的サイト)上で動作し、
// ブラウザ内で入力されたFine-grained PATを使ってGitHub APIを直接呼び出す。
// PATはsessionStorageにのみ保持し、タブを閉じる/リロードすると失われる。
//
// 注意: このファイルはpublicなGitHub Pagesで配信されるため、
// APIキーの類は絶対にコード中にハードコードしないこと。

const API_BASE = 'https://api.github.com';

// GitHub OAuth App(Client IDは公開情報。Client SecretはCloudflare Worker側にのみ保持)
const OAUTH_CLIENT_ID = 'Ov23liLKrIMy2iphdEiA';
// トークン交換だけを代行するCloudflare Worker(Client Secretを保持し、CORS非対応な
// github.com/login/oauth/access_token をサーバー側から叩いて結果だけ返す)
const OAUTH_WORKER_URL = 'https://pcc-oauth.shirokuma0822.workers.dev/';
// このリポジトリはpublicのため、書き込みに必要な最小スコープはpublic_repoで足りる
// (public_repoにはissuesの読み書きも含まれる)
const OAUTH_SCOPE = 'public_repo';

function oauthRedirectUri() {
  // 現在のページURLからクエリ/ハッシュを除いたものを使う(GitHub側の登録値と完全一致させる必要がある)
  return `${location.origin}${location.pathname}`;
}

const state = {
  owner: '',
  repo: '',
  pat: '',
  authed: false,
  issueNumber: null,
  issueBody: '',
  fileShas: {}, // path -> sha (既存ファイルの更新に必要)
  checksPassed: false,
};

// ---------- 共通ユーティリティ ----------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function setStatus(elId, kind, message) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.className = `status-line show ${kind}`;
}

function setPanelEnabled(panelId, enabled) {
  document.getElementById(panelId).dataset.disabled = enabled ? 'false' : 'true';
}

function appendLog(message, kind) {
  const panel = document.getElementById('panel-log');
  panel.style.display = 'block';
  const body = document.getElementById('log-body');
  const color = { ok: 'var(--ok)', err: 'var(--danger)', info: 'var(--text-muted)' }[kind || 'info'];
  const line = document.createElement('div');
  line.style.color = color;
  line.textContent = `${new Date().toLocaleTimeString('ja-JP')}  ${message}`;
  body.appendChild(line);
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function gh(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 本文なし(204等) */
  }
  return { ok: res.ok, status: res.status, json };
}

// ---------- ① 接続 ----------
//
// 2通りの経路でトークンを得られる:
// (a) 「GitHubでログイン」ボタン → OAuth Authorize → Cloudflare Workerでcodeをaccess_tokenに交換
// (b) 手動でPersonal Access Tokenを貼り付け(上級者向けフォールバック)
// どちらの場合も、最終的に connectWithToken() で「そのトークンにpush権限があるか」を検証する。

async function connectWithToken(token, { silent = false } = {}) {
  const owner = document.getElementById('owner').value.trim();
  const repo = document.getElementById('repo').value.trim();

  if (!owner || !repo || !token) {
    if (!silent) setStatus('auth-status', 'err', 'owner / repo / トークンを入力してください。');
    return false;
  }

  if (!silent) setStatus('auth-status', 'warn', '確認中...');

  state.pat = token; // gh()がこの時点のstate.patを見るため先にセットしておく
  const { ok, status, json } = await gh(`/repos/${owner}/${repo}`);

  if (!ok) {
    state.pat = '';
    setStatus('auth-status', 'err', `リポジトリの取得に失敗しました (HTTP ${status})。owner/repo名またはトークンを確認してください。`);
    return false;
  }

  const hasPush = !!(json.permissions && json.permissions.push);
  if (!hasPush) {
    state.pat = '';
    setStatus('auth-status', 'err', 'このトークンにはリポジトリへの書き込み権限(push)がありません。権限設定を確認してください。');
    return false;
  }

  state.owner = owner;
  state.repo = repo;
  state.authed = true;
  sessionStorage.setItem('pcc-admin-pat', token); // タブ内のみ・リロード時の再ログインを減らすため(閉じれば消える)

  setStatus('auth-status', 'ok', `接続OK: ${owner}/${repo} への書き込み権限を確認しました。`);
  document.getElementById('btn-login-github').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'inline-block';
  document.getElementById('manual-pat-box').style.display = 'none';
  setPanelEnabled('panel-issue', true);
  return true;
}

document.getElementById('btn-connect').addEventListener('click', () => {
  const pat = document.getElementById('pat').value.trim();
  connectWithToken(pat);
});

document.getElementById('btn-login-github').addEventListener('click', () => {
  const stateToken = crypto.randomUUID();
  sessionStorage.setItem('pcc-oauth-state', stateToken);
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    scope: OAUTH_SCOPE,
    redirect_uri: oauthRedirectUri(),
    state: stateToken,
  });
  location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem('pcc-admin-pat');
  sessionStorage.removeItem('pcc-oauth-state');
  location.reload();
});

document.getElementById('toggle-manual-pat').addEventListener('click', (e) => {
  e.preventDefault();
  const box = document.getElementById('manual-pat-box');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
});

// GitHubからOAuthのcode付きでリダイレクトされてきた場合の処理
async function handleOAuthRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  if (!code) return false;

  // URLからcode/stateを消しておく(リロード時の二重処理・履歴への残留を防ぐ)
  history.replaceState({}, '', oauthRedirectUri());

  const savedState = sessionStorage.getItem('pcc-oauth-state');
  sessionStorage.removeItem('pcc-oauth-state');
  if (!savedState || returnedState !== savedState) {
    setStatus('auth-status', 'err', 'OAuthのstateが一致しませんでした(CSRF対策で拒否されました)。もう一度ログインしてください。');
    return true;
  }

  setStatus('auth-status', 'warn', 'GitHubからのログインを処理中です...');
  try {
    const res = await fetch(`${OAUTH_WORKER_URL}?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      setStatus('auth-status', 'err', `ログインに失敗しました: ${data.error_description || data.error || 'unknown error'}`);
      return true;
    }
    await connectWithToken(data.access_token);
  } catch (err) {
    setStatus('auth-status', 'err', `Worker経由のトークン取得に失敗しました: ${err.message}`);
  }
  return true;
}

// リロード時にsessionStorageのトークンがあれば自動で再接続を試みる(OAuth/手動PATどちらでも)
window.addEventListener('DOMContentLoaded', async () => {
  const handledRedirect = await handleOAuthRedirect();
  if (handledRedirect) return;

  const saved = sessionStorage.getItem('pcc-admin-pat');
  if (saved) {
    await connectWithToken(saved, { silent: true });
  }
});

// ---------- ② Issue取り込み ----------

function parseIssueNumber(input) {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const m = trimmed.match(/\/issues\/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function extractFencedBlock(body, langs) {
  // ```json ... ``` のようなフェンス付きコードブロックを言語名で検索
  const re = /```(\w+)?\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    if (langs.includes(lang)) return match[2].trim();
  }
  return null;
}

document.getElementById('btn-fetch-issue').addEventListener('click', async () => {
  const raw = document.getElementById('issue-input').value;
  const num = parseIssueNumber(raw);
  if (!num) {
    setStatus('issue-status', 'err', 'Issue番号を認識できませんでした。数字またはIssue URLを入力してください。');
    return;
  }

  setStatus('issue-status', 'warn', '取得中...');
  const { ok, status, json } = await gh(`/repos/${state.owner}/${state.repo}/issues/${num}`);
  if (!ok) {
    setStatus('issue-status', 'err', `Issue #${num} の取得に失敗しました (HTTP ${status})。`);
    return;
  }

  state.issueNumber = num;
  state.issueBody = json.body || '';

  document.getElementById('raw-issue-wrap').style.display = 'block';
  document.getElementById('raw-issue').textContent = `#${num} ${json.title}\n\n${json.body || '(本文なし)'}`;

  const pluginJson = extractFencedBlock(state.issueBody, ['json']);
  const docsMd = extractFencedBlock(state.issueBody, ['markdown', 'md']);
  const handlerJs = extractFencedBlock(state.issueBody, ['js', 'javascript']);

  if (pluginJson) {
    document.getElementById('field-plugin-json').value = pluginJson;
    try {
      const parsed = JSON.parse(pluginJson);
      if (parsed.id) document.getElementById('field-id').value = parsed.id;
    } catch {
      /* JSONとして不正な場合はそのまま貼るだけにして、後段の静的チェックに委ねる */
    }
  }
  if (docsMd) document.getElementById('field-docs-md').value = docsMd;
  if (handlerJs) document.getElementById('field-handler-js').value = handlerJs;

  const found = [pluginJson && 'plugin.json', docsMd && 'docs.md', handlerJs && 'handler.js'].filter(Boolean);
  setStatus(
    'issue-status',
    'ok',
    found.length
      ? `Issue #${num} を取得しました。自動抽出: ${found.join(' / ')}。内容を確認・編集してください。`
      : `Issue #${num} を取得しました。コードブロックは見つからなかったため、本文を見ながら手動で入力してください。`
  );

  setPanelEnabled('panel-edit', true);
});

// ---------- ③④ 編集 & 静的チェック ----------

const DANGEROUS_PATTERNS = [
  { re: /rm\s+-rf/i, label: 'rm -rf（再帰的強制削除）' },
  { re: /mkfs/i, label: 'mkfs（ファイルシステム作成/フォーマット）' },
  { re: /dd\s+if=/i, label: 'dd if=（ディスクへの直接書き込み）' },
  { re: />\s*\/dev\/sd/i, label: '/dev/sdX への直接書き込み' },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i, label: 'fork爆弾のパターン' },
  { re: /curl[^|\n]*\|\s*(sh|bash)/i, label: 'curl | sh（外部スクリプトのパイプ実行）' },
  { re: /wget[^|\n]*\|\s*(sh|bash)/i, label: 'wget | sh（外部スクリプトのパイプ実行）' },
  { re: /\bsudo\b/i, label: 'sudo の直接使用（privilegedフラグではなく）' },
  { re: /chmod\s+-R\s+777/i, label: 'chmod -R 777' },
  { re: /\beval\s*\(/i, label: 'eval() の使用' },
  { re: /child_process/i, label: 'child_process の使用（handler.js）' },
  { re: /require\(\s*['"]https?:/i, label: '動的なネットワーク経由require' },
];

function validateManifestFields(manifest) {
  const errors = [];
  const warnings = [];
  if (!manifest.id) errors.push('id が未設定です');
  if (!manifest.name) errors.push('name が未設定です');
  if (!Array.isArray(manifest.actions) || manifest.actions.length === 0) {
    errors.push('actions が配列でないか空です');
  } else {
    manifest.actions.forEach((a, i) => {
      if (!a.id || !a.label || !Array.isArray(a.cli) || a.cli.length === 0) {
        errors.push(`actions[${i}] に id / label / cli(配列) のいずれかが不足しています`);
      } else {
        a.cli.forEach((part) => {
          if (/[|>;&]/.test(part) && a.cli.length === 1) {
            warnings.push(`actions[${i}] (${a.id}) の cli にシェル演算子(| > ; &)を含む文字列が1要素にまとまっています。配列を分けるべきか確認してください: "${part}"`);
          }
        });
      }
    });
  }
  if (!manifest.version) warnings.push('version が未設定です');
  if (!manifest.description) warnings.push('description が未設定です');
  if (!manifest.author) warnings.push('author が未設定です（未設定の場合はIssue提出者のGitHubアカウント名を記録してください）');
  return { errors, warnings };
}

function scanDangerous(text) {
  const hits = [];
  for (const p of DANGEROUS_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  return hits;
}

function checkDocsMd(md) {
  const missing = [];
  if (!/概要/.test(md)) missing.push('「概要」');
  if (!/主なCLIコマンド|CLIコマンド/.test(md)) missing.push('「主なCLIコマンド」');
  if (!/よくあるトラブル/.test(md)) missing.push('「よくあるトラブル」');
  return missing;
}

document.getElementById('btn-run-checks').addEventListener('click', async () => {
  const results = [];
  const id = document.getElementById('field-id').value.trim();
  const pluginJsonRaw = document.getElementById('field-plugin-json').value;
  const docsMd = document.getElementById('field-docs-md').value;
  const handlerJs = document.getElementById('field-handler-js').value;

  // 1. ID形式チェック
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    results.push({ kind: 'fail', text: 'プラグインIDが未入力、または半角英数・ハイフン以外の文字を含んでいます。' });
  } else {
    results.push({ kind: 'pass', text: `プラグインID: ${id}` });
  }

  // 2. JSON妥当性
  let manifest = null;
  try {
    manifest = JSON.parse(pluginJsonRaw);
    results.push({ kind: 'pass', text: 'plugin.json は正しいJSON形式です。' });
  } catch (err) {
    results.push({ kind: 'fail', text: `plugin.json のJSONとしての構文が不正です: ${err.message}` });
  }

  // 3. 必須項目
  if (manifest) {
    const { errors, warnings } = validateManifestFields(manifest);
    errors.forEach((e) => results.push({ kind: 'fail', text: e }));
    warnings.forEach((w) => results.push({ kind: 'warn', text: w }));
    if (errors.length === 0) results.push({ kind: 'pass', text: 'plugin.json の必須項目(id/name/actions)は揃っています。' });

    // 4. ID重複チェック(catalog.json + plugins/ 実体)
    if (manifest.id) {
      try {
        const catalog = await fetch('catalog.json').then((r) => (r.ok ? r.json() : []));
        if (catalog.find((c) => c.id === manifest.id)) {
          results.push({ kind: 'fail', text: `id "${manifest.id}" は既にストアに公開済みのプラグインと重複しています。` });
        } else {
          results.push({ kind: 'pass', text: 'catalog.json 上でのID重複はありません。' });
        }
      } catch {
        results.push({ kind: 'warn', text: 'catalog.json の読み込みに失敗したため、ID重複チェックをスキップしました。' });
      }

      const existing = await gh(`/repos/${state.owner}/${state.repo}/contents/plugins/${encodeURIComponent(manifest.id)}`);
      if (existing.ok) {
        results.push({ kind: 'warn', text: `plugins/${manifest.id}/ は既にリポジトリ内に存在します。上書きになりますが問題ないか確認してください。` });
      }
    }

    // 5. 危険コマンドスキャン(plugin.json内のcli)
    const cliJoined = JSON.stringify(manifest.actions || []);
    const cliHits = scanDangerous(cliJoined);
    if (cliHits.length) {
      cliHits.forEach((h) => results.push({ kind: 'warn', text: `plugin.json 内に注意すべきパターンを検出: ${h}` }));
    } else {
      results.push({ kind: 'pass', text: 'plugin.json 内に既知の危険コマンドパターンは検出されませんでした。' });
    }
  }

  // 6. handler.js 危険コマンドスキャン
  if (handlerJs.trim()) {
    const jsHits = scanDangerous(handlerJs);
    if (jsHits.length) {
      jsHits.forEach((h) => results.push({ kind: 'warn', text: `handler.js 内に注意すべきパターンを検出: ${h}` }));
    } else {
      results.push({ kind: 'pass', text: 'handler.js 内に既知の危険コマンドパターンは検出されませんでした。' });
    }
  } else {
    results.push({ kind: 'pass', text: 'handler.js は空欄です(manifest-onlyのプラグインとして扱われます)。' });
  }

  // 7. docs.md 必須セクション
  if (!docsMd.trim()) {
    results.push({ kind: 'warn', text: 'docs.md が空欄です。CONTRIBUTING.mdでは最低限「概要」「主なCLIコマンド」「よくあるトラブル」の記載を推奨しています。' });
  } else {
    const missing = checkDocsMd(docsMd);
    if (missing.length) {
      results.push({ kind: 'warn', text: `docs.md に以下のセクションが見当たりません: ${missing.join(' ')}` });
    } else {
      results.push({ kind: 'pass', text: 'docs.md に推奨セクションが揃っています。' });
    }
  }

  renderCheckResults(results);

  const hasFail = results.some((r) => r.kind === 'fail');
  state.checksPassed = !hasFail;
  setPanelEnabled('panel-checks', true);
  setPanelEnabled('panel-review', true);
  if (!hasFail) renderChecklist();
});

function renderCheckResults(results) {
  const container = document.getElementById('check-results');
  container.innerHTML = results
    .map(
      (r) => `<div class="result-item"><span class="badge ${r.kind}">${
        { pass: 'OK', warn: '要確認', fail: 'NG' }[r.kind]
      }</span><span>${escapeHtml(r.text)}</span></div>`
    )
    .join('');
}

// ---------- ⑤ 手動レビューチェックリスト ----------

const CHECKLIST_ITEMS = [
  'cli が配列であり、パイプ(|)やリダイレクト(>)などのシェル演算子を1つの文字列に埋め込んでいないことを確認した',
  'rm -rf やディスクフォーマット等、システムを破壊しうる操作を含まないことを確認した',
  'privileged: true が本当に特権が必要な操作にのみ付与されていることを確認した',
  'docs.md に「概要」「主なCLIコマンド」「よくあるトラブル」が最低限含まれていることを確認した',
  'plugin.json の必須項目(id/name/version/description/actions)が揃っていることを確認した',
  'id が既存プラグインと重複していないことを確認した',
  'handler.js が存在する場合、内容を読み外部通信や不審なコード実行がないか確認した(該当しない場合は対象外であることを確認した)',
  'author欄が設定されている、または未設定時はIssue提出者のGitHubアカウント名を記録することを確認した',
  '実機またはテスト環境で実際にアクションの動作を確認した',
];

function renderChecklist() {
  const list = document.getElementById('checklist');
  if (list.dataset.rendered === 'true') return; // 再チェック実行時に状態を消さない
  list.dataset.rendered = 'true';
  list.innerHTML = CHECKLIST_ITEMS.map(
    (text, i) => `<li><input type="checkbox" id="chk-${i}" /><label for="chk-${i}" style="margin:0;font-family:var(--font-sans);font-size:13px;color:var(--text);">${escapeHtml(text)}</label></li>`
  ).join('');
  list.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', updateApproveButton));
  updateApproveButton();
}

function allChecked() {
  const boxes = document.querySelectorAll('#checklist input[type=checkbox]');
  return boxes.length === CHECKLIST_ITEMS.length && Array.from(boxes).every((b) => b.checked);
}

function updateApproveButton() {
  const reviewer = document.getElementById('reviewer-name').value.trim();
  document.getElementById('btn-approve').disabled = !(allChecked() && reviewer && state.checksPassed);
}
document.getElementById('reviewer-name').addEventListener('input', updateApproveButton);

// ---------- コミット処理 ----------

async function getShaIfExists(path) {
  const res = await gh(`/repos/${state.owner}/${state.repo}/contents/${path}`);
  return res.ok ? res.json.sha : undefined;
}

async function putFile(path, content, message) {
  const sha = await getShaIfExists(path);
  const body = {
    message,
    content: b64EncodeUnicode(content),
    ...(sha ? { sha } : {}),
  };
  const res = await gh(`/repos/${state.owner}/${state.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} の書き込みに失敗しました (HTTP ${res.status}): ${res.json && res.json.message}`);
  appendLog(`✔ ${path} をコミットしました`, 'ok');
}

document.getElementById('btn-approve').addEventListener('click', async () => {
  if (!allChecked()) {
    setStatus('review-status', 'err', 'チェックリストが全て完了していません。');
    return;
  }
  const reviewer = document.getElementById('reviewer-name').value.trim();
  if (!reviewer) {
    setStatus('review-status', 'err', 'レビュワー名を入力してください。');
    return;
  }
  const id = document.getElementById('field-id').value.trim();
  if (!id) {
    setStatus('review-status', 'err', 'プラグインIDが未入力です。');
    return;
  }

  const pluginJson = document.getElementById('field-plugin-json').value;
  const docsMd = document.getElementById('field-docs-md').value;
  const handlerJs = document.getElementById('field-handler-js').value;

  document.getElementById('btn-approve').disabled = true;
  document.getElementById('btn-reject').disabled = true;
  setStatus('review-status', 'warn', 'コミット中です。しばらくお待ちください...');

  try {
    const reviewedAt = new Date().toISOString();
    await putFile(`plugins/${id}/plugin.json`, pluginJson, `plugin(${id}): add/update plugin.json (reviewed by ${reviewer})`);
    if (docsMd.trim()) {
      await putFile(`plugins/${id}/docs.md`, docsMd, `plugin(${id}): add/update docs.md (reviewed by ${reviewer})`);
    }
    if (handlerJs.trim()) {
      await putFile(`plugins/${id}/handler.js`, handlerJs, `plugin(${id}): add/update handler.js (reviewed by ${reviewer})`);
    }

    const review = {
      reviewedBy: reviewer,
      reviewedAt,
      checklist: CHECKLIST_ITEMS,
      sourceIssue: state.issueNumber,
    };
    await putFile(`plugins/${id}/review.json`, JSON.stringify(review, null, 2) + '\n', `plugin(${id}): add review.json (reviewed by ${reviewer})`);

    if (state.issueNumber) {
      await gh(`/repos/${state.owner}/${state.repo}/issues/${state.issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body: `プラグイン \`${id}\` を採用し、\`plugins/${id}/\` に追加しました。レビュワー: ${reviewer}\n\n次回のカタログ更新でプラグインストアに掲載されます。ありがとうございました！`,
        }),
      });
      await gh(`/repos/${state.owner}/${state.repo}/issues/${state.issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      });
      appendLog(`✔ Issue #${state.issueNumber} にコメントしてクローズしました`, 'ok');
    }

    setStatus('review-status', 'ok', `完了しました。plugins/${id}/ にコミットされました。tools/publish-gui でカタログへの反映を行ってください。`);
  } catch (err) {
    setStatus('review-status', 'err', `エラーが発生しました: ${err.message}`);
    appendLog(`✘ ${err.message}`, 'err');
    document.getElementById('btn-reject').disabled = false;
  }
});

document.getElementById('btn-reject').addEventListener('click', async () => {
  if (!state.issueNumber) {
    setStatus('review-status', 'err', 'Issueが取り込まれていません。');
    return;
  }
  const reason = window.prompt('却下理由をIssueへのコメントとして記載します(必須):', '');
  if (reason === null) return;
  if (!reason.trim()) {
    setStatus('review-status', 'err', '却下理由が未入力のため中止しました。');
    return;
  }

  document.getElementById('btn-approve').disabled = true;
  document.getElementById('btn-reject').disabled = true;
  setStatus('review-status', 'warn', '却下コメントを送信中です...');

  try {
    await gh(`/repos/${state.owner}/${state.repo}/issues/${state.issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: `このプラグイン提案について、今回は見送らせていただきます。\n\n理由: ${reason}` }),
    });
    await gh(`/repos/${state.owner}/${state.repo}/issues/${state.issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
    });
    appendLog(`✔ Issue #${state.issueNumber} に却下コメントを残してクローズしました`, 'ok');
    setStatus('review-status', 'ok', 'Issueへコメントしクローズしました。');
  } catch (err) {
    setStatus('review-status', 'err', `エラーが発生しました: ${err.message}`);
    appendLog(`✘ ${err.message}`, 'err');
  } finally {
    document.getElementById('btn-reject').disabled = false;
    updateApproveButton();
  }
});
