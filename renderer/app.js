// renderer/app.js — UIロジック。window.pcc（preload.jsで公開されたAPI）のみを使用する。

let plugins = [];
let activePluginId = null;
let activeTab = 'gui';
let uiMode = localStorage.getItem('pcc-mode') === 'beginner' ? 'beginner' : 'advanced';

function applyModeToDOM() {
  const btn = document.getElementById('mode-toggle');
  if (uiMode === 'beginner') {
    btn.innerHTML = '<span class="mode-dot" style="background:var(--accent)"></span>初心者モード（切替）';
  } else {
    btn.innerHTML = '<span class="mode-dot" style="background:var(--warn)"></span>上級者モード（切替）';
  }
  document.body.classList.toggle('beginner-mode', uiMode === 'beginner');
}

function toggleMode() {
  uiMode = uiMode === 'beginner' ? 'advanced' : 'beginner';
  localStorage.setItem('pcc-mode', uiMode);
  applyModeToDOM();

  // 初心者モードに切り替えた際、設定ファイルタブを開いていたらGUI設定タブへ戻す
  if (uiMode === 'beginner' && activeTab === 'config') {
    showTab('gui');
  }
  if (activePluginId) setupTabs();
}

async function init() {
  plugins = await window.pcc.listPlugins();
  renderSidebar();
  applyModeToDOM();
  showHome();

  document.getElementById('open-store').addEventListener('click', openStore);
  document.getElementById('refresh-store').addEventListener('click', loadStore);
  document.getElementById('mode-toggle').addEventListener('click', toggleMode);
  document.getElementById('refresh-dashboard').addEventListener('click', () => refreshSidebarStatusDots(true));
  document.getElementById('brand-home').addEventListener('click', showHome);
  document.getElementById('plugin-search').addEventListener('input', (e) => filterPluginList(e.target.value));
}

// ---- ホーム/ダッシュボード ----
function showHome() {
  activePluginId = null;
  document.getElementById('plugin-view').classList.add('hidden');
  document.getElementById('store-view').classList.add('hidden');
  renderSidebar();

  if (plugins.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    return;
  }
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('dashboard-view').classList.remove('hidden');
  renderDashboard();
}

function renderDashboard() {
  const list = document.getElementById('dashboard-list');
  list.innerHTML = '';
  for (const plugin of plugins) {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.innerHTML = `
      <div class="dc-top">
        <span class="status-dot" data-plugin-id="${escapeHtml(plugin.id)}"></span>
        <span class="dc-name">${escapeHtml(plugin.name)}</span>
        <span class="update-badge hidden" data-update-badge="${escapeHtml(plugin.id)}" title="ストアに新しいバージョンがあります">⬆ 更新あり</span>
      </div>
      <div class="dc-status" data-status-label="${escapeHtml(plugin.id)}">確認中...</div>
      <div class="dc-desc">${escapeHtml(plugin.description || '')}</div>
    `;
    card.addEventListener('click', () => selectPlugin(plugin.id));
    list.appendChild(card);
  }
  refreshSidebarStatusDots();
  checkForUpdates();
  renderActivityList();
}

async function renderActivityList() {
  const box = document.getElementById('activity-list');
  const history = await window.pcc.getCliHistory(); // pluginId省略=全プラグイン横断
  const recent = history.slice(0, 15);

  if (recent.length === 0) {
    box.innerHTML = '<div class="muted">まだ実行履歴はありません。</div>';
    return;
  }

  box.innerHTML = '';
  for (const entry of recent) {
    const plugin = plugins.find((p) => p.id === entry.pluginId);
    const item = document.createElement('div');
    item.className = 'activity-item';
    const exitClass = entry.exitCode === 0 ? '' : 'exit-err';
    item.innerHTML = `
      <span class="activity-plugin">${escapeHtml(plugin ? plugin.name : entry.pluginId || '(不明)')}</span>
      <span class="activity-cmd">$ ${escapeHtml(entry.command)}</span>
      <span class="activity-meta ${exitClass}">exit ${escapeHtml(String(entry.exitCode))}</span>
    `;
    if (plugin) {
      item.addEventListener('click', () => {
        selectPlugin(plugin.id);
        showTab('cli');
      });
    }
    box.appendChild(item);
  }
}

