function getPluginIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeRelativePath(p) {
  return typeof p === 'string' && /^[a-zA-Z0-9_./-]+$/.test(p) && !p.includes('..') && !/^https?:|^\/\//i.test(p);
}

async function init() {
  const id = getPluginIdFromUrl();
  const content = document.getElementById('content');

  if (!id) {
    content.innerHTML = '<p class="muted">プラグインが指定されていません。</p>';
    return;
  }

  let catalog;
  try {
    catalog = await fetch('catalog.json').then((r) => r.json());
  } catch {
    content.innerHTML = '<p class="muted">カタログの読み込みに失敗しました。</p>';
    return;
  }

  const plugin = catalog.find((p) => p.id === id);
  if (!plugin) {
    content.innerHTML = '<p class="muted">指定されたプラグインが見つかりませんでした。</p>';
    return;
  }

  document.title = `${plugin.name} — Penguin Control Center`;

  const tags = (plugin.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const codeBadge = plugin.hasCode
    ? '<span class="tag code-badge">⚠ カスタムコード含む</span>'
    : '<span class="tag manifest-badge">manifest-only</span>';
  const downloadHref = isSafeRelativePath(plugin.download) ? escapeHtml(plugin.download) : '#';

  content.innerHTML = `
    <header class="plugin-head">
      <h1>${escapeHtml(plugin.name)}</h1>
      <div class="meta-row">id: ${escapeHtml(plugin.id)} ・ v${escapeHtml(plugin.version)} ・ ${escapeHtml(plugin.author || '')}</div>
      <p class="desc">${escapeHtml(plugin.description || '')}</p>
      <div class="tags">${tags}${codeBadge}</div>
      <a class="btn" href="${downloadHref}" download>ダウンロード (.zip)</a>
    </header>
    <div class="docs-body" id="docs-body"><span class="muted">ドキュメントを読み込み中...</span></div>
  `;

  const docsBody = document.getElementById('docs-body');
  if (!plugin.docs || !isSafeRelativePath(plugin.docs)) {
    docsBody.innerHTML = '<p class="muted">このプラグインの詳細ドキュメントは登録されていません。</p>';
    return;
  }

  try {
    const md = await fetch(plugin.docs).then((r) => {
      if (!r.ok) throw new Error('not found');
      return r.text();
    });
    docsBody.innerHTML = renderMarkdown(md);
  } catch {
    docsBody.innerHTML = '<p class="muted">ドキュメントの読み込みに失敗しました。</p>';
  }
}

init();
