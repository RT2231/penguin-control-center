// renderer/app.js — UIロジック。window.pcc（preload.jsで公開されたAPI）のみを使用する。

let plugins = [];
let activePluginId = null;
let activeTab = 'gui';

async function init() {
  plugins = await window.pcc.listPlugins();
  renderSidebar();
  document.getElementById('open-store').addEventListener('click', openStore);
  document.getElementById('refresh-store').addEventListener('click', loadStore);
}

function renderSidebar() {
  const list = document.getElementById('plugin-list');
  list.innerHTML = '';
  for (const plugin of plugins) {
    const item = document.createElement('div');
    item.className = 'plugin-item' + (plugin.id === activePluginId ? ' active' : '');
    item.innerHTML = `<span class="status-dot"></span><span class="name">${escapeHtml(plugin.name)}</span>`;
    item.addEventListener('click', () => selectPlugin(plugin.id));
    list.appendChild(item);
  }
}

function selectPlugin(pluginId) {
  activePluginId = pluginId;
  activeTab = 'gui';
  renderSidebar();

  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('store-view').classList.add('hidden');
  document.getElementById('plugin-view').classList.remove('hidden');

  const plugin = plugins.find((p) => p.id === pluginId);
  document.getElementById('plugin-name').textContent = plugin.name;
  document.getElementById('plugin-desc').textContent = plugin.description || '';

  setupTabs();
  renderActionList(plugin);
  showTab('gui');
}

// ---- ストア画面 ----
async function openStore() {
  activePluginId = null;
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('plugin-view').classList.add('hidden');
  document.getElementById('store-view').classList.remove('hidden');
  renderSidebar();
  await loadStore();
}

async function loadStore() {
  const list = document.getElementById('store-list');
  list.innerHTML = '<div class="muted">読み込み中...</div>';

  try {
    const storePlugins = await window.pcc.listStorePlugins();
    list.innerHTML = '';

    if (storePlugins.length === 0) {
      list.innerHTML = '<div class="muted">現在ストアに公開されているプラグインはありません。</div>';
      return;
    }

    for (const p of storePlugins) {
      list.appendChild(renderStoreCard(p));
    }
  } catch (err) {
    list.innerHTML = `<div class="muted">ストアの取得に失敗しました: ${escapeHtml(err.message)}</div>`;
  }
}

function renderStoreCard(p) {
  const card = document.createElement('div');
  card.className = 'store-card';

  const tags = (p.tags || []).map((t) => `<span class="store-tag">${escapeHtml(t)}</span>`).join('');

  let btnLabel = '導入する';
  let btnClass = '';
  let btnDisabled = false;
  if (p.installed && !p.updateAvailable) {
    btnLabel = '導入済み';
    btnClass = 'installed';
    btnDisabled = true;
  } else if (p.updateAvailable) {
    btnLabel = `更新する (v${p.installedVersion} → v${p.version})`;
    btnClass = 'update';
  }

  card.innerHTML = `
    <div class="name">${escapeHtml(p.name)}</div>
    <div class="meta">v${escapeHtml(p.version)} ・ ${escapeHtml(p.author || '')}</div>
    <div class="desc">${escapeHtml(p.description || '')}</div>
    <div class="store-tags">${tags}</div>
    <button class="store-install-btn ${btnClass}" ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button>
  `;

  const btn = card.querySelector('.store-install-btn');
  if (!btnDisabled) {
    btn.addEventListener('click', () => installFromStore(p.id, btn));
  }

  return card;
}

async function installFromStore(pluginId, btn) {
  btn.disabled = true;
  btn.textContent = '導入中...';
  try {
    plugins = await window.pcc.installStorePlugin(pluginId);
    renderSidebar();
    await loadStore();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `エラー: ${err.message}`;
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
    btn.onclick = () => showTab(btn.dataset.tab);
  });
}

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById(`panel-${tab}`).classList.remove('hidden');

  if (tab === 'cli') loadCliHistory();
  if (tab === 'log') loadLog();
  if (tab === 'config') loadConfig();
  if (tab === 'docs') loadDocs();
}

// ---- GUI設定タブ：ボタンと対応CLIを並べて表示するのがこのアプリの核 ----
function renderActionList(plugin) {
  const container = document.getElementById('action-list');
  container.innerHTML = '';
  document.getElementById('action-result').hidden = true;

  for (const action of plugin.actions) {
    const card = document.createElement('button');
    card.className = 'action-card' + (action.privileged ? ' privileged' : '');
    card.innerHTML = `
      <div class="action-label">${escapeHtml(action.label)}</div>
      <div class="action-cli">${escapeHtml(action.cli.join(' '))}</div>
    `;
    card.addEventListener('click', () => runAction(plugin.id, action.id));
    container.appendChild(card);
  }
}