let outdatedPluginIds = [];

async function checkForUpdates() {
  const updateAllBtn = document.getElementById('update-all-btn');
  try {
    const storePlugins = await window.pcc.listStorePlugins();
    outdatedPluginIds = storePlugins.filter((p) => p.updateAvailable).map((p) => p.id);

    for (const id of outdatedPluginIds) {
      const badge = document.querySelector(`[data-update-badge="${cssEscape(id)}"]`);
      if (badge) badge.classList.remove('hidden');
    }

    updateAllBtn.classList.toggle('hidden', outdatedPluginIds.length === 0);
    updateAllBtn.textContent = `まとめて更新 (${outdatedPluginIds.length})`;
  } catch {
    // ストアに到達できない場合は静かに諦める(オフライン等でも通常のダッシュボード機能は使えるようにする)
    updateAllBtn.classList.add('hidden');
  }
}

document.getElementById('update-all-btn').addEventListener('click', async () => {
  const btn = document.getElementById('update-all-btn');
  btn.disabled = true;
  const targets = [...outdatedPluginIds];
  let successCount = 0;

  for (const id of targets) {
    btn.textContent = `更新中... (${successCount}/${targets.length})`;
    try {
      plugins = await window.pcc.installStorePlugin(id);
      successCount++;
    } catch (err) {
      showToast(`「${id}」の更新に失敗しました: ${err.message}`, 'error');
    }
  }

  showToast(`${successCount}件のプラグインを更新しました`, successCount > 0 ? 'success' : 'error');
  btn.disabled = false;
  renderSidebar();
  renderDashboard();
});

function filterPluginList(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('#plugin-list .plugin-item').forEach((item) => {
    const name = item.querySelector('.name').textContent.toLowerCase();
    item.classList.toggle('hidden', q !== '' && !name.includes(q));
  });
}

function renderSidebar() {
  const list = document.getElementById('plugin-list');
  list.innerHTML = '';
  for (const plugin of plugins) {
    const item = document.createElement('div');
    item.className = 'plugin-item' + (plugin.id === activePluginId ? ' active' : '');
    item.innerHTML = `<span class="status-dot" data-plugin-id="${escapeHtml(plugin.id)}"></span><span class="name">${escapeHtml(plugin.name)}</span>`;
    item.addEventListener('click', () => selectPlugin(plugin.id));
    list.appendChild(item);
  }
  refreshSidebarStatusDots();
}

// ---- サービス状態チェック(キャッシュ付き) ----
// 画面遷移のたびに全プラグイン分のsystemctlを叩くと無駄が多いため、
// 直近の結果を一定時間キャッシュし、force=trueの時だけ必ず再取得する。
const statusCache = new Map(); // pluginId -> { status, fetchedAt }
const STATUS_CACHE_TTL_MS = 5000;
const statusLabelText = { active: '● 稼働中', inactive: '○ 停止中', failed: '✕ エラー', unknown: '？ 不明' };

function applyStatus(pluginId, rawStatus) {
  const status = ['active', 'failed'].includes(rawStatus) ? rawStatus : 'inactive';
  document.querySelectorAll(`.status-dot[data-plugin-id="${cssEscape(pluginId)}"]`).forEach((dot) => {
    dot.classList.remove('status-active', 'status-inactive', 'status-failed');
    dot.classList.add(`status-${status}`);
    dot.title = `systemctl is-active: ${rawStatus}`;
  });
  const label = document.querySelector(`[data-status-label="${cssEscape(pluginId)}"]`);
  if (label) label.textContent = statusLabelText[rawStatus] || statusLabelText.unknown;
}

