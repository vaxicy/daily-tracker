import { THEME_PRESETS } from './themes.js';

// 兼容选项页：这些全局由 i18n.js 提供
const _t = (typeof t === 'function') ? t : (key) => key;
let currentThemeId = 'default';
let badgeContentType = 'drink_today';
let customReminders = [];
let editingReminderId = null;
let reminderSelectedIcon = '⏰';

// ==================== Toast ====================
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function showConfirm(message, onOk) {
  if (window.confirm(message)) onOk && onOk();
}

// ==================== 版本号 ====================
document.getElementById('version').textContent = chrome.runtime.getManifest().version;

// ==================== 主题 ====================
const root = document.documentElement;
function applyTheme(themeId) {
  const preset = THEME_PRESETS[themeId];
  if (!preset) return;
  currentThemeId = themeId;
  document.body.setAttribute('data-theme', themeId);
  Object.entries(preset.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.style.background = preset.bgGradient;
  chrome.storage.local.set({ selectedTheme: themeId });
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
}

function renderThemeOptions() {
  const menu = document.getElementById('themeMenu');
  const swatch = document.getElementById('themeSwatch');
  const current = document.getElementById('themeCurrent');
  if (!menu) return;
  menu.innerHTML = '';
  Object.entries(THEME_PRESETS).forEach(([id, p]) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item' + (id === currentThemeId ? ' active' : '');
    item.dataset.theme = id;
    item.innerHTML = `<span class="swatch" style="background:${p.dot || p.vars['--primary']}"></span><span>${_t(p.name)}</span>`;
    item.addEventListener('click', () => {
      currentThemeId = id;
      applyTheme(id);
      renderThemeOptions();
      showToast(_t('toastThemeSwitched', { theme: _t(p.name) }));
    });
    menu.appendChild(item);
  });
  if (swatch) swatch.style.background = THEME_PRESETS[currentThemeId]?.dot || THEME_PRESETS[currentThemeId]?.vars['--primary'];
  if (current) current.textContent = _t(THEME_PRESETS[currentThemeId]?.name || 'themeDefault');
}

function loadTheme() {
  chrome.storage.local.get(['selectedTheme'], (data) => {
    let id = data.selectedTheme || 'default';
    if (!THEME_PRESETS[id]) id = 'default';
    currentThemeId = id;
    applyTheme(id);
    renderThemeOptions();
  });
}

// ==================== 语言 ====================
const LANGS = [
  { id: 'zh', label: 'langZh' },
  { id: 'en', label: 'langEn' },
  { id: 'es', label: 'langEs' },
  { id: 'ja', label: 'langJa' },
  { id: 'ko', label: 'langKo' },
  { id: 'fr', label: 'langFr' },
];

function renderLangOptions() {
  const menu = document.getElementById('langMenu');
  const current = document.getElementById('langCurrent');
  if (!menu) return;
  menu.innerHTML = '';
  LANGS.forEach(l => {
    const item = document.createElement('div');
    item.className = 'dropdown-item' + (l.id === currentLang ? ' active' : '');
    item.dataset.lang = l.id;
    item.textContent = _t(l.label);
    item.addEventListener('click', () => selectLang(l.id));
    menu.appendChild(item);
  });
  if (current) current.textContent = _t('lang' + (currentLang === 'zh' ? 'Zh' : currentLang === 'es' ? 'Es' : currentLang === 'ja' ? 'Ja' : currentLang === 'ko' ? 'Ko' : currentLang === 'fr' ? 'Fr' : 'En'));
}

function selectLang(lang) {
  if (typeof setLanguage === 'function') setLanguage(lang);
  currentLang = lang;
  closeAllDropdowns();
  renderLangOptions();
  renderThemeOptions();
  renderDefaultHomeOptions();
  updateBadgeContentLabel();
  renderModuleToggles();
  renderReminderList();
  applyI18n();
  showToast(_t('toastDefaultLang', { lang: _t('lang' + (lang === 'zh' ? 'Zh' : lang === 'es' ? 'Es' : lang === 'ja' ? 'Ja' : lang === 'ko' ? 'Ko' : lang === 'fr' ? 'Fr' : 'En')) }));
}

