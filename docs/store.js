fetch('catalog.json')
  .then((res) => res.json())
  .then((plugins) => {
    const grid = document.getElementById('plugin-grid');
    grid.innerHTML = '';
    for (const p of plugins) {
      const card = document.createElement('div');
      card.className = 'plugin-card';
      const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      const codeBadge = p.hasCode
        ? '<span class="tag code-badge" title="このプラグインは宣言的なCLI定義に加えて、追加のJavaScriptコード(handler.js)を含みます">⚠ カスタムコード含む</span>'
        : '<span class="tag manifest-badge" title="宣言的なCLI定義のみで構成されています(追加コードなし)">manifest-only</span>';
      const downloadHref = isSafeRelativePath(p.download) ? escapeHtml(p.download) : '#';
      card.innerHTML = `
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="version">v${escapeHtml(p.version)} ・ ${escapeHtml(p.author || '')}</div>
        <div class="desc">${escapeHtml(p.description)}</div>
        <div class="tags">${tags}${codeBadge}</div>
        <a class="btn" href="${downloadHref}" download>ダウンロード (.zip)</a>
      `;
      grid.appendChild(card);
    }
    if (plugins.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:13px;">まだ公開されているプラグインはありません。</div>';
    }
  })
  .catch(() => {
    document.getElementById('plugin-grid').innerHTML =
      '<div style="color:var(--warn);font-family:var(--font-mono);font-size:13px;">カタログの読み込みに失敗しました。</div>';
  });

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// downloadは相対パス（絶対URL・スキーム・親ディレクトリ参照は許可しない）のみ受け付ける
function isSafeRelativePath(p) {
  return typeof p === 'string' && /^[a-zA-Z0-9_./-]+$/.test(p) && !p.includes('..') && !/^https?:|^\/\//i.test(p);
}