async function refreshSidebarStatusDots(force = false) {
  for (const plugin of plugins) {
    if (!plugin.hasLog) continue; // systemdUnit未定義のプラグインはスキップ

    const cached = statusCache.get(plugin.id);
    const isFresh = cached && Date.now() - cached.fetchedAt < STATUS_CACHE_TTL_MS;
    if (isFresh && !force) {
      applyStatus(plugin.id, cached.status);
      continue;
    }

    window.pcc.getServiceStatus(plugin.id).then((result) => {
      statusCache.set(plugin.id, { status: result.status, fetchedAt: Date.now() });
      applyStatus(plugin.id, result.status);
    }).catch(() => {});
  }
}

// 特定のプラグインだけを即時に再チェックする(アクション実行直後など、状態が変わった直後用)
async function refreshOneStatus(pluginId) {
  const plugin = plugins.find((p) => p.id === pluginId);
  if (!plugin || !plugin.hasLog) return;
  try {
    const result = await window.pcc.getServiceStatus(pluginId);
    statusCache.set(pluginId, { status: result.status, fetchedAt: Date.now() });
    applyStatus(pluginId, result.status);
  } catch {
    // 状態確認の失敗は致命的ではないため黙って無視する
  }
}

function cssEscape(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '');
}

// ---- トースト通知 ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function selectPlugin(pluginId) {
  activePluginId = pluginId;
  activeTab = 'gui';
  renderSidebar();

  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('store-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('plugin-view').classList.remove('hidden');

  const plugin = plugins.find((p) => p.id === pluginId);
  document.getElementById('plugin-name').textContent = plugin.name;
  document.getElementById('plugin-desc').textContent = plugin.description || '';

  setupTabs();
  renderActionList(plugin);
  showTab('gui');

  const uninstallBtn = document.getElementById('uninstall-plugin');
  uninstallBtn.disabled = false;
  uninstallBtn.textContent = 'アンインストール';
  uninstallBtn.onclick = () => uninstallPlugin(pluginId);
}

async function uninstallPlugin(pluginId) {
  const btn = document.getElementById('uninstall-plugin');
  btn.disabled = true;
  btn.textContent = '処理中...';

  try {
    const result = await window.pcc.uninstallPlugin(pluginId);
    if (result.cancelled) {
      btn.disabled = false;
      btn.textContent = 'アンインストール';
      return;
    }

    plugins = result.plugins;
    statusCache.delete(pluginId);
    showToast(`「${document.getElementById('plugin-name').textContent}」をアンインストールしました`, 'success');
    showHome();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `エラー: ${err.message}`;
    showToast(`アンインストールに失敗しました: ${err.message}`, 'error');
  }
}

// ---- ストア画面 ----
async function openStore() {
  activePluginId = null;
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('plugin-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('store-view').classList.remove('hidden');
  renderSidebar();
  await loadStore();
}

let storePluginsCache = [];
let activeTagFilters = new Set();

async function loadStore() {
  const list = document.getElementById('store-list');
  list.innerHTML = '<div class="muted">読み込み中...</div>';
  document.getElementById('store-tag-filter').innerHTML = '';

  try {
    storePluginsCache = await window.pcc.listStorePlugins();
    activeTagFilters.clear();
    renderTagFilter();
    renderStoreList();
  } catch (err) {
    list.innerHTML = `<div class="muted">ストアの取得に失敗しました: ${escapeHtml(err.message)}</div>`;
  }
}

function renderTagFilter() {
  const box = document.getElementById('store-tag-filter');
  const allTags = [...new Set(storePluginsCache.flatMap((p) => p.tags || []))].sort();
  box.innerHTML = '';

  for (const tag of allTags) {
    const chip = document.createElement('button');
    chip.className = 'tag-filter-chip' + (activeTagFilters.has(tag) ? ' active' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
      else activeTagFilters.add(tag);
      renderTagFilter();
      renderStoreList();
    });
    box.appendChild(chip);
  }
}

function renderStoreList() {
  const list = document.getElementById('store-list');
  const filtered =
    activeTagFilters.size === 0
      ? storePluginsCache
      : storePluginsCache.filter((p) => (p.tags || []).some((t) => activeTagFilters.has(t)));

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<div class="muted">条件に一致するプラグインはありません。</div>';
    return;
  }
  for (const p of filtered) {
    list.appendChild(renderStoreCard(p));
  }
}