// ==================== 默认首页 ====================
const DEFAULT_HOME_ITEMS = [
  { tab: 'eat', icon: '🍽️', nameKey: 'tabNameEat' },
  { tab: 'drink', icon: '💧', nameKey: 'tabNameDrink' },
  { tab: 'poop', icon: '💩', nameKey: 'tabNamePoop' },
  { tab: 'pee', icon: '🚽', nameKey: 'tabNamePee' },
  { tab: 'period', icon: '🩸', nameKey: 'tabNamePeriod' },
];

function renderDefaultHomeOptions() {
  const menu = document.getElementById('defaultHomeMenu');
  const current = document.getElementById('defaultHomeCurrent');
  if (!menu) return;
  chrome.storage.local.get(['defaultTab'], (data) => {
    const def = data.defaultTab || 'drink';
    menu.innerHTML = '';
    DEFAULT_HOME_ITEMS.forEach(item => {
      const el = document.createElement('div');
      el.className = 'dropdown-item' + (item.tab === def ? ' active' : '');
      el.innerHTML = `<span class="swatch" style="background:transparent">${item.icon}</span><span>${_t(item.nameKey)}</span>`;
      el.addEventListener('click', () => {
        chrome.storage.local.set({ defaultTab: item.tab }, () => {
          renderDefaultHomeOptions();
          showToast(_t('toastDefaultPage', { page: _t(item.nameKey) }));
        });
      });
      menu.appendChild(el);
    });
    const selected = DEFAULT_HOME_ITEMS.find(i => i.tab === def) || DEFAULT_HOME_ITEMS[0];
    if (current) current.textContent = _t(selected.nameKey);
  });
}

// ==================== 模块开关 ====================
const MODULES = [
  { key: 'eat', icon: '🍽️', nameKey: 'eatModule' },
  { key: 'drink', icon: '💧', nameKey: 'drinkModule' },
  { key: 'poop', icon: '💩', nameKey: 'poopModule' },
  { key: 'pee', icon: '💧', nameKey: 'peeModule' },
];

