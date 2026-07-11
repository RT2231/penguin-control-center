async function init() {
  const list = document.getElementById('plugin-list');
  const plugins = await fetch('/api/plugins').then((r) => r.json());

  if (plugins.length === 0) {
    list.innerHTML = '<div class="muted">plugins/ 配下にプラグインが見つかりません。</div>';
    return;
  }

  list.innerHTML = '';
  for (const p of plugins) {
    list.appendChild(renderCard(p));
  }
}

function renderCard(p) {
  const card = document.createElement('div');
  card.className = 'plugin-card' + (p.valid === false ? ' invalid' : '');

  if (p.error) {
    card.innerHTML = `<div class="plugin-name">${escapeHtml(p.id)}</div><div class="pill err">読み込みエラー: ${escapeHtml(p.error)}</div>`;
    return card;
  }

  const statusPills = [];
  if (!p.valid) statusPills.push(`<span class="pill err">検証エラー: ${escapeHtml(p.validationError)}</span>`);
  if (p.published) {
    const upToDate = p.publishedVersion === p.version;
    statusPills.push(
      upToDate
        ? `<span class="pill ok">公開済み (v${escapeHtml(p.version)})</span>`
        : `<span class="pill warn">要更新: 公開中 v${escapeHtml(p.publishedVersion)} → 手元 v${escapeHtml(p.version)}</span>`
    );
  } else {
    statusPills.push('<span class="pill warn">未公開</span>');
  }

  card.innerHTML = `
    <div class="plugin-head">
      <div class="plugin-name">${escapeHtml(p.name || p.id)}</div>
      <div class="plugin-version">id: ${escapeHtml(p.id)} ・ v${escapeHtml(p.version || '?')}</div>
    </div>
    <div class="plugin-desc">${escapeHtml(p.description || '')}</div>
    <div class="status-row">${statusPills.join('')}</div>

    <div class="form-row">
      <div>
        <label>作者表示名</label>
        <input type="text" class="f-author" value="${escapeHtml(p.author)}" />
      </div>
      <div>
        <label>タグ (カンマ区切り)</label>
        <input type="text" class="f-tags" value="${escapeHtml((p.tags || []).join(', '))}" />
      </div>
      <div>
        <label>必要パッケージ (カンマ区切り)</label>
        <input type="text" class="f-requires" value="${escapeHtml((p.requires || []).join(', '))}" />
      </div>
    </div>

    <div class="actions">
      <button class="btn-primary" ${p.valid ? '' : 'disabled'}>${p.published ? 'ストアを更新' : 'ストアに公開'}</button>
      <span class="muted"></span>
    </div>
    <div class="result-msg"></div>
  `;

  const button = card.querySelector('.btn-primary');
  button.addEventListener('click', () => publish(p.id, card));

  return card;
}

async function publish(id, card) {
  const button = card.querySelector('.btn-primary');
  const resultBox = card.querySelector('.result-msg');
  const author = card.querySelector('.f-author').value;
  const tags = card.querySelector('.f-tags').value;
  const requires = card.querySelector('.f-requires').value;

  button.disabled = true;
  resultBox.className = 'result-msg';
  resultBox.textContent = '処理中...';

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, author, tags, requires }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    resultBox.className = 'result-msg ok';
    resultBox.textContent =
      `完了しました。\n生成: ${data.zipPath}\n更新: ${data.catalogPath}\n\n` +
      `次の手順でコミット・pushしてください:\n` +
      `git add docs/catalog.json ${data.zipPath}\n` +
      `git commit -m "plugin: ${id}をストアに公開"\n` +
      `git push`;
  } catch (err) {
    resultBox.className = 'result-msg err';
    resultBox.textContent = `エラー: ${err.message}`;
  } finally {
    button.disabled = false;
    init(); // 状態(公開済みバッジ等)を最新化
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

init();