function renderStoreCard(p) {
  const card = document.createElement('div');
  card.className = 'store-card';

  const tags = (p.tags || []).map((t) => `<span class="store-tag">${escapeHtml(t)}</span>`).join('');
  const codeBadge = p.hasCode
    ? '<span class="store-tag code-badge" title="宣言的なCLI定義に加え追加のJavaScriptコード(handler.js)を含みます">⚠ カスタムコード含む</span>'
    : '<span class="store-tag manifest-badge" title="宣言的なCLI定義のみで構成されています">manifest-only</span>';

  let btnLabel = '導入する';
  let btnClass = '';
  let btnDisabled = false;
  if (p.installed && !p.updateAvailable) {
    btnLabel = '導入済み';
    btnClass = 'installed';
    btnDisabled = true;
  } else if (p.updateAvailable) {
    btnLabel = `更新する (v${escapeHtml(p.installedVersion)} → v${escapeHtml(p.version)})`;
    btnClass = 'update';
  }

  card.innerHTML = `
    <div class="name">${escapeHtml(p.name)}</div>
    <div class="meta">v${escapeHtml(p.version)} ・ ${escapeHtml(p.author || '')}</div>
    <div class="desc">${escapeHtml(p.description || '')}</div>
    <div class="store-tags">${tags}${codeBadge}</div>
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
    storePluginsCache = await window.pcc.listStorePlugins();
    renderTagFilter();
    renderStoreList();
    showToast(`「${pluginId}」を導入しました`, 'success');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `エラー: ${err.message}`;
    showToast(`導入に失敗しました: ${err.message}`, 'error');
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach((btn) => {
    const isAdvancedOnly = btn.classList.contains('advanced-only');
    btn.classList.toggle('hidden', isAdvancedOnly && uiMode === 'beginner');
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
    btn.onclick = () => showTab(btn.dataset.tab);
  });
}

function showTab(tab) {
  // 初心者モードでは設定ファイルタブに入れない(URLや過去の状態からの遷移も含めて防止)
  if (uiMode === 'beginner' && tab === 'config') tab = 'gui';

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
  document.getElementById('action-param-form').classList.add('hidden');

  for (const action of plugin.actions) {
    const card = document.createElement('button');
    card.className = 'action-card' + (action.privileged ? ' privileged' : '');
    const cliDisplay = displayCli(action);
    const hint = action.params && action.params.length > 0
      ? '<div class="action-params-hint">✎ 入力が必要</div>'
      : '';
    card.innerHTML = `
      <div class="action-label">${escapeHtml(action.label)}</div>
      <div class="action-cli">${escapeHtml(cliDisplay)}</div>
      ${hint}
    `;
    card.addEventListener('click', () => {
      if (action.params && action.params.length > 0) {
        showParamForm(plugin.id, action);
      } else {
        runAction(plugin.id, action.id);
      }
    });
    container.appendChild(card);
  }
}

// cli配列のプレースホルダー({{domain}}等)を、表示用に<domain>という読みやすい形にする
function displayCli(action) {
  return action.cli
    .map((token) => {
      const m = /^\{\{(\w+)\}\}$/.exec(token);
      return m ? `<${m[1]}>` : token;
    })
    .join(' ');
}

function showParamForm(pluginId, action) {
  document.getElementById('action-result').hidden = true;
  const formBox = document.getElementById('action-param-form');

  const fieldsHtml = action.params
    .map(
      (p) => `
    <div class="param-field" data-field-for="${escapeHtml(p.id)}">
      <label>${escapeHtml(p.label)}${p.required ? ' *' : ''}</label>
      <input type="${p.type === 'email' ? 'email' : 'text'}" data-param-id="${escapeHtml(p.id)}"
             placeholder="${escapeHtml(p.placeholder || '')}" autocomplete="off" />
      <div class="param-error">${escapeHtml(p.errorMessage || '入力内容を確認してください')}</div>
    </div>
  `
    )
    .join('');

  formBox.innerHTML = `
    <div class="param-form-header">${escapeHtml(action.label)} — 値を入力してください</div>
    ${fieldsHtml}
    <div class="param-form-cli-preview" id="param-cli-preview"></div>
    <div class="param-form-actions">
      <button id="param-form-cancel" class="btn-ghost">キャンセル</button>
      <button id="param-form-submit" class="btn-primary">実行</button>
    </div>
  `;
  formBox.classList.remove('hidden');
  formBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const inputs = formBox.querySelectorAll('[data-param-id]');

  function updatePreview() {
    const values = collectParamValues();
    const preview = action.cli
      .map((token) => {
        const m = /^\{\{(\w+)\}\}$/.exec(token);
        if (!m) return token;
        const v = values[m[1]];
        return v ? v : `<${m[1]}>`;
      })
      .join(' ');
    document.getElementById('param-cli-preview').textContent = preview;
  }

  function collectParamValues() {
    const values = {};
    inputs.forEach((el) => {
      values[el.dataset.paramId] = el.value;
    });
    return values;
  }

  inputs.forEach((el) => el.addEventListener('input', updatePreview));
  updatePreview();
  if (inputs[0]) inputs[0].focus();

  document.getElementById('param-form-cancel').addEventListener('click', () => {
    formBox.classList.add('hidden');
  });

  document.getElementById('param-form-submit').addEventListener('click', async () => {
    const values = collectParamValues();
    let hasError = false;

    for (const p of action.params) {
      const v = (values[p.id] || '').trim();
      const fieldEl = formBox.querySelector(`[data-field-for="${cssEscape(p.id)}"]`);
      let invalid = false;
      if (p.required && v === '') invalid = true;
      if (v !== '' && p.pattern && !new RegExp(p.pattern).test(v)) invalid = true;

      fieldEl.classList.toggle('invalid', invalid);
      if (invalid) hasError = true;
    }

    if (hasError) {
      showToast('入力内容を確認してください', 'error');
      return;
    }

    formBox.classList.add('hidden');
    await runAction(pluginId, action.id, values);
  });
}

async function runAction(pluginId, actionId, paramValues) {
  const resultBox = document.getElementById('action-result');
  resultBox.hidden = false;
  resultBox.textContent = '実行中...';

  try {
    const result = await window.pcc.runAction(pluginId, actionId, paramValues);
    if (result.cancelled) {
      resultBox.textContent = 'キャンセルされました。';
      return;
    }
    resultBox.textContent =
      `$ ${result.command}\n` +
      `終了コード: ${result.exitCode}  (${result.durationMs}ms)\n\n` +
      (result.stdout ? `--- stdout ---\n${result.stdout}\n` : '') +
      (result.stderr ? `--- stderr ---\n${result.stderr}\n` : '');
    showToast(
      result.exitCode === 0 ? `実行完了: ${result.command}` : `終了コード${result.exitCode}: ${result.command}`,
      result.exitCode === 0 ? 'success' : 'error'
    );
    refreshOneStatus(pluginId); // 起動/停止等で状態が変わった可能性があるため即時反映
  } catch (err) {
    resultBox.textContent = `エラー: ${err.message}`;
    showToast(`実行エラー: ${err.message}`, 'error');
  }
}

// ---- CLIタブ ----
async function loadCliHistory() {
  const box = document.getElementById('cli-history');
  box.innerHTML = '<div class="muted">読み込み中...</div>';
  const history = await window.pcc.getCliHistory(activePluginId);

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
      <div class="meta">${escapeHtml(entry.timestamp)} ・ <span class="${exitClass}">exit ${escapeHtml(String(entry.exitCode))}</span> ・ ${escapeHtml(String(entry.durationMs))}ms</div>
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
let configOriginalContent = '';
let diffDebounceTimer = null;

async function loadConfig() {
  const plugin = plugins.find((p) => p.id === activePluginId);
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('config-status');
  status.textContent = '';

  if (!plugin.hasConfig) {
    document.getElementById('config-path-label').textContent = 'このプラグインには設定ファイルが定義されていません';
    editor.value = '';
    editor.disabled = true;
    renderConfigDiff();
    document.getElementById('backup-list').innerHTML = '<span class="muted">—</span>';
    return;
  }

  editor.disabled = false;
  editor.value = '読み込み中...';
  const result = await window.pcc.readConfig(activePluginId);
  document.getElementById('config-path-label').textContent = result.path + (result.exists ? '' : '（未作成）');
  editor.value = result.content;
  configOriginalContent = result.content;
  renderConfigDiff();
  loadBackupList();
}

document.getElementById('config-editor').addEventListener('input', () => {
  clearTimeout(diffDebounceTimer);
  diffDebounceTimer = setTimeout(renderConfigDiff, 250);
});

function renderConfigDiff() {
  const box = document.getElementById('config-diff');
  const editor = document.getElementById('config-editor');
  const current = editor.value;

  if (current === configOriginalContent) {
    box.innerHTML = '<span class="muted">変更前と同じ内容です。</span>';
    return;
  }

  const totalLines = current.split('\n').length + configOriginalContent.split('\n').length;
  if (totalLines > 4000) {
    box.innerHTML = '<span class="muted">ファイルが大きいため、差分表示は省略されています。</span>';
    return;
  }

  const diff = window.pcc.diffLines(configOriginalContent, current);
  box.innerHTML = '';
  for (const part of diff) {
    const div = document.createElement('div');
    div.className = `diff-line ${part.type}`;
    div.textContent = part.text;
    box.appendChild(div);
  }
}

// 行単位の差分計算は core/diffLines.js の実装を preload.js 経由で利用する(window.pcc.diffLines)。

document.getElementById('save-config').addEventListener('click', async () => {
  const editor = document.getElementById('config-editor');
  const status = document.getElementById('config-status');
  status.textContent = '保存中...';
  try {
    const result = await window.pcc.writeConfig(activePluginId, editor.value);
    status.textContent = result.backupPath
      ? `保存しました。バックアップ: ${result.backupPath}`
      : `保存しました（新規作成、バックアップなし）`;
    configOriginalContent = editor.value;
    renderConfigDiff();
    loadBackupList();
    showToast('設定ファイルを保存しました', 'success');
  } catch (err) {
    status.textContent = `エラー: ${err.message}`;
    showToast(`保存に失敗しました: ${err.message}`, 'error');
  }
});

// ---- バックアップ一覧・復元(Undo) ----
async function loadBackupList() {
  const box = document.getElementById('backup-list');
  const plugin = plugins.find((p) => p.id === activePluginId);
  if (!plugin.hasConfig) {
    box.innerHTML = '<span class="muted">—</span>';
    return;
  }

  box.innerHTML = '<span class="muted">読み込み中...</span>';
  const backups = await window.pcc.listConfigBackups(activePluginId);

  if (backups.length === 0) {
    box.innerHTML = '<span class="muted">まだバックアップはありません（保存すると自動的に作成されます）。</span>';
    return;
  }

  box.innerHTML = '';
  for (const b of backups) {
    const item = document.createElement('div');
    item.className = 'backup-item';
    item.innerHTML = `
      <span class="backup-time">${escapeHtml(b.savedAt)}</span>
      <button class="backup-restore-btn">この内容に戻す</button>
    `;
    const btn = item.querySelector('.backup-restore-btn');
    btn.addEventListener('click', () => restoreBackup(b.path, btn));
    box.appendChild(item);
  }
}

async function restoreBackup(backupPath, btn) {
  btn.disabled = true;
  btn.textContent = '処理中...';
  try {
    const result = await window.pcc.restoreConfigBackup(activePluginId, backupPath);
    if (result.cancelled) {
      btn.disabled = false;
      btn.textContent = 'この内容に戻す';
      return;
    }
    await loadConfig(); // エディタ・差分・バックアップ一覧をすべて最新化
    showToast('バックアップから復元しました', 'success');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `エラー: ${err.message}`;
    showToast(`復元に失敗しました: ${err.message}`, 'error');
  }
}

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
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    // javascript: 等の危険なスキームを無害化（http/https/mailtoのみ許可）
    const safe = /^(https?:|mailto:)/i.test(url.trim());
    if (!safe) return label; // リンク化せずテキストのみ表示
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

init();