function renderModuleToggles() {
  const container = document.getElementById('moduleToggles');
  if (!container) return;
  chrome.storage.local.get(['moduleStates'], (data) => {
    const states = data.moduleStates || { eat: true, drink: true, poop: true, pee: true };
    container.innerHTML = '';
    MODULES.forEach(m => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="row-label">${m.icon} ${_t(m.nameKey)}</div>
        <label class="toggle">
          <input type="checkbox" data-module="${m.key}" ${states[m.key] !== false ? 'checked' : ''} />
          <div class="toggle-track"></div><div class="toggle-thumb"></div>
        </label>`;
      row.querySelector('input').addEventListener('change', (e) => {
        const checked = e.target.checked;
        chrome.storage.local.get(['moduleStates'], (d) => {
          const s = d.moduleStates || { eat: true, drink: true, poop: true, pee: true };
          s[m.key] = checked;
          chrome.storage.local.set({ moduleStates: s }, () => {
            showToast(checked ? _t('moduleShown', { name: _t(m.nameKey) }) : _t('moduleHidden', { name: _t(m.nameKey) }));
          });
        });
      });
      container.appendChild(row);
    });
  });
}

// ==================== 角标设置 ====================
const BADGE_OPTIONS = [
  'drink_today', 'drink_week',
  'poop_today', 'poop_week',
  'pee_today', 'pee_week',
  'meal_today', 'meal_week',
];

function getBadgeI18nKey(val) {
  return 'badgeOpt' + val.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function updateBadgeContentLabel() {
  const current = document.getElementById('badgeContentCurrent');
  if (current) current.textContent = _t(getBadgeI18nKey(badgeContentType));
}

function renderBadgeContentOptions() {
  const menu = document.getElementById('badgeContentMenu');
  if (!menu) return;
  menu.innerHTML = '';
  BADGE_OPTIONS.forEach(val => {
    const item = document.createElement('div');
    item.className = 'dropdown-item' + (val === badgeContentType ? ' active' : '');
    item.textContent = _t(getBadgeI18nKey(val));
    item.addEventListener('click', () => {
      badgeContentType = val;
      chrome.storage.local.set({ badgeContentType: val }, () => {
        updateBadgeContentLabel();
        renderBadgeContentOptions();
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
        closeAllDropdowns();
        showToast(_t('toastSettingsSaved') || '设置已保存');
      });
    });
    menu.appendChild(item);
  });
}

function initBadgeSettings() {
  const toggle = document.getElementById('badgeToggle');
  chrome.storage.local.get(['badgeEnabled', 'badgeContentType'], (data) => {
    if (toggle) toggle.checked = data.badgeEnabled !== false;
    badgeContentType = data.badgeContentType || 'drink_today';
    updateBadgeContentLabel();
    renderBadgeContentOptions();
  });
  if (toggle) {
    toggle.addEventListener('change', () => {
      chrome.storage.local.set({ badgeEnabled: toggle.checked }, () => {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
        showToast(_t('toastSettingsSaved') || '设置已保存');
      });
    });
  }
}

// ==================== 自定义提醒 ====================
const REMINDER_ICONS = ['⏰','💊','💧','🏃','🍽️','🏋️','📿','🧘','🚶','📋','🔔','🎒','🧪','✏️','🏥'];

function loadReminders(cb) {
  chrome.storage.local.get(['customReminders'], (data) => {
    customReminders = data.customReminders || [];
    if (cb) cb();
  });
}

function saveReminders() {
  chrome.storage.local.set({ customReminders });
  chrome.runtime.sendMessage({ type: 'REFRESH_REMINDERS' }).catch(() => {});
}

function renderReminderList() {
  const list = document.getElementById('reminderList');
  if (!list) return;
  if (customReminders.length === 0) {
    list.innerHTML = `<div class="empty">${_t('noReminders')}</div>`;
    return;
  }
  list.innerHTML = customReminders.map(r => `
    <div class="reminder-item" data-id="${r.id}">
      <div class="reminder-item-left">
        <span class="reminder-item-icon">${r.icon || '⏰'}</span>
        <div>
          <div class="reminder-item-label">${_t(r.label)}</div>
          <div class="reminder-item-times">${(r.times || []).map(time => _t('remindAt') + ' ' + time).join('，')}</div>
        </div>
      </div>
      <div class="reminder-actions">
        <button class="icon-btn edit-reminder" data-id="${r.id}" title="${_t('edit')}">✏️</button>
        <button class="icon-btn delete-reminder" data-id="${r.id}" title="${_t('delete')}">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openReminderModal(reminder) {
  editingReminderId = reminder ? reminder.id : null;
  const modal = document.getElementById('reminderModal');
  const title = document.getElementById('reminderModalTitle');
  if (title) title.textContent = _t(reminder ? 'editReminder' : 'addReminder');
  document.getElementById('reminderLabelInput').value = reminder ? reminder.label : '';
  reminderSelectedIcon = reminder ? (reminder.icon || '⏰') : '⏰';
  const enabledInput = document.getElementById('reminderEnabledInput');
  if (enabledInput) enabledInput.checked = reminder ? !!reminder.enabled : true;

  const iconGrid = document.getElementById('reminderIconGrid');
  iconGrid.innerHTML = REMINDER_ICONS.map(ic =>
    `<button type="button" class="${ic === reminderSelectedIcon ? 'active' : ''}" data-icon="${ic}">${ic}</button>`
  ).join('');
  iconGrid.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      reminderSelectedIcon = btn.dataset.icon;
      iconGrid.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  renderReminderTimes(reminder ? (reminder.times || ['08:00']) : ['08:00']);
  if (modal) modal.classList.add('show');
}

function renderReminderTimes(times) {
  const list = document.getElementById('reminderTimesList');
  list.innerHTML = times.map((tm, i) => `
    <div class="time-row">
      <input type="time" class="form-input" value="${tm}" data-idx="${i}" />
      <button type="button" data-idx="${i}">×</button>
    </div>
  `).join('');
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      times.splice(parseInt(btn.dataset.idx), 1);
      renderReminderTimes(times);
    });
  });
  list.dataset.times = JSON.stringify(times);
}

