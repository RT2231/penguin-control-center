// docs/markdown.js — プラグインのdocs.mdをサイト上に安全に表示するための
// 最小限のMarkdown→HTML変換(外部ライブラリ不使用)。
// renderer/app.js内の実装と同じ設計(エスケープ徹底・リンクスキームのホワイトリスト)を踏襲。

function renderMarkdown(md) {
  const lines = String(md).split('\n');
  let html = '';
  let inTable = false;
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\|.*\|$/.test(line)) {
      if (!inTable) { html += '<table>'; inTable = true; }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const isSeparator = cells.every((c) => /^-+$/.test(c));
      if (!isSeparator) {
        const tag = html.endsWith('<table>') ? 'th' : 'td';
        html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      }
      continue;
    } else if (inTable) {
      html += '</table>';
      inTable = false;
    }

    if (line.startsWith('## ')) { html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { html += `<h1>${inline(line.slice(2))}</h1>`; continue; }

    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    } else if (inList) {
      html += '</ul>';
      inList = false;
    }

    if (line === '') { continue; }
    html += `<p>${inline(line)}</p>`;
  }

  if (inTable) html += '</table>';
  if (inList) html += '</ul>';
  return html;
}

function inline(text) {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safe = /^(https?:|mailto:)/i.test(url.trim());
    if (!safe) return label;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return t;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