async function runAction(pluginId, actionId) {
  const resultBox = document.getElementById('action-result');
  resultBox.hidden = false;
  resultBox.textContent = '実行中...';

  try {
    const result = await window.pcc.runAction(pluginId, actionId);
    if (result.cancelled) {
      resultBox.textContent = 'キャンセルされました。';
      return;
    }
    resultBox.textContent =
      `$ ${result.command}\n` +
      `終了コード: ${result.exitCode}  (${result.durationMs}ms)\n\n` +
      (result.stdout ? `--- stdout ---\n${result.stdout}\n` : '') +
      (result.stderr ? `--- stderr ---\n${result.stderr}\n` : '');
  } catch (err) {
    resultBox.textContent = `エラー: ${err.message}`;
  }
}

// ---- CLIタブ ----
async function loadCliHistory() {
  const box = document.getElementById('cli-history');
  box.innerHTML = '<div class="muted">読み込み中...</div>';
  const history = await window.pcc.getCliHistory();

  if (history.length === 0) {
    box.innerHTML = '<div class="muted">まだ実行履歴はありません。GUI設定タブからアクションを実行してください。</div>';
    return;
  }

  box.innerHTML = '';
  for (const entry of history) {
    const div = document.createElement('div');
    div.className = 'cli-entry';
    const exitClass = entry.exitCode === 0 ? 'exit-ok' : 'exit-err';
    div.innerHTML = `
      <div class="cmd">$ ${escapeHtml(entry.command)}</div>
      <div class="meta">${entry.timestamp} ・ <span class="${exitClass}">exit ${entry.exitCode}</span> ・ ${entry.durationMs}ms</div>
    `;
    box.appendChild(div);
  }
}

document.getElementById('refresh-cli').addEventListener('click', loadCliHistory);

// ---- ログタブ ----
async function loadLog() {
  const plugin = plugins.find((p) => p.id === activePluginId);
  const logBox = document.getElementById('log-box');

  if (!plugin.hasLog) {
    document.getElementById('log-unit-label').textContent = 'このプラグインはログ表示に対応していません';
    logBox.textContent = '';
    return;
  }

  document.getElementById('log-unit-label').textContent = `journalctl -u <unit>`;
  logBox.textContent = '読み込み中...';

  const result = await window.pcc.readLog(activePluginId, 200);
  document.getElementById('log-unit-label').textContent = `journalctl -u ${result.unit}`;
  logBox.textContent = result.ok ? (result.log || '(ログはありません)') : `エラー: ${result.error}`;
}

document.getElementById('refresh-log').addEventListener('click', loadLog);

// ---- 設定ファイルタブ ----
async function loadConfig() {
  const plugin = plugins.find((p) => p.id === activePluginId);
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('config-status');
  status.textContent = '';

  if (!plugin.hasConfig) {
    document.getElementById('config-path-label').textContent = 'このプラグインには設定ファイルが定義されていません';
    editor.value = '';
    editor.disabled = true;
    return;
  }

  editor.disabled = false;
  editor.value = '読み込み中...';
  const result = await window.pcc.readConfig(activePluginId);
  document.getElementById('config-path-label').textContent = result.path + (result.exists ? '' : '（未作成）');
  editor.value = result.content;
}

document.getElementById('save-config').addEventListener('click', async () => {
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('config-status');
  status.textContent = '保存中...';
  try {
    const result = await window.pcc.writeConfig(activePluginId, editor.value);
    status.textContent = result.backupPath
      ? `保存しました。バックアップ: ${result.backupPath}`
      : `保存しました（新規作成、バックアップなし）`;
  } catch (err) {
    status.textContent = `エラー: ${err.message}`;
  }
});

// ---- ドキュメントタブ ----
async function loadDocs() {
  const view = document.getElementById('docs-view');
  view.innerHTML = '読み込み中...';
  const markdown = await window.pcc.readDocs(activePluginId);
  view.innerHTML = renderMarkdown(markdown);
}

// 最小限のMarkdown→HTML変換（外部ライブラリ不使用、CSPをシンプルに保つため）
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inList = false;

  for (let raw of lines) {
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

    if (line === '') { html += ''; continue; }
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
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

init();