function getReminderTimes() {
  const list = document.getElementById('reminderTimesList');
  return Array.from(list.querySelectorAll('input[type="time"]')).map(inp => inp.value).filter(Boolean);
}

function closeReminderModal() {
  document.getElementById('reminderModal').classList.remove('show');
  editingReminderId = null;
}

function saveReminder() {
  const label = document.getElementById('reminderLabelInput').value.trim();
  if (!label) { showToast(_t('reminderLabelRequired') || '请输入提醒名称'); return; }
  const times = getReminderTimes();
  if (times.length === 0) { showToast(_t('reminderTimeRequired') || '请至少添加一个时间'); return; }
  const enabled = document.getElementById('reminderEnabledInput').checked;

  if (editingReminderId) {
    const idx = customReminders.findIndex(r => r.id === editingReminderId);
    if (idx >= 0) {
      customReminders[idx] = { ...customReminders[idx], label, icon: reminderSelectedIcon, times, enabled };
    }
    showToast(_t('reminderUpdated'));
  } else {
    customReminders.push({ id: 'rem_' + Date.now(), label, icon: reminderSelectedIcon, times, enabled, lastTriggered: {} });
    showToast(_t('reminderAdded'));
  }
  saveReminders();
  renderReminderList();
  closeReminderModal();
}

function initReminders() {
  document.getElementById('addReminderBtn').addEventListener('click', () => openReminderModal(null));
  document.getElementById('reminderModalClose').addEventListener('click', closeReminderModal);
  document.getElementById('reminderModalCancel').addEventListener('click', closeReminderModal);
  document.getElementById('reminderModalConfirm').addEventListener('click', saveReminder);
  document.getElementById('reminderAddTimeBtn').addEventListener('click', () => {
    const times = getReminderTimes();
    times.push('08:00');
    renderReminderTimes(times);
  });
  document.getElementById('reminderList').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-reminder');
    if (editBtn) {
      const r = customReminders.find(x => x.id === editBtn.dataset.id);
      if (r) openReminderModal(r);
      return;
    }
    const delBtn = e.target.closest('.delete-reminder');
    if (delBtn) {
      showConfirm(_t('confirmDeleteReminder'), () => {
        customReminders = customReminders.filter(x => x.id !== delBtn.dataset.id);
        saveReminders();
        renderReminderList();
        showToast(_t('reminderDeleted'));
      });
    }
  });
  document.getElementById('reminderModal').addEventListener('click', (e) => {
    if (e.target.id === 'reminderModal') closeReminderModal();
  });
  loadReminders(() => renderReminderList());
}

// ==================== 数据导出/导入/CSV ====================
function exportBackup() {
  chrome.storage.local.get(null, (data) => {
    const backup = { version: 1, exportTime: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(_t('backupExportSuccess') || '备份导出成功！');
  });
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup || !backup.data || typeof backup.data !== 'object') {
        showToast(_t('backupImportInvalid') || '无效的备份文件');
        return;
      }
      showConfirm(_t('backupImportConfirm'), () => {
        chrome.storage.local.clear(() => {
          chrome.storage.local.set(backup.data, () => {
            showToast(_t('backupImportSuccess') || '备份导入成功！');
            loadTheme();
            loadLanguage(() => renderLangOptions());
            renderDefaultHomeOptions();
            initBadgeSettings();
            renderModuleToggles();
            loadReminders(() => renderReminderList());
          });
        });
      });
    } catch (err) {
      showToast(_t('backupImportInvalid') || '无效的备份文件');
    }
  };
  reader.readAsText(file);
}

function exportCsv(module) {
  const keyMap = { eat: 'mealRecords', drink: 'drinkRecords', poop: 'poopRecords', pee: 'peeRecords', period: 'periodCycles' };
  const key = keyMap[module];
  if (!key) return;
  chrome.storage.local.get([key], (data) => {
    const rec = data[key];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    let rows = [];
    if (module === 'eat') {
      const typeMap = currentLang === 'en' ? { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
        : currentLang === 'ja' ? { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' }
        : currentLang === 'ko' ? { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }
        : currentLang === 'fr' ? { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Encas' }
        : { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      rows.push(['日期','时间','餐型','评分','饱腹度','标签','备注'].map(esc).join(','));
      for (const d in rec || {}) (rec[d] || []).forEach(m => {
        rows.push([d, m.time || '', typeMap[m.type] || m.type || '', m.rating || '', m.fullness || '', (m.tags || []).join('/'), m.remark || ''].map(esc).join(','));
      });
    } else if (module === 'drink') {
      rows.push(['日期','时间'].map(esc).join(','));
      for (const d in rec || {}) (rec[d] || []).forEach(r => rows.push([d, r.time || ''].map(esc).join(',')));
    } else if (module === 'poop' || module === 'pee') {
      rows.push(['日期','时间','量','颜色','类型','备注'].map(esc).join(','));
      for (const d in rec || {}) (rec[d] || []).forEach(r => {
        const tmap = module === 'poop' ? _t('poopAmounts') : _t('peeAmounts');
        const cKey = module === 'poop' ? 'poopColors' : 'peeColors';
        rows.push([d, r.time || '', tmap[r.amount] || r.amount || '', (_t(cKey)[r.color] || r.color || ''), r.bristolType ? `Bristol ${r.bristolType}` : '', r.remark || ''].map(esc).join(','));
      });
    } else if (module === 'period') {
      rows.push(['开始日期','结束日期','持续天数'].map(esc).join(','));
      (rec || []).forEach(c => {
        const dur = c.endDate ? Math.max(1, Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86400000) + 1) : '';
        rows.push([c.startDate || '', c.endDate || '', dur].map(esc).join(','));
      });
    }
    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-tracker-${module}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV ' + _t('backupExportSuccess'));
  });
}

function initBackup() {
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportBackup);
  if (importBtn) importBtn.addEventListener('click', () => importFile && importFile.click());
  if (importFile) importFile.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {
    const mod = window.prompt(_t('csvTitle') + '\neat/drink/poop/pee/period', 'drink');
    if (mod && ['eat','drink','poop','pee','period'].includes(mod)) exportCsv(mod);
  });
}

// ==================== 赞赏码弹窗 ====================
function initDonate() {
  const btn = document.getElementById('donateWechatBtn');
  const overlay = document.getElementById('donateQrOverlay');
  const close = document.getElementById('donateQrClose');
  if (btn && overlay) btn.addEventListener('click', () => overlay.classList.add('show'));
  if (close && overlay) close.addEventListener('click', () => overlay.classList.remove('show'));
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
}

// ==================== 下拉菜单通用行为 ====================
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}

function initDropdowns() {
  document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = trigger.closest('.dropdown');
      const wasOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) closeAllDropdowns();
  });
}

// ==================== 初始化 ====================
function init() {
  loadLanguage(() => {
    applyI18n();
    loadTheme();
    renderLangOptions();
    renderDefaultHomeOptions();
    initBadgeSettings();
    renderModuleToggles();
    initReminders();
    initBackup();
    initDonate();
    initDropdowns();
  });
}

init();
