import { THEME_PRESETS } from './themes.js';
// ==================== 全局工具函数 ====================

// 注意：Chrome Extension 使用 chrome.notifications API（由 manifest.json 声明）
// 不需要使用 Web Notification API (window.Notification)
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// ==================== 通用自定义 tooltip（替代原生 title）====================
let customTooltipEl = null;
let customTooltipTimer = null;
function getCustomTooltip() {
  if (!customTooltipEl) customTooltipEl = document.getElementById("customTooltip");
  return customTooltipEl;
}
function showCustomTooltip(target, text) {
  if (!text) return;
  const tip = getCustomTooltip();
  if (!tip) return;
  clearTimeout(customTooltipTimer);
  tip.textContent = text;
  tip.classList.add("show");
  // 临时显示以获取尺寸
  tip.style.visibility = "hidden";
  const tipRect = tip.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  let top = rect.top - tipRect.height - 8;
  // 顶部空间不足时才翻到下方，避免 tooltip 被窗口裁切
  if (top < 8 && rect.bottom + 8 + tipRect.height <= window.innerHeight) {
    top = rect.bottom + 8;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  if (top < 8) top = 8;
  tip.style.left = left + "px";
  tip.style.top = top + "px";
  tip.style.visibility = "";
}
function hideCustomTooltip() {
  const tip = getCustomTooltip();
  if (!tip) return;
  customTooltipTimer = setTimeout(() => tip.classList.remove("show"), 120);
}
// 事件委托：悬浮带 data-tooltip 的元素时显示
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-tooltip], [data-i18n-range]");
  if (el) {
    const raw = el.getAttribute("data-tooltip") || el.getAttribute("data-i18n-range");
    const text = (typeof t === "function") ? t(raw) : raw;
    showCustomTooltip(el, text);
  }
});
document.addEventListener("mouseout", (e) => {
  const el = e.target.closest("[data-tooltip], [data-i18n-range]");
  if (el) hideCustomTooltip();
});


// 内联确认弹窗（替代浏览器原生 confirm）
function showConfirm(message, onOk, onCancel, title) {
  const overlay = document.getElementById("inlineConfirm");
  const titleEl = document.getElementById("inlineConfirmTitle");
  const msgEl = document.getElementById("inlineConfirmMsg");
  const okBtn = document.getElementById("inlineConfirmOk");
  const cancelBtn = document.getElementById("inlineConfirmCancel");
  if (!overlay || !msgEl || !okBtn || !cancelBtn) {
    if (window.confirm(message)) { if (onOk) onOk(); } else { if (onCancel) onCancel(); }
    return;
  }
  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  titleEl.textContent = title ? title : (t("confirmTitle") || "确认操作");
  msgEl.textContent = message;
  overlay.classList.add("show");
  function close(result) {
    overlay.classList.remove("show");
    if (result && onOk) onOk();
    else if (!result && onCancel) onCancel();
  }
  newOk.addEventListener("click", () => close(true));
  newCancel.addEventListener("click", () => close(false));
  overlay.onclick = (e) => { if (e.target === overlay) close(false); };
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 数据迁移：将旧的 fullness 值(1/2/3)迁移到新的值(1/2/3/4/5)
function migrateFullnessData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      let needsMigration = false;
      
      // 遍历所有日期的记录
      for (const dateStr in records) {
        records[dateStr].forEach(meal => {
          if (meal.fullness && meal.fullness >= 1 && meal.fullness <= 3) {
            // 旧数据：1=饿, 2=刚好, 3=撑
            // 新数据：1=很饿, 2=有点饿, 3=刚好, 4=有点撑, 5=很撑
            const oldValue = meal.fullness;
            const mapping = { 1: 2, 2: 3, 3: 4 }; // 旧值映射到新值（取中间偏左）
            meal.fullness = mapping[oldValue];
            needsMigration = true;
          }
        });
      }
      
      // 如果有需要迁移的数据，保存回 storage
      if (needsMigration) {
        persistRecords('mealRecords', records, () => {
          console.log("Fullness data migrated successfully");
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

const CN_NUMS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
function toChineseNum(n) {
  if (n <= 10) return CN_NUMS[n];
  if (n < 20) return "十" + (n % 10 === 0 ? "" : CN_NUMS[n % 10]);
  return CN_NUMS[Math.floor(n / 10)] + "十" + (n % 10 === 0 ? "" : CN_NUMS[n % 10]);
}

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: firstDay, end: lastDay };
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return t("dateDisplay", { y, m: parseInt(m), d: parseInt(d) });
}

// ==================== 公共存储操作 ====================
// 通用删除记录：从指定 key 的存储中删除某天某条记录
// callback(records, targetDate, isEmpty) 在存储写入完成后调用
function _deleteRecordFromStorage(key, targetDate, idx, callback) {
  chrome.storage.local.get([key], (data) => {
    const records = data[key] || {};
    if (!records[targetDate]) return callback(null);
    records[targetDate].splice(idx, 1);
    const isEmpty = records[targetDate].length === 0;
    if (isEmpty) delete records[targetDate];
    chrome.storage.local.set({ [key]: records }, () => {
      showToast(t("toastDeleteSuccess"));
      callback(records, targetDate, isEmpty);
    });
  });
}

// ==================== 页面切换 ====================
let currentTab = "eat";

let isFirstTabSwitch = true;
let isSwitching = false;

function switchTab(tab, force = false) {
  if (!force && !isFirstTabSwitch && tab === currentTab) return;
  if (isSwitching) return; // 防止动画期间重复切换
  isSwitching = true;
  const oldTab = currentTab;
  currentTab = tab;

  // 导航高亮
    ["eat", "drink", "poop", "pee", "period"].forEach(tabName => {
      const navEl = document.getElementById(`nav${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (navEl) {
        navEl.classList.toggle("active", tabName === tab);
      }
    });

  const oldPage = document.getElementById(`page${oldTab.charAt(0).toUpperCase() + oldTab.slice(1)}`);
  const newPage = document.getElementById(`page${tab.charAt(0).toUpperCase() + tab.slice(1)}`);

  if (isFirstTabSwitch) {
    // 首次加载：无动画
    isFirstTabSwitch = false;
    oldPage.classList.remove("active");
    newPage.classList.add("active");
    isSwitching = false;
  } else {
    // 添加退出动画
    oldPage.style.transition = "opacity 0.15s ease, transform 0.15s ease";
    oldPage.style.opacity = "0";
    oldPage.style.transform = "translateX(-12px)";

    setTimeout(() => {
      oldPage.classList.remove("active");
      oldPage.style.opacity = "";
      oldPage.style.transform = "";
      oldPage.style.transition = "";

      // 显示新页面并添加进入动画
      newPage.classList.add("active");
      newPage.style.opacity = "0";
      newPage.style.transform = "translateX(12px)";
      newPage.style.transition = "none";

      requestAnimationFrame(() => {
        newPage.style.transition = "opacity 0.2s ease, transform 0.2s ease";
        newPage.style.opacity = "1";
        newPage.style.transform = "translateX(0)";
        // 动画完成后重置标志
        setTimeout(() => { isSwitching = false; }, 200);
      });
    }, 140);
  }

  // 初始化对应页面
  if (tab === "eat") initEatPage();
  if (tab === "drink") { updateDrinkUI(); updateDrinkStats(); renderDrinkCalendar(); }
  if (tab === "poop") {
    renderBristolMainSelector();
    renderPoopAmountSelector();
    clearPoopAmount();
    renderPoopColorSelector();
    clearPoopColor();
    renderPoopCalendar();
    updatePoopTodayStatus();
    updatePoopStats();
  }
  if (tab === "pee") {
    renderPeeCalendar();
    updatePeeTodayStatus();
    updatePeeStats();
    renderPeeAmountSelector();
    clearPeeAmount();
    renderPeeColorSelector();
    clearPeeColor();
  }
  if (tab === "period") {
    updatePeriodToggleBtn();
    renderPeriodCalendar();
    updatePeriodStats();
    renderPeriodBarChart();
    renderPeriodCycleTable();
    initPeriodMoodBtns();
    initPeriodSymptomBtns();
    initPeriodBloodColorBtns();
  }
}

// ==================== 吃 - 饮食记录 ====================
const mealInput = document.getElementById("mealInput");
const mealTypeSelect = document.getElementById("mealType");
const addMealBtn = document.getElementById("addMealBtn");
const mealRecordsList = document.getElementById("mealRecordsList");
const mealCount = document.getElementById("mealCount");
const mealRating = document.getElementById("mealRating");
const mealRatingText = document.getElementById("mealRatingText");
const mealTimeInput = document.getElementById("mealTimeInput");
const applyMealTimeBtn = document.getElementById("applyMealTimeBtn");

// 饮食默认时间（早餐/午餐/晚餐/加餐）
let mealDefaultTimes = { breakfast: "07:30", lunch: "12:00", dinner: "18:30", snack: "15:00" };

function loadMealDefaultTimes(callback) {
  chrome.storage.local.get(["mealDefaultTimes"], (data) => {
    if (data.mealDefaultTimes) {
      mealDefaultTimes = { ...mealDefaultTimes, ...data.mealDefaultTimes };
    } else {
      // 首次使用，保存默认值
      chrome.storage.local.set({ mealDefaultTimes });
    }
    if (callback) callback();
  });
}

// 根据当前餐次应用默认时间到时间输入框
function applyMealDefaultTimeToInput(type) {
  if (!mealTimeInput) return;
  const mealType = type || (mealTypeSelect ? mealTypeSelect.value : "breakfast");
  mealTimeInput.value = mealDefaultTimes[mealType] || "12:00";
}

// 餐次切换时自动应用默认时间
if (mealTypeSelect) {
  mealTypeSelect.addEventListener("change", (e) => {
    applyMealDefaultTimeToInput(e.target.value);
  });
}

// 打开默认时间设置弹窗
function openMealDefaultSettingsModal() {
  const modal = document.getElementById("mealDefaultTimeModal");
  if (!modal) return;
  
  // 填充当前默认值
  const ids = { breakfast: "modalDefaultTimeBreakfast", lunch: "modalDefaultTimeLunch", dinner: "modalDefaultTimeDinner", snack: "modalDefaultTimeSnack" };
  Object.entries(ids).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.value = mealDefaultTimes[key] || "12:00";
  });
  
  modal.classList.add("active");
}

// 关闭默认时间设置弹窗
function closeMealDefaultSettingsModal() {
  const modal = document.getElementById("mealDefaultTimeModal");
  if (modal) modal.classList.remove("active");
}

// 保存默认时间设置
function saveMealDefaultSettings() {
  const ids = { breakfast: "modalDefaultTimeBreakfast", lunch: "modalDefaultTimeLunch", dinner: "modalDefaultTimeDinner", snack: "modalDefaultTimeSnack" };
  Object.entries(ids).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) mealDefaultTimes[key] = el.value;
  });
  chrome.storage.local.set({ mealDefaultTimes });
  
  // 如果当前时间输入框显示的是某个餐次的默认时间，则更新它
  applyMealDefaultTimeToInput();
  
  closeMealDefaultSettingsModal();
  showToast(t("toastSettingsSaved") || "设置已保存");
}

// 初始化：绑定设置按钮事件
const openMealDefaultSettingsBtn = document.getElementById("openMealDefaultSettings");
if (openMealDefaultSettingsBtn) {
  openMealDefaultSettingsBtn.addEventListener("click", openMealDefaultSettingsModal);
}

let currentMealRating = 0; // 当前选中的评分

// 饱腹感选择器
const fullnessBtns = document.getElementById("fullnessBtns");
let selectedFullness = 0; // 0=未选, 1=饿, 2=刚好, 3=撑

// 饮食快速标签
const mealTagsRow = document.getElementById("mealTagsRow");
const mealTagsWrap = document.getElementById("mealTagsWrap");
const mealTagsHeader = document.getElementById("mealTagsHeader");
const mealTagsToggle = document.getElementById("mealTagsToggle");
let selectedMealTags = [];
let customMealTags = []; // {name, emoji}
let selectedTagEmoji = "";
let isMealTagsCollapsed = false;

// 饮食统计模式
let eatStatsMode = "week";

// 渲染饱腹感选择器
function renderFullnessSelector() {
  const levels = t("fullnessLevels") || [];
  if (!fullnessBtns) return;
  fullnessBtns.innerHTML = levels.map((label, i) =>
    `<button class="fullness-btn" data-level="${i+1}">${label}</button>`
  ).join("");

  fullnessBtns.querySelectorAll(".fullness-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const level = parseInt(btn.dataset.level);
      if (selectedFullness === level) {
        selectedFullness = 0;
        btn.classList.remove("active");
      } else {
        selectedFullness = level;
        fullnessBtns.querySelectorAll(".fullness-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });
}

// 渲染饮食快速标签
function renderMealTags() {
  const tags = t("mealTags") || [];
  const emojis = t("mealTagEmojis") || [];
  if (!mealTagsRow) return;

  // 记住折叠状态，渲染后恢复
  const wasCollapsed = isMealTagsCollapsed;

  let html = tags.map((tag, i) =>
    `<button class="meal-tag-btn ${selectedMealTags.includes(tag) ? 'active' : ''}" data-tag="${tag}" data-idx="${i}">${emojis[i] || ''} ${tag}</button>`
  ).join("");

  // 自定义标签
  customMealTags.forEach((ct, i) => {
    html += `<button class="meal-tag-btn ${selectedMealTags.includes(ct.name) ? 'active' : ''}" data-tag="${ct.name}" data-custom-idx="${i}">${ct.emoji} ${ct.name}<span class="meal-tag-del" data-del-idx="${i}">&times;</span></button>`;
  });

  // + 自定义按钮
  html += `<button class="meal-tag-add-btn" id="addCustomTagBtn">${t('customTag') || '\u81EA\u5B9A\u4E49'}</button>`;

  mealTagsRow.innerHTML = html;

  // 恢复折叠状态
  if (wasCollapsed) mealTagsRow.style.display = "none";

  // 预设标签点击
  mealTagsRow.querySelectorAll(".meal-tag-btn:not([data-custom-idx])").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const idx = selectedMealTags.indexOf(tag);
      if (idx >= 0) {
        selectedMealTags.splice(idx, 1);
        btn.classList.remove("active");
      } else {
        selectedMealTags.push(tag);
        btn.classList.add("active");
      }
    });
  });

  // 自定义标签点击
  mealTagsRow.querySelectorAll(".meal-tag-btn[data-custom-idx]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.classList.contains("meal-tag-del")) return;
      const tag = btn.dataset.tag;
      const idx = selectedMealTags.indexOf(tag);
      if (idx >= 0) {
        selectedMealTags.splice(idx, 1);
        btn.classList.remove("active");
      } else {
        selectedMealTags.push(tag);
        btn.classList.add("active");
      }
    });
  });

  // 删除自定义标签
  mealTagsRow.querySelectorAll(".meal-tag-del").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.delIdx);
      const removedName = customMealTags[idx]?.name;
      customMealTags.splice(idx, 1);
      // 同时从已选中移除
      const si = selectedMealTags.indexOf(removedName);
      if (si >= 0) selectedMealTags.splice(si, 1);
      saveCustomTags();
      renderMealTags();
    });
  });

  // + 按钮
  const addBtn = document.getElementById("addCustomTagBtn");
  if (addBtn) {
    addBtn.addEventListener("click", openTagModal);
  }

  // 同步折叠状态
  if (mealTagsToggle) {
    mealTagsToggle.textContent = isMealTagsCollapsed ? "▶" : "▼";
  }
  if (isMealTagsCollapsed && mealTagsRow) {
    mealTagsRow.style.display = "none";
  }
}

function clearMealTags() {
  selectedMealTags = [];
  mealTagsRow?.querySelectorAll(".meal-tag-btn").forEach(b => b.classList.remove("active"));
}

// 备注关键词自动识别标签
function autoDetectTags(remark) {
  if (!remark) return [];
  const kwMap = {
    "中式": ["米饭", "面条", "馒头", "炒菜", "中餐", "家常"],
    "西式": ["汉堡", "披萨", "牛排", "意面", "沙拉", "三明治"],
    "日式": ["寿司", "拉面", "刺身", "日料", "天妇罗"],
    "韩式": ["韩", "泡菜", "石锅", "拌饭", "烤肉", "部队锅"],
    "泰式": ["泰", "冬阴功", "咖喱", "芒果糯米饭"],
    "东南亚": ["东南亚", "越南", "印尼", "马来西亚", "新加坡", "咖喱"],
    "清淡": ["粥", "清汤", "蒸", "煮", "清淡"],
    "油腻": ["炸", "煎", "红烧", "油腻", "火锅"],
    "素食": ["素", "蔬菜", "豆腐", "斋"],
    "海鲜": ["鱼", "虾", "蟹", "贝", "海鲜", "刺身"],
    "烧烤": ["烧烤", "烤串", "烤肉", "BBQ", "bbq"],
    "外卖": ["外卖", "美团", "饿了么", "配送"],
    "自炊": ["自己做的", "在家做", "自制"],
    "路边摊": ["路边摊", "小摊", "摆摊", "夜市"],
    "夜宵": ["夜宵", "宵夜", "深夜"],
    "零食": ["零食", "薯片", "饼干", "坚果", "巧克力"]
  };
  const autoTags = [];
  const lowerRemark = remark.toLowerCase();
  Object.keys(kwMap).forEach(tag => {
    if (kwMap[tag].some(kw => lowerRemark.includes(kw))) {
      autoTags.push(tag);
    }
  });
  // 自定义标签：用名称本身做关键词匹配
  customMealTags.forEach(ct => {
    if (lowerRemark.includes(ct.name.toLowerCase())) {
      autoTags.push(ct.name);
    }
  });
  return autoTags;
}

// 初始化饮食页面
/**
 * 根据当前时间判断餐次
 * 早餐 04:00-10:00、午餐 10:00-15:00、晚餐 15:00-21:00、加餐 21:00-04:00
 */
function getCurrentMealTypeByTime() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 21) return "dinner";
  return "snack";
}

async function initEatPage() {
  // 先迁移旧数据，等待完成后再渲染
  await migrateFullnessData();

  // 加载饮食默认时间
  await new Promise(resolve => loadMealDefaultTimes(resolve));

  renderFullnessSelector();
  loadCustomTags(() => {
    renderMealTags();
  });
  // 快捷标签折叠/展开 — JS 直接控制 display，不依赖 CSS 类
  function toggleMealTagsCollapse() {
    isMealTagsCollapsed = !isMealTagsCollapsed;
    if (mealTagsRow) mealTagsRow.style.display = isMealTagsCollapsed ? "none" : "";
    if (mealTagsToggle) mealTagsToggle.textContent = isMealTagsCollapsed ? "▶" : "▼";
  }

  if (mealTagsToggle) {
    mealTagsToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMealTagsCollapse();
    });
  }

  // 点击标题文字也能折叠
  if (mealTagsHeader) {
    mealTagsHeader.addEventListener("click", (e) => {
      if (e.target === mealTagsHeader || e.target.closest('span[data-i18n="mealTagsLabel"]')) {
        e.preventDefault();
        toggleMealTagsCollapse();
      }
    });
  }

  // 根据当前时间自动识别餐次
  const autoMealType = getCurrentMealTypeByTime();
  if (mealTypeSelect) {
    mealTypeSelect.value = autoMealType;
  }

  // 初始化时间输入框为当前餐次的默认时间
  applyMealDefaultTimeToInput();

  renderEatCalendar();
  updateMealRecords();
  renderEatStats();
}

// 自定义标签弹窗
function openTagModal() {
  const modal = document.getElementById("tagModal");
  const emojiGrid = document.getElementById("emojiGrid");
  const nameInput = document.getElementById("tagNameInput");
  if (!modal || !emojiGrid) return;

  const emojis = ["🍜","🍲","🥗","🍕","🥪","🌮","🌯","🍛","🍝","🍣","🍤","🍗","🍖","🥩","🥓","🍳","🧀","🥖","🥨","🍞","🥐","🥯","🧇","🥞","🍩","🍪","🍫","🍬","🍭","🍮","🍰","🧁","🥧","🍦","🍨","🍧","🍡","🍢","🥟","🥠","🥡","🍱","🍘","🍙","🍚","🍠","🥮","🎂","🍿","🌰","🥜","🍯","🥛","☕","🍵","🧃","🥤","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾"];

  selectedTagEmoji = "";
  if (nameInput) nameInput.value = "";

  emojiGrid.innerHTML = emojis.map(e =>
    `<button class="emoji-btn" data-emoji="${e}">${e}</button>`
  ).join("");

  emojiGrid.querySelectorAll(".emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      emojiGrid.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedTagEmoji = btn.dataset.emoji;
    });
  });

  modal.classList.add("active");
}

function closeTagModal() {
  const modal = document.getElementById("tagModal");
  if (modal) modal.classList.remove("active");
  selectedTagEmoji = "";
}

function confirmAddCustomTag() {
  const nameInput = document.getElementById("tagNameInput");
  const name = nameInput ? nameInput.value.trim() : "";

  if (!name) {
    showToast(t("tagNameRequired") || "请输入标签名称");
    return;
  }
  if (!selectedTagEmoji) {
    showToast(t("emojiRequired") || "请选择一个 emoji");
    return;
  }
  if (name.length > 6) {
    showToast(t("tagNameTooLong") || "标签名称最多6个字");
    return;
  }

  const allPresetTags = t("mealTags") || [];
  if (allPresetTags.includes(name)) {
    showToast(t("tagExists") || "标签已存在");
    return;
  }
  if (customMealTags.some(tag => tag.name === name)) {
    showToast(t("tagExists") || "标签已存在");
    return;
  }

  customMealTags.push({ name, emoji: selectedTagEmoji });
  saveCustomTags();
  renderMealTags();
  closeTagModal();
  showToast(t("tagAdded") || "标签已添加");
}

function loadCustomTags(cb) {
  chrome.storage.local.get(["customMealTags"], (data) => {
    customMealTags = data.customMealTags || [];
    if (cb) cb();
  });
}

function saveCustomTags() {
  chrome.storage.local.set({ customMealTags });
}

// 评价文本映射（支持半星：0.5~5，共10档）
function getRatingTextMap() {
  const texts = t("ratingTexts") || [];
  return {
    0: t("ratingNone"),
    0.5: "😞 " + (texts[0] || ""),
    1: "😞 " + (texts[1] || ""),
    1.5: "😐 " + (texts[2] || ""),
    2: "😐 " + (texts[3] || ""),
    2.5: "😊 " + (texts[4] || ""),
    3: "😊 " + (texts[5] || ""),
    3.5: "😄 " + (texts[6] || ""),
    4: "😄 " + (texts[7] || ""),
    4.5: "🤩 " + (texts[8] || ""),
    5: "🤩 " + (texts[9] || "")
  };
}

// 根据评分值计算评价文本
function getRatingText(rating) {
  if (!rating || rating === 0) return t("ratingNone");
  return getRatingTextMap()[rating] || t("ratingNone");
}

// 生成5颗星的显示HTML（支持半星）
function getRatingStarsHtml(rating) {
  if (!rating || rating === 0) return "";
  const starSvg = '<svg viewBox="0 0 24 24" width="12" height="12" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  let html = '<span class="rating-stars-display" style="display:inline-flex;align-items:center;gap:2px;">';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      html += '<span style="color:#F59E0B;line-height:0;">' + starSvg + '</span>';
    } else if (i - 0.5 === rating) {
      html += '<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;color:#e0e0e0;line-height:0;">' + starSvg + '<span style="position:absolute;top:0;left:0;color:#F59E0B;line-height:0;overflow:hidden;width:50%;height:100%;display:flex;align-items:center;">' + starSvg + '</span></span>';
    } else {
      html += '<span style="color:#e0e0e0;line-height:0;">' + starSvg + '</span>';
    }
  }
  html += '</span>';
  return html;
}

// 星级评分事件处理（5颗星，支持半星）
if (mealRating) {
  const stars = mealRating.querySelectorAll(".star");

  // 更新星星显示（实际选中状态）
  function updateStarsDisplay(rating) {
    stars.forEach((star, idx) => {
      const starValue = idx + 1;
      const fill = star.querySelector(".fill");

      if (rating === 0) {
        fill.style.clipPath = "inset(0 100% 0 0)";
      } else if (starValue <= Math.floor(rating)) {
        fill.style.clipPath = "inset(0 0% 0 0)";
      } else if (starValue - 0.5 === rating) {
        fill.style.clipPath = "inset(0 50% 0 0)";
      } else {
        fill.style.clipPath = "inset(0 100% 0 0)";
      }
    });
  }

  stars.forEach((star, idx) => {
    // 鼠标移动时判断是左半边还是右半边，实时预览
    star.addEventListener("mousemove", (e) => {
      const rect = star.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      const rating = isLeftHalf ? (idx + 0.5) : (idx + 1);

      // 预览效果：临时设置填充
      stars.forEach((s, i) => {
        const starValue = i + 1;
        const fill = s.querySelector(".fill");

        if (starValue <= Math.floor(rating)) {
          fill.style.clipPath = "inset(0 0% 0 0)";
        } else if (starValue - 0.5 === rating) {
          fill.style.clipPath = "inset(0 50% 0 0)";
        } else {
          fill.style.clipPath = "inset(0 100% 0 0)";
        }
      });
    });

    // 点击时设置评分
    star.addEventListener("click", (e) => {
      const rect = star.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      const rating = isLeftHalf ? (idx + 0.5) : (idx + 1);

      currentMealRating = currentMealRating === rating ? 0 : rating;
      updateStarsDisplay(currentMealRating);
      mealRatingText.textContent = getRatingText(currentMealRating);
    });
  });

  // 鼠标离开时恢复已选中的状态
  mealRating.addEventListener("mouseleave", () => {
    updateStarsDisplay(currentMealRating);
  });
}

function updateMealRecords() {
  const today = getToday();
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    const todayMeals = records[today] || [];

    mealCount.textContent = todayMeals.length;

    if (todayMeals.length === 0) {
      mealRecordsList.innerHTML = '<div class="record-empty" style="text-align:center;color:var(--muted);padding:10px;">' + t("noMeal") + '</div>';
    } else {
      mealRecordsList.innerHTML = todayMeals.map((meal, index) => {
        const typeLabel = { breakfast: t("breakfast"), lunch: t("lunch"), dinner: t("dinner"), snack: t("snack") };
        const ratingStarsHtml = meal.rating ? getRatingStarsHtml(meal.rating) : "";
        const remarkHtml = meal.remark ? `<div class="meal-remark" style="font-size:10px;color:var(--muted);margin-top:3px;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;"><span>📝</span><span>${meal.remark}</span></div>` : "";
        const ratingHtml = meal.rating ? `<span style="letter-spacing:0px;font-size:9px;display:inline-flex;align-items:center;gap:4px;">${ratingStarsHtml}<span>${getRatingText(meal.rating)}</span></span>` : "";

        // 饱腹感显示
        const fullnessLevels = t("fullnessLevels") || [];
        const fullnessHtml = meal.fullness ? `<span style="color:var(--muted);">🍽️ ${fullnessLevels[meal.fullness - 1] || ""}</span>` : "";

        // 标签显示（手动 + 自动识别）
        const tagsHtml = meal.tags && meal.tags.length > 0 ? meal.tags.map(tag => `<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);color:var(--eat);font-size:10px;">${tag}</span>`).join("") : "";

        // 合并评分、饱腹感、标签到一行
        const metaParts = [ratingHtml, fullnessHtml, tagsHtml].filter(Boolean);
        const metaHtml = metaParts.length > 0 ? `<div class="meal-meta">${metaParts.join("")}</div>` : "";

        return `
          <div class="meal-item" data-index="${index}">
            <div class="meal-item-header">
              <span class="meal-type-tag ${meal.type}">${typeLabel[meal.type]}</span>
              <span class="meal-time">${meal.time}</span>
              <div class="meal-actions">
                <button class="meal-action-btn edit-meal" data-index="${index}" data-tooltip="${t('editTitle')}">✏️</button>
                <button class="meal-action-btn delete-meal" data-index="${index}" data-tooltip="${t('deleteTitle')}">🗑️</button>
              </div>
            </div>
            <span class="meal-content">${meal.content}</span>
            ${remarkHtml}
            ${metaHtml}
          </div>
        `;
      }).join("");

    }
  });
}

// 渲染饮食统计
function renderEatStats() {
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    const today = getToday();
    let count = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    const typeDist = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    let streak = 0;

    if (eatStatsMode === "week") {
      const range = getWeekRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        dayRecords.forEach(rec => {
          if (rec.rating) { ratingSum += rec.rating; ratingCount++; }
          if (rec.type) typeDist[rec.type] = (typeDist[rec.type] || 0) + 1;
        });
        cur.setDate(cur.getDate() + 1);
      }
      document.getElementById("eatStatsLabel").textContent = t('eatWeek');
    } else {
      const range = getMonthRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        dayRecords.forEach(rec => {
          if (rec.rating) { ratingSum += rec.rating; ratingCount++; }
          if (rec.type) typeDist[rec.type] = (typeDist[rec.type] || 0) + 1;
        });
        cur.setDate(cur.getDate() + 1);
      }
      document.getElementById("eatStatsLabel").textContent = t('eatMonth');
    }

    document.getElementById("eatStatsCount").textContent = count;

    // 平均评分
    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : "--";
    const typeLabel = { breakfast: t("breakfast"), lunch: t("lunch"), dinner: t("dinner"), snack: t("snack") };
    const typeStr = Object.keys(typeDist).filter(k => typeDist[k] > 0).map(k => `${typeLabel[k]}:${typeDist[k]}`).join(" | ");

    // 连续记录天数
    const d = new Date(today);
    while (true) {
      const ds = formatDate(d);
      if (records[ds] && records[ds].length > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    const detailEl = document.getElementById("eatStatsDetail");
    if (detailEl) {
      let row1 = "";
      let row2 = "";
      if (ratingCount > 0) {
        row1 += `<span class="eat-stat-tag">${t('eatStatAvgRating')}: <b>${avgRating}</b></span>`;
      }
      if (streak > 0) {
        row1 += `<span class="eat-stat-tag">${t('eatStatStreak')}: <b>${streak}</b> ${t('eatStatDays')}</span>`;
      }
      if (typeStr) {
        row2 += `<span class="eat-stat-tag eat-stat-tag-wide">${t('eatStatTypeDist')}: ${typeStr}</span>`;
      }
      detailEl.innerHTML = (row1 ? `<div class="eat-stats-row">${row1}</div>` : "") + (row2 ? `<div class="eat-stats-row">${row2}</div>` : "");
    }
  });
}

// 饮食统计切换
const eatWeekBtn = document.getElementById("eatWeekBtn");
const eatMonthBtn = document.getElementById("eatMonthBtn");

if (eatWeekBtn) {
  eatWeekBtn.addEventListener("click", () => {
    eatStatsMode = "week";
    eatWeekBtn.classList.add("active");
    eatMonthBtn.classList.remove("active");
    renderEatStats();
  });
}

if (eatMonthBtn) {
  eatMonthBtn.addEventListener("click", () => {
    eatStatsMode = "month";
    eatMonthBtn.classList.add("active");
    eatWeekBtn.classList.remove("active");
    renderEatStats();
  });
}

addMealBtn.addEventListener("click", () => {
  const content = mealInput.value.trim();
  if (!content) {
    showToast(t("toastInputMeal"));
    return;
  }

  const today = getToday();
  // 时间自动取当前时间，不再需要手动选择
  const time = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  const type = mealTypeSelect.value;
  const remark = "";  // 备注功能移至编辑弹窗
  const rating = currentMealRating;

  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    if (!records[today]) records[today] = [];

    // 自动识别标签 + 手动选中的标签
    const autoTags = autoDetectTags(remark);
    const allTags = [...new Set([...selectedMealTags, ...autoTags])];

    records[today].push({
      content,
      time,
      type,
      remark,
      rating,
      fullness: selectedFullness || undefined,
      tags: allTags.length > 0 ? allTags : undefined,
      timestamp: Date.now()
    });

    persistRecords('mealRecords', records, () => {
      mealInput.value = "";
      currentMealRating = 0;
      if (mealRating) {
        mealRating.querySelectorAll(".star").forEach(s => {
          s.classList.remove("active");
          s.style.opacity = "0.3";
        });
      }
      if (mealRatingText) mealRatingText.textContent = t('ratingNone');

      selectedFullness = 0;
      clearMealTags();
      if (fullnessBtns) fullnessBtns.querySelectorAll(".fullness-btn").forEach(b => b.classList.remove("active"));
      
      renderEatCalendar();
      updateMealRecords();
      renderEatStats();
      showToast(t("toastMealAdded"));
    });
  });
});

mealInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addMealBtn.click();
});

// ==================== 编辑弹窗 ====================
const editModal = document.getElementById("editModal");
const editModalTitle = document.getElementById("editModalTitle");
const editModalBody = document.getElementById("editModalBody");
const editModalClose = document.getElementById("editModalClose");

let currentEditDate = null;
let currentEditType = null;

editModalClose.addEventListener("click", () => hideEditModal());
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) hideEditModal();
});

function showEditModal(title, dateStr, type) {
  currentEditDate = dateStr;
  currentEditType = type;
  editModalTitle.textContent = title;
  editModal.classList.add("show");
}

function hideEditModal() {
  editModal.classList.remove("show");
  currentEditDate = null;
  currentEditType = null;
}

// ==================== 吃 - 日历 ====================
const eatCalendarDays = document.getElementById("eatCalendarDays");
const eatCalendarTitle = document.getElementById("eatCalendarTitle");
let eatYear = new Date().getFullYear();
let eatMonth = new Date().getMonth();
let eatTooltipTimeout = null;

function renderEatCalendar() {
  const firstDay = new Date(eatYear, eatMonth, 1);
  const lastDay = new Date(eatYear, eatMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  eatCalendarTitle.textContent = t("yearMonth", { y: eatYear, m: eatMonth + 1 });
  eatCalendarDays.innerHTML = "";
  
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    const today = getToday();
    
    for (let i = 0; i < startWeekday; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      emptyCell.style.width = "36px";
      emptyCell.style.height = "36px";
      eatCalendarDays.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cell = document.createElement("div");
      const dateStr = `${eatYear}-${String(eatMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.textContent = day;
      cell.className = "day-cell";
      cell.dataset.date = dateStr;
      if (dateStr === today) cell.classList.add("today");
      if (records[dateStr] && records[dateStr].length > 0) {
        cell.classList.add("has-eat");
        // 按餐次添加着色类
        const types = [...new Set(records[dateStr].map(r => r.type))];
        if (types.length === 1) {
          cell.classList.add("meal-type-" + types[0]);
        } else if (types.length > 1) {
          cell.classList.add("meal-type-multi");
        }
      }
      cell.addEventListener("mouseenter", (e) => showEatTooltip(e, dateStr));
      cell.addEventListener("mouseleave", hideEatTooltip);
      cell.addEventListener("click", () => {
        hideEatTooltip();
        showEatEditModal(dateStr, records[dateStr] || []);
      });
      eatCalendarDays.appendChild(cell);
    }
  });
}

function showEatEditModal(dateStr, dayRecords) {
  const isToday = dateStr === getToday();
  const typeLabel = { breakfast: t("breakfast"), lunch: t("lunch"), dinner: t("dinner"), snack: t("snack") };
  showEditModal("🍽️ " + formatDateDisplay(dateStr) + " " + t("mealEditTitleSuffix"), dateStr, "eat");
  
  // 如果没有记录，显示添加表单
  if (!dayRecords || dayRecords.length === 0) {
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">${t('noMeal')}</div>
      <!-- 餐次+时间一行 -->
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <select class="edit-type-select" id="eatAddType" style="flex:1;min-width:0;padding:6px 10px;">
          <option value="breakfast">${t('breakfast')}</option>
          <option value="lunch">${t('lunch')}</option>
          <option value="dinner">${t('dinner')}</option>
          <option value="snack">${t('snack')}</option>
        </select>
        <input type="time" class="edit-input" id="eatAddTime" value="${defaultTimeStr}" style="width:110px;font-size:12px;padding:6px 8px;" />
      </div>
      <!-- 内容+备注 -->
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAddContent" placeholder="${t('eatPlaceholder')}" style="font-size:12px;" />
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAddRemark" placeholder="${t('remarkPlaceholder')}" maxlength="50" style="font-size:11px;" />
      </div>
      <!-- 评分+饱腹感一行 -->
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--muted);">${t('rateLabelShort')}：</span>
        <div class="rating-stars" id="eatAddRating" style="display:flex;gap:2px;">
          <span class="star" data-value="1" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:20px;width:20px;"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
          <span class="star" data-value="2" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:20px;width:20px;"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
          <span class="star" data-value="3" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:20px;width:20px;"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
          <span class="star" data-value="4" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:20px;width:20px;"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
          <span class="star" data-value="5" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:20px;width:20px;"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
        </div>
        <span class="rating-text" id="eatAddRatingText" style="font-size:10px;color:var(--eat);font-weight:600;">${t('ratingNone')}</span>
      </div>
      <button class="edit-save-btn" id="eatAddBtn" style="background: var(--eat);font-size:12px;padding:6px 12px;">${t('addRecordBtn')}</button>
    `;
    
    // 评价星级交互（5颗星，支持半星）
    const addRatingStars = document.querySelectorAll("#eatAddRating .star");
    let addRating = 0;

    function updateAddStarsDisplay(rating) {
      addRatingStars.forEach((star, idx) => {
        const starValue = idx + 1;
        const fill = star.querySelector(".fill");
        if (rating === 0) {
          fill.style.clipPath = "inset(0 100% 0 0)";
        } else if (starValue <= Math.floor(rating)) {
          fill.style.clipPath = "inset(0 0% 0 0)";
        } else if (starValue - 0.5 === rating) {
          fill.style.clipPath = "inset(0 50% 0 0)";
        } else {
          fill.style.clipPath = "inset(0 100% 0 0)";
        }
      });
    }

    if (addRatingStars.length > 0) {
      addRatingStars.forEach((star, idx) => {
        star.addEventListener("mousemove", (e) => {
          const rect = star.getBoundingClientRect();
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          const rating = isLeftHalf ? (idx + 0.5) : (idx + 1);
          addRatingStars.forEach((s, i) => {
            const starValue = i + 1;
            const fill = s.querySelector(".fill");
            if (starValue <= Math.floor(rating)) {
              fill.style.clipPath = "inset(0 0% 0 0)";
            } else if (starValue - 0.5 === rating) {
              fill.style.clipPath = "inset(0 50% 0 0)";
            } else {
              fill.style.clipPath = "inset(0 100% 0 0)";
            }
          });
        });

        star.addEventListener("click", (e) => {
          const rect = star.getBoundingClientRect();
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          const rating = isLeftHalf ? (idx + 0.5) : (idx + 1);
          addRating = addRating === rating ? 0 : rating;
          updateAddStarsDisplay(addRating);
          document.getElementById("eatAddRatingText").textContent = getRatingText(addRating);
        });
    });

    // 鼠标离开时恢复已选中的状态
    const eatAddRatingContainer = document.getElementById("eatAddRating");
    if (eatAddRatingContainer) {
      eatAddRatingContainer.addEventListener("mouseleave", () => {
        updateAddStarsDisplay(addRating);
      });
    }
  }
    
    // 根据当前时间自动识别餐次
    const eatAddTypeEl = document.getElementById("eatAddType");
    if (eatAddTypeEl) {
      eatAddTypeEl.value = getCurrentMealTypeByTime();
    }

    document.getElementById("eatAddBtn").addEventListener("click", () => {
      const type = document.getElementById("eatAddType").value;
      const content = document.getElementById("eatAddContent").value.trim();
      if (!content) { showToast(t("toastInputMeal")); return; }

      // 获取时间：优先用时间输入框的值
      let recordTime;
      const timeVal = document.getElementById("eatAddTime").value;
      if (timeVal) {
        const [h, m] = timeVal.split(":");
        recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
      } else {
        recordTime = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
      }

      // 获取备注和评价
      const remark = document.getElementById("eatAddRemark") ? document.getElementById("eatAddRemark").value.trim() : "";
      const rating = addRating || 0;

      chrome.storage.local.get(["mealRecords"], (data) => {
        const records = data.mealRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        records[dateStr].push({
          content,
          time: recordTime,
          type,
          remark,
          rating,
          timestamp: Date.now(),
          isBackfill: !isToday
        });
        persistRecords('mealRecords', records, () => {
          showToast(isToday ? t('toastMealAdded') : "🍽️ " + t('makeUpCheckinSuccess'));
          renderEatCalendar();
          updateMealRecords();
          chrome.storage.local.get(["mealRecords"], (d) => {
            showEatEditModal(dateStr, d.mealRecords[dateStr] || []);
          });
        });
      });
    });
    return;
  }
  
  // 解析记录时间，用于时间选择器的默认值
  function parseRecordTime(timeStr) {
    if (!timeStr || timeStr === t("makeUpCheckin")) return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTime(rec.time);
    const ratingStarsHtml = rec.rating ? getRatingStarsHtml(rec.rating) : t('ratingNone');
    const remarkHtml = rec.remark ? `📝 ${rec.remark}` : t('noRemark');
    return `
    <div class="edit-record-item" data-index="${idx}">
      <!-- 默认预览（非编辑状态） -->
      <div id="eatPreview${idx}">
        <div class="edit-record-header">
          <span class="edit-record-time">${typeLabel[rec.type] || ""} ${rec.time}</span>
          <div class="edit-record-actions">
            <button class="edit-btn-edit" data-action="edit-eat" data-index="${idx}">${t('edit')}</button>
            <button class="edit-btn-delete" data-action="delete-eat" data-index="${idx}">${t('delete')}</button>
          </div>
        </div>
        <div class="edit-record-content" id="eatContent${idx}" style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px;">
          ${rec.content}
        </div>
        <div style="font-size:11px;color:var(--muted);background:rgba(0,0,0,0.03);border-radius:6px;padding:8px 10px;margin-bottom:0;">
          <div style="margin-bottom:3px;">📝 ${t('remarkLabel')}: ${remarkHtml}</div>
          <div style="margin-bottom:3px;">⭐ ${t('rateLabelShort')}: <span style="display:inline-flex;align-items:center;gap:4px;">${ratingStarsHtml}</span></div>
          ${rec.fullness ? `<div style="margin-bottom:3px;">🍽️ ${t('fullnessLabel')}: ${t('fullnessLevels')[rec.fullness - 1] || ""}</div>` : ''}
          ${rec.tags && rec.tags.length > 0 ? `<div>🏷 ${t('autoTagHint')}: ${rec.tags.map(tag => `<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);color:var(--eat);font-size:10px;margin-right:3px;">${tag}</span>`).join("")}</div>` : ''}
        </div>
      </div>
      <!-- 编辑表单（编辑状态下替换预览） -->
      <div class="edit-form-wrap" id="eatEditWrap${idx}" style="display:none;">
        <div class="edit-input-row" style="display:flex;align-items:center;gap:6px;">
          <select class="edit-type-select" id="eatEditType${idx}" style="flex:1;min-width:0;padding:5px 8px;font-size:12px;">
            <option value="breakfast" ${rec.type === 'breakfast' ? 'selected' : ''}>${t('breakfast')}</option>
            <option value="lunch" ${rec.type === 'lunch' ? 'selected' : ''}>${t('lunch')}</option>
            <option value="dinner" ${rec.type === 'dinner' ? 'selected' : ''}>${t('dinner')}</option>
            <option value="snack" ${rec.type === 'snack' ? 'selected' : ''}>${t('snack')}</option>
          </select>
          <input type="time" class="edit-input" id="eatEditTime${idx}" value="${parsedTime}" style="width:100px;font-size:12px;padding:5px 6px;" />
          <button class="edit-btn-delete" data-action="delete-eat" data-index="${idx}" style="padding:4px 8px;font-size:11px;flex-shrink:0;">${t('delete')}</button>
        </div>
        <div class="edit-input-row" style="margin-bottom:4px;">
          <input class="edit-input" type="text" id="eatEditContent${idx}" value="${rec.content}" placeholder="${t('eatPlaceholder')}" style="font-size:14px;font-weight:600;" />
        </div>
        <div class="edit-input-row" style="margin-bottom:4px;">
          <input class="edit-input edit-input-sm" type="text" id="eatEditRemark${idx}" value="${rec.remark || ''}" placeholder="${t('remarkPlaceholder')}" maxlength="50" />
        </div>
        <div class="edit-input-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
          <div class="edit-rating-stars" id="eatEditRatingStars${idx}" style="display:flex;gap:0;">
            <span class="edit-star" data-value="1" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:16px;width:16px;"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="edit-fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
            <span class="edit-star" data-value="2" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:16px;width:16px;"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="edit-fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
            <span class="edit-star" data-value="3" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:16px;width:16px;"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="edit-fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
            <span class="edit-star" data-value="4" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:16px;width:16px;"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="edit-fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
            <span class="edit-star" data-value="5" style="position:relative;cursor:pointer;color:#e0e0e0;user-select:none;display:flex;align-items:center;justify-content:center;height:16px;width:16px;"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="edit-fill" style="position:absolute;top:0;left:0;width:100%;height:100%;color:#F59E0B;pointer-events:none;display:flex;align-items:center;justify-content:center;clip-path:inset(0 100% 0 0);"><svg viewBox="0 0 24 24" width="13" height="13" style="display:block;flex-shrink:0;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span></span>
          </div>
          <span class="edit-rating-text" id="eatEditRatingText${idx}" style="font-size:9px;color:var(--eat);font-weight:600;min-width:24px;">${getRatingText(rec.rating)}</span>
          <input type="hidden" id="eatEditRating${idx}" value="${rec.rating || 0}" />
          <div class="edit-fullness-btns" id="eatEditFullnessBtns${idx}" style="display:flex;gap:2px;">
            ${(t('fullnessLevels') || []).map((lvl, i) => `<button class="edit-fullness-btn ${(rec.fullness || 0) === i+1 ? 'active' : ''}" data-level="${i+1}" style="padding:2px 5px;border-radius:10px;border:1px solid rgba(245,158,11,0.2);background:rgba(255,255,255,0.8);color:var(--text);font-size:9px;cursor:pointer;user-select:none;">${lvl}</button>`).join('')}
          </div>
          <input type="hidden" id="eatEditFullness${idx}" value="${rec.fullness || 0}" />
        </div>
        <div class="edit-input-row" style="margin-bottom:6px;">
          <div class="edit-tags-grid" id="eatEditTagsGrid${idx}" style="display:flex;flex-wrap:wrap;gap:3px;">
            ${(() => {
              const allTags = (t('mealTags') || []);
              const allEmojis = (t('mealTagEmojis') || []);
              let tagHtml = allTags.map((tag, i) => {
                const isActive = rec.tags && rec.tags.includes(tag);
                return `<button class="edit-tag-btn ${isActive ? 'active' : ''}" data-tag="${tag}" style="display:inline-flex;align-items:center;gap:1px;padding:1px 5px;border-radius:6px;border:1px solid ${isActive ? 'var(--eat)' : 'rgba(245,158,11,0.15)'};background:${isActive ? 'rgba(245,158,11,0.12)' : 'transparent'};color:${isActive ? 'var(--eat)' : 'var(--muted)'};font-size:9px;cursor:pointer;user-select:none;">${allEmojis[i] || ''} ${tag}</button>`;
              }).join('');
              customMealTags.forEach((ct, ci) => {
                const isActive = rec.tags && rec.tags.includes(ct.name);
                tagHtml += `<button class="edit-tag-btn ${isActive ? 'active' : ''}" data-tag="${ct.name}" data-custom="1" style="display:inline-flex;align-items:center;gap:1px;padding:1px 5px;border-radius:6px;border:1px solid ${isActive ? 'var(--eat)' : 'rgba(245,158,11,0.15)'};background:${isActive ? 'rgba(245,158,11,0.12)' : 'transparent'};color:${isActive ? 'var(--eat)' : 'var(--muted)'};font-size:9px;cursor:pointer;user-select:none;">${ct.emoji} ${ct.name}</button>`;
              });
              return tagHtml;
            })()}
          </div>
        </div>
        <button class="edit-save-btn edit-save-btn-primary" data-action="save-eat" data-index="${idx}" style="margin-top:0;">💾 ${t('saveEdit')}</button>
      </div>
    </div>
  `;
  }).join("") + `
    <!-- 追加新记录区域 -->
    <div class="edit-add-new-section" style="margin-top:10px;padding:14px;border-top:1px dashed rgba(245,158,11,0.25);">
      <div style="font-size:13px;font-weight:600;color:var(--eat);margin-bottom:10px;display:flex;align-items:center;gap:4px;">
        ${t('appendRecord')}
      </div>
      <!-- 餐次+时间一行 -->
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <select class="edit-type-select" id="eatAppendType" style="flex:1;min-width:0;padding:6px 10px;">
          <option value="breakfast">${t('breakfast')}</option>
          <option value="lunch">${t('lunch')}</option>
          <option value="dinner">${t('dinner')}</option>
          <option value="snack">${t('snack')}</option>
        </select>
        <input type="time" class="edit-input" id="eatAppendTime" value="${new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" })}" style="width:110px;font-size:12px;padding:6px 8px;" />
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAppendContent" placeholder="${t('eatPlaceholder')}" style="font-size:12px;" />
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAppendRemark" placeholder="${t('remarkPlaceholder')}" maxlength="50" style="font-size:11px;" />
      </div>
      <button class="edit-save-btn" id="eatAppendBtn" style="background:var(--eat);font-size:12px;padding:6px 12px;">${t('appendRecordBtn')}</button>
    </div>
  `;

  // 追加按钮事件
  document.getElementById("eatAppendBtn").addEventListener("click", () => {
    const type = document.getElementById("eatAppendType").value;
    const content = document.getElementById("eatAppendContent").value.trim();
    const remark = document.getElementById("eatAppendRemark")?.value.trim() || "";
    if (!content) { showToast(t("toastInputMeal")); return; }

    // 获取时间：优先用时间输入框的值
    let recordTime;
    const timeVal = document.getElementById("eatAppendTime").value;
    if (timeVal) {
      const [h, m] = timeVal.split(":");
      recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
    } else {
      recordTime = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
    }

    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      if (!records[dateStr]) records[dateStr] = [];
      records[dateStr].push({ content, time: recordTime, type, remark, timestamp: Date.now(), isBackfill: !isToday });
      persistRecords('mealRecords', records, () => {
        showToast(isToday ? t('toastMealAdded') : "🍽️ " + t('makeUpCheckinSuccess'));
        document.getElementById("eatAppendContent").value = "";
        document.getElementById("eatAppendRemark").value = "";
        renderEatCalendar();
        updateMealRecords();
        chrome.storage.local.get(["mealRecords"], (d) => {
          showEatEditModal(dateStr, d.mealRecords[dateStr] || []);
        });
      });
    });
  });
}



function saveEatRecord(idx) {
  const newType = document.getElementById("eatEditType" + idx).value;
  const newContent = document.getElementById("eatEditContent" + idx).value.trim();
  const newTime = document.getElementById("eatEditTime" + idx).value;
  const newRemark = document.getElementById("eatEditRemark" + idx).value.trim();
  const newRating = parseInt(document.getElementById("eatEditRating" + idx).value) || 0;
  const newFullness = parseInt(document.getElementById("eatEditFullness" + idx).value) || 0;

  if (!newContent) {
    showToast(t("toastInputEmpty"));
    return;
  }

  // 处理时间格式
  let recordTime = newTime;
  if (recordTime) {
    const [h, m] = recordTime.split(":");
    recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
  } else {
    recordTime = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    if (records[currentEditDate] && records[currentEditDate][idx]) {
      records[currentEditDate][idx].type = newType;
      records[currentEditDate][idx].content = newContent;
      records[currentEditDate][idx].time = recordTime;
      records[currentEditDate][idx].remark = newRemark || undefined;
      records[currentEditDate][idx].rating = newRating || undefined;
      records[currentEditDate][idx].fullness = newFullness || undefined;
      persistRecords('mealRecords', records, () => {
        showToast(t("toastEditSuccess"));
        renderEatCalendar();
        updateMealRecords();
        chrome.storage.local.get(["mealRecords"], (d) => {
          if (d.mealRecords && d.mealRecords[currentEditDate]) {
            showEatEditModal(currentEditDate, d.mealRecords[currentEditDate]);
          }
        });
      });
    }
  });
}

function deleteEatRecord(idx, dateStr) {
  showConfirm(t("confirmDeleteRecord"), () => {
    const targetDate = dateStr || currentEditDate;
    const isModal = !dateStr;

    _deleteRecordFromStorage("mealRecords", targetDate, idx, (records, targetDate, isEmpty) => {
      showToast(t("toastDeleteSuccess"));
      renderEatCalendar();
      updateMealRecords();
      if (isModal) {
        if (isEmpty) {
          hideEditModal();
        } else {
          showEatEditModal(targetDate, records[targetDate]);
        }
      }
    });
  });
}

function showEatTooltip(e, dateStr) {
  clearTimeout(eatTooltipTimeout);
  eatTooltipTimeout = setTimeout(() => {
    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      const dayRecords = records[dateStr] || [];
      document.getElementById("tooltipDate").textContent = formatDateDisplay(dateStr);
      const countEl = document.getElementById("tooltipCount");
      countEl.textContent = '🍽️ ' + dayRecords.length + t('times');
      countEl.classList.remove("pee-count");
      countEl.classList.add("eat-count");
      
      // 恢复tooltip主题色
      const headerEl = document.querySelector(".tooltip-header");
      if (headerEl) headerEl.style.borderBottomColor = "rgba(245,158,11,0.2)";
      
      if (dayRecords.length > 0) {
        const typeLabel = { breakfast: t("breakfast"), lunch: t("lunch"), dinner: t("dinner"), snack: t("snack") };
        const fullnessLevels = t("fullnessLevels") || [];
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => {
          const ratingHtml = rec.rating ? getRatingStarsHtml(rec.rating) : "";
          const remarkHtml = rec.remark ? `📝 ${rec.remark}` : `📝 ${t('noRemark')}`;
          const fullnessHtml = rec.fullness ? `🍽️ ${t('fullnessLabel')}: ${fullnessLevels[rec.fullness - 1] || ""}` : "";
          return `
            <div class="tooltip-record">
              <div class="tooltip-record-time">${typeLabel[rec.type] || ""} ${rec.time}</div>
              <div class="tooltip-record-remark">${rec.content}</div>
              <div class="tooltip-record-detail">
                ${ratingHtml ? `<span class="tooltip-record-rating">⭐ ${t('rateLabelShort')}: ${ratingHtml}</span>` : ''}
                ${fullnessHtml ? `<span class="tooltip-record-fullness">${fullnessHtml}</span>` : ''}
                <span class="tooltip-record-remark-text">${remarkHtml}</span>
              </div>
            </div>
          `;
        }).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">' + t('tooltipEmptyMeal') + '</div>';
      }
      
      positionTooltip(e);
      activeTooltipDate = dateStr;
      activeTooltipType = "eat";
      document.getElementById("tooltip").classList.add("show");
    });
  }, 100);
}

function hideEatTooltip(e) {
  clearTimeout(eatTooltipTimeout);
  if (e && tooltipEl.contains(e.relatedTarget)) return;
  tooltipHideTimeout = setTimeout(() => {
    document.getElementById("tooltip").classList.remove("show");
  }, 200);
}

document.getElementById("eatPrevMonth").addEventListener("click", () => {
  eatMonth--;
  if (eatMonth < 0) { eatMonth = 11; eatYear--; }
  renderEatCalendar();
});

document.getElementById("eatNextMonth").addEventListener("click", () => {
  eatMonth++;
  if (eatMonth > 11) { eatMonth = 0; eatYear++; }
  renderEatCalendar();
});

// ==================== 喝 - 喝水提醒 ====================
const DEFAULT_MINUTES = 30;

const timerEl       = document.getElementById("timer");
const hintEl        = document.getElementById("nextHint");
const drinkBtn      = document.getElementById("drinkBtn");
const resetBtn      = document.getElementById("resetBtn");
const intervalSelect= document.getElementById("intervalSelect");
const customRow     = document.getElementById("customRow");
const customIntervalValue = document.getElementById("customIntervalValue");
const customIntervalUnit  = document.getElementById("customIntervalUnit");
const customApplyBtn      = document.getElementById("customApplyBtn");
const timerToggle   = document.getElementById("timerToggle");
const notifToggle   = document.getElementById("notifToggle");
const timerStatus   = document.getElementById("timerStatus");
const notifStatus   = document.getElementById("notifStatus");
const progressBar   = document.getElementById("progressBar");

let intervalMinutes = DEFAULT_MINUTES;
let customMinutes = DEFAULT_MINUTES;
let tickHandle = null;
let isRunning = false;

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
const PRESET_MINUTES = [15, 30, 45, 60];

function getIntervalText(mins) {
  if (mins % 60 === 0) return t('remindEveryHour', { n: mins / 60 });
  else if (mins >= 1) return t('remindEveryMin', { n: mins });
  else return t('remindEverySec', { n: Math.round(mins * 60) });
}

function formatMMSS(sec) {
  const s = Math.max(0, Math.floor(sec));
  return String(Math.floor(s / 60)).padStart(2,"0") + ":" + String(s % 60).padStart(2,"0");
}

function calcRemaining(alarmStartTime, intervalMins) {
  const elapsed = (Date.now() - alarmStartTime) / 1000;
  const total = intervalMins * 60;
  return Math.max(0, total - (elapsed % total));
}

function render(remainingSec) {
  timerEl.textContent = formatMMSS(remainingSec);
  const ratio = (intervalMinutes * 60) > 0 ? remainingSec / (intervalMinutes * 60) : 0;
  progressBar.style.width = clamp(ratio * 100, 0, 100) + "%";
}

function applyRunningUI(running) {
  isRunning = running;
  timerToggle.checked = running;
  timerStatus.textContent = running ? t('timerRunning') : t('timerNotRunning');
  drinkBtn.disabled = !running;
  resetBtn.disabled = !running;
  if (running) {
    timerEl.classList.remove("paused");
    progressBar.classList.remove("paused");
  } else {
    timerEl.classList.add("paused");
    progressBar.classList.add("paused");
    timerEl.textContent = "--:--";
    progressBar.style.width = "100%";
    hintEl.textContent = t('timerHintOff');
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
}

function startDisplayTicker(alarmStartTime) {
  if (tickHandle) clearInterval(tickHandle);
  
  tickHandle = setInterval(() => {
    const remaining = calcRemaining(alarmStartTime, intervalMinutes);
    render(remaining);
  }, 1000);
}

function applyNotifUI(enabled) {
  notifToggle.checked = enabled;
  notifStatus.textContent = enabled ? t('notifOn') : t('notifOff');
}

function showCustomRow(show) {
  if (!customRow) return;
  customRow.classList.toggle("show", !!show);
}

function minutesFromCustomInput() {
  const v = Number(customIntervalValue.value);
  const unit = customIntervalUnit.value;
  if (!Number.isFinite(v) || v <= 0) return null;
  let minutes = unit === "hours" ? v * 60 : unit === "minutes" ? v : v / 60;
  const rounded = Math.round(minutes * 100) / 100;
  if (!Number.isFinite(rounded) || rounded <= 0) return null;
  return clamp(rounded, 0.0167, 24 * 60);
}

function syncCustomInputsFromMinutes(mins) {
  const m = clamp(Number(mins) || DEFAULT_MINUTES, 0.0167, 24 * 60);
  if (m % 1 === 0) {
    customIntervalUnit.value = "minutes";
    customIntervalValue.value = String(m);
  } else {
    customIntervalUnit.value = "seconds";
    customIntervalValue.value = String(Math.round(m * 60));
  }
}

async function requestNotifPermission() {
  // Chrome Extension 不需要请求通知权限
  // 权限已在 manifest.json 中声明
  if (chrome.notifications) {
    return true;
  }
  return false;
}

function initDrinkTimer() {
  chrome.storage.local.get(["intervalMinutes", "customMinutes", "alarmStartTime", "timerRunning", "notifEnabled"], (data) => {
    intervalMinutes = data.intervalMinutes || DEFAULT_MINUTES;
    customMinutes = data.customMinutes || data.intervalMinutes || DEFAULT_MINUTES;
    const running = !!data.timerRunning;
    const notifOn = !!data.notifEnabled;
    const isPreset = PRESET_MINUTES.includes(Number(intervalMinutes));
    if (isPreset) {
      const opt = intervalSelect.querySelector(`option[value="${intervalMinutes}"]`);
      if (opt) opt.selected = true;
      showCustomRow(false);
    } else {
      intervalSelect.value = "custom";
      showCustomRow(true);
      syncCustomInputsFromMinutes(intervalMinutes);
    }
    applyNotifUI(notifOn);
    applyRunningUI(running);
    if (running && data.alarmStartTime) {
      const remaining = calcRemaining(data.alarmStartTime, intervalMinutes);
      hintEl.textContent = getIntervalText(intervalMinutes);
      render(remaining);
      startDisplayTicker(data.alarmStartTime);
    }
  });
}

function updateDrinkUI() {
  // Refresh the drink page UI without reinitializing everything
  chrome.storage.local.get(["timerRunning", "alarmStartTime", "intervalMinutes"], (data) => {
    const running = !!data.timerRunning;
    if (running && data.alarmStartTime) {
      const remaining = calcRemaining(data.alarmStartTime, data.intervalMinutes || intervalMinutes);
      hintEl.textContent = getIntervalText(data.intervalMinutes || intervalMinutes);
      render(remaining);
    }
  });
  updateDrinkStats();
  renderDrinkCalendar();
}

function updateDrinkStats() {
  // 先从 storage 读取数据，如果主数据丢失，尝试从备份恢复
  chrome.storage.local.get(["drinkRecords", "drinkRecordsBackup"], (data) => {
    // 检查主数据是否真的存在（hasOwnProperty 可以区分"key不存在"和"key存在但值为undefined"）
    const mainDataExists = data.hasOwnProperty("drinkRecords");
    const backupDataExists = data.hasOwnProperty("drinkRecordsBackup");

    let records = data.drinkRecords || {};
    const backup = data.drinkRecordsBackup || {};

    // 数据完整性检查：只有主数据确实不存在（而不是存在但为空），才从备份恢复
    if (!mainDataExists && backupDataExists && Object.keys(backup).length > 0) {
      // 主数据丢失，从备份恢复
      console.warn("[喝水统计] 主数据丢失，从备份恢复");
      records = backup;
      // 恢复主数据
      chrome.storage.local.set({ drinkRecords: records }, () => {
        console.log("[喝水统计] 从备份恢复主数据成功");
      });
    } else if (mainDataExists) {
      // 主数据存在，更新备份（确保备份是最新的）
      chrome.storage.local.set({ drinkRecordsBackup: records }, () => {});
    }

    const todayCount = records[getToday()] ? records[getToday()].length : 0;

    let weekCount = 0;
    const wRange = getWeekRange();
    let wc = new Date(wRange.start);
    while (wc <= wRange.end) {
      weekCount += (records[formatDate(wc)] || []).length;
      wc.setDate(wc.getDate() + 1);
    }

    let monthCount = 0;
    const mRange = getMonthRange();
    let mc = new Date(mRange.start);
    while (mc <= mRange.end) {
      monthCount += (records[formatDate(mc)] || []).length;
      mc.setDate(mc.getDate() + 1);
    }

    document.getElementById("drinkStatsRow").innerHTML =
      `<div class="drink-stat-item"><div class="drink-stat-label">${t("today")}</div><div class="drink-stat-val editable" id="drinkTodayCount" data-tooltip="${t("adjustDrink")}">${todayCount}</div></div>` +
      `<div class="drink-stat-item"><div class="drink-stat-label">${t("week")}</div><div class="drink-stat-val">${weekCount}</div></div>` +
      `<div class="drink-stat-item"><div class="drink-stat-label">${t("month")}</div><div class="drink-stat-val">${monthCount}</div></div>`;

    // 绑定今日数字点击事件
    const todayEl = document.getElementById("drinkTodayCount");
    if (todayEl) {
      todayEl.addEventListener("click", openDrinkCounter);
    }
  });
}

// ==================== 今日喝水计数编辑器 ====================
const drinkEditOverlay = document.getElementById("drinkEditOverlay");
const drinkCounterNum  = document.getElementById("drinkCounterNum");
const drinkCounterMinus = document.getElementById("drinkCounterMinus");
const drinkCounterPlus  = document.getElementById("drinkCounterPlus");
const drinkEditConfirm  = document.getElementById("drinkEditConfirm");
const drinkEditCancel   = document.getElementById("drinkEditCancel");

let drinkCounterTarget = 0;
let drinkCounterOriginal = 0;

function openDrinkCounter() {
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    const today = getToday();
    const current = records[today] ? records[today].length : 0;
    drinkCounterOriginal = current;
    drinkCounterTarget = current;
    drinkCounterNum.textContent = current;
    drinkEditOverlay.classList.add("show");
  });
}

function closeDrinkCounter() {
  drinkEditOverlay.classList.remove("show");
}

function updateDrinkCounterDisplay() {
  drinkCounterNum.textContent = drinkCounterTarget;
  drinkCounterMinus.disabled = drinkCounterTarget <= 0;
}

drinkCounterMinus.addEventListener("click", () => {
  if (drinkCounterTarget > 0) {
    drinkCounterTarget--;
    updateDrinkCounterDisplay();
  }
});

drinkCounterPlus.addEventListener("click", () => {
  drinkCounterTarget++;
  updateDrinkCounterDisplay();
});

drinkEditConfirm.addEventListener("click", () => {
  const diff = drinkCounterTarget - drinkCounterOriginal;
  if (diff === 0) {
    closeDrinkCounter();
    return;
  }

  const today = getToday();
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    if (!records[today]) records[today] = [];

    if (diff > 0) {
      // 增加：追加 diff 条记录（时间为当前时间）
      const time = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
      for (let i = 0; i < diff; i++) {
        records[today].push({ time, timestamp: Date.now() + i }); // +i 避免时间戳完全相同
      }
    } else {
      // 减少：从尾部删除
      records[today].splice(drinkCounterTarget);
      if (records[today].length === 0) {
        delete records[today];
      }
    }

    chrome.storage.local.set({ drinkRecords: records }, () => {
      // 保存成功后，同时保存备份
      chrome.storage.local.set({ drinkRecordsBackup: records }, () => {});
      updateDrinkStats();
      updateBadge();
      renderDrinkCalendar();
      showToast(diff > 0 ? t('toastDrinkAdded', { n: diff }) : t('toastDrinkRemoved', { n: Math.abs(diff) }));
      closeDrinkCounter();
    });
  });
});

drinkEditCancel.addEventListener("click", closeDrinkCounter);

// 点击遮罩关闭
drinkEditOverlay.addEventListener("click", (e) => {
  if (e.target === drinkEditOverlay) closeDrinkCounter();
});

// ==================== 喝 - 喝水日历 ====================
let drinkCalYear = new Date().getFullYear();
let drinkCalMonth = new Date().getMonth();
let drinkTooltipTimeout = null;

const drinkCalendarDays = document.getElementById("drinkCalendarDays");
const drinkCalendarTitle = document.getElementById("drinkCalendarTitle");

function getDrinkLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  return 4;
}

function getDrinkColor(count) {
  const lv = getDrinkLevel(count);
  if (lv === 0) return "rgba(11,107,255,0.06)";
  if (lv === 1) return "rgba(11,107,255,0.25)";
  if (lv === 2) return "rgba(11,107,255,0.45)";
  if (lv === 3) return "rgba(11,107,255,0.7)";
  return "linear-gradient(135deg, var(--primary), var(--primary2))";
}

function renderDrinkCalendar() {
  const firstDay = new Date(drinkCalYear, drinkCalMonth, 1);
  const lastDay = new Date(drinkCalYear, drinkCalMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  drinkCalendarTitle.textContent = t("yearMonth", { y: drinkCalYear, m: drinkCalMonth + 1 });
  
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    const today = getToday();
    
    // 清空后重新渲染
    drinkCalendarDays.innerHTML = "";
    
    // 统计最大值用于颜色映射
    let maxCount = 1;
    Object.keys(records).forEach(k => { 
      const d = records[k];
      if (Array.isArray(d) && d.length > maxCount) maxCount = d.length; 
    });
    
    for (let i = 0; i < startWeekday; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      emptyCell.style.width = "36px";
      emptyCell.style.height = "36px";
      drinkCalendarDays.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cell = document.createElement("div");
      const dateStr = `${drinkCalYear}-${String(drinkCalMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      cell.textContent = day;
      cell.className = "day-cell";
      cell.dataset.date = dateStr;
      
      const dayRecords = records[dateStr] || [];
      const count = dayRecords.length;
      
      if (dateStr === today) cell.classList.add("today");
      
      // 颜色深浅反映饮水量
      const bg = getDrinkColor(count);
      cell.style.background = bg;
      if (count > 0) {
        cell.style.fontWeight = "600";
        cell.style.color = count >= 6 ? "#fff" : "var(--text)";
      }
      
      cell.addEventListener("mouseenter", (e) => showDrinkTooltip(e, dateStr, dayRecords));
      cell.addEventListener("mouseleave", hideDrinkTooltip);
      drinkCalendarDays.appendChild(cell);
    }
  });
}

function showDrinkTooltip(e, dateStr, dayRecords) {
  clearTimeout(drinkTooltipTimeout);
  drinkTooltipTimeout = setTimeout(() => {
    document.getElementById("tooltipDate").textContent = formatDateDisplay(dateStr);
    const countEl = document.getElementById("tooltipCount");
    countEl.textContent = '💧 ' + dayRecords.length + t('times');
    countEl.className = "tooltip-poop-count drink-count";
    
    // 切换tooltip主题色为蓝色
    const headerEl = document.querySelector(".tooltip-header");
    if (headerEl) {
      headerEl.style.borderBottomColor = "rgba(11,107,255,0.2)";
    }
    
    if (dayRecords.length > 0) {
      document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => `
        <div class="tooltip-record">
          <div class="tooltip-record-time">${t('drinkRecord', { num: currentLang === 'zh' ? toChineseNum(i + 1) : (i + 1), time: rec.time })}</div>
        </div>
      `).join("");
    } else {
      document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">' + t('noDrinkRecord') + '</div>';
    }
    
    positionTooltip(e);
    activeTooltipDate = dateStr;
    activeTooltipType = "drink";
    document.getElementById("tooltip").classList.add("show");
  }, 100);
}

function hideDrinkTooltip(e) {
  clearTimeout(drinkTooltipTimeout);
  if (e && tooltipEl.contains(e.relatedTarget)) return;
  tooltipHideTimeout = setTimeout(() => {
    document.getElementById("tooltip").classList.remove("show");
  }, 200);
}

document.getElementById("drinkPrevMonth").addEventListener("click", () => {
  drinkCalMonth--;
  if (drinkCalMonth < 0) { drinkCalMonth = 11; drinkCalYear--; }
  renderDrinkCalendar();
});

document.getElementById("drinkNextMonth").addEventListener("click", () => {
  drinkCalMonth++;
  if (drinkCalMonth > 11) { drinkCalMonth = 0; drinkCalYear++; }
  renderDrinkCalendar();
});

timerToggle.addEventListener("change", () => {
  if (timerToggle.checked) {
    const startTime = Date.now();
    chrome.storage.local.set({ timerRunning: true, alarmStartTime: startTime }, () => {
      chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
        applyRunningUI(true);
        hintEl.textContent = getIntervalText(intervalMinutes);
        render(intervalMinutes * 60);
        startDisplayTicker(startTime);
      });
    });
    showToast(t("toastTimerOn"));
  } else {
    chrome.runtime.sendMessage({ type: "CANCEL_ALARM" });
    chrome.storage.local.set({ timerRunning: false });
    applyRunningUI(false);
    showToast(t("toastTimerOff"));
  }
});

notifToggle.addEventListener("change", async () => {
  if (notifToggle.checked) {
    // Chrome Extension 不需要请求权限，直接开启
    if (!chrome.notifications) {
      showToast(t("toastNotifApiUnavailable"));
      applyNotifUI(false);
      return;
    }
    // 验证通知功能可用
    chrome.notifications.create("perm-test-" + Date.now(), {
      type: "basic",
      iconUrl: "icon128.png",
      title: t('notifTitle'),
      message: t('toastNotifOn')
    }, () => {
      if (chrome.runtime.lastError) {
        applyNotifUI(false);
        showToast(t("toastNotifUnavailable", { msg: chrome.runtime.lastError.message }));
      } else {
        chrome.storage.local.set({ notifEnabled: true });
        applyNotifUI(true);
        showToast(t("toastNotifOn"));
      }
    });
  } else {
    chrome.storage.local.set({ notifEnabled: false });
    applyNotifUI(false);
    showToast(t("toastNotifOff"));
  }
});



// 角标色由下方 THEME_PRESETS 自动派生（see THEME_BADGE_COLOR after THEME_PRESETS definition）

function updateBadge() {
  chrome.storage.local.get(
    ["drinkRecords","poopRecords","peeRecords","mealRecords","selectedTheme","badgeEnabled","badgeContentType"],
    function(data){
      if (chrome.runtime.lastError) {
        console.error("[popup] 读取角标配置失败:", chrome.runtime.lastError.message);
        return;
      }
      var enabled = data.badgeEnabled !== false;
      if (!enabled) {
        chrome.action.setIcon({ path: { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" } });
        chrome.action.setBadgeText({ text: "" });
        return;
      }
      var badgeType = data.badgeContentType || "drink_today";
      var parts = badgeType.split("_");
      var recordType = parts[0];
      var timeRange = parts[1];
      var theme = data.selectedTheme || "default";
      var themeColor = (THEME_BADGE_COLOR[theme] || "#0b6bff");
      if (!THEME_BADGE_COLOR[theme]) {
        console.warn("[popup] 主题", theme, "无角标色（THEME_BADGE_COLOR 缺失），回退 #0b6bff。当前可用主题:", Object.keys(THEME_BADGE_COLOR));
      }
      console.log("[popup] updateBadge →", { theme, themeColor, badgeType, count });
      chrome.action.setIcon({ path: { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" } });

      var records = {};
      if (recordType === "drink") records = data.drinkRecords || {};
      else if (recordType === "poop") records = data.poopRecords || {};
      else if (recordType === "pee") records = data.peeRecords || {};
      else if (recordType === "meal") records = data.mealRecords || {};

      var count = 0;
      if (timeRange === "today") {
        var today = getToday();
        count = (records[today] || []).length;
      } else if (timeRange === "week") {
        var range = getWeekRange();
        var cur = new Date(range.start);
        var now = new Date();
        while (cur <= now) {
          count += (records[formatDate(cur)] || []).length;
          cur.setDate(cur.getDate() + 1);
        }
      } else if (timeRange === "month") {
        var range = getMonthRange();
        var cur = new Date(range.start);
        var now = new Date();
        while (cur <= now) {
          count += (records[formatDate(cur)] || []).length;
          cur.setDate(cur.getDate() + 1);
        }
      }

      var txt = count > 99 ? "99+" : String(count);
      chrome.action.setBadgeText({ text: txt });
      chrome.action.setBadgeBackgroundColor({ color: themeColor });
      if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ color: "#ffffff" });
      }
    }
  );
}

drinkBtn.addEventListener("click", () => {
  const startTime = Date.now();
  const today = getToday();
  const time = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, timestamp: Date.now() });
    chrome.storage.local.set({ drinkRecords: records }, () => {
      // 保存成功后，同时保存备份
      chrome.storage.local.set({ drinkRecordsBackup: records }, () => {});
      updateDrinkStats();
      updateBadge();
    });
  });
  
  chrome.storage.local.set({ alarmStartTime: startTime }, () => {
    chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
      hintEl.textContent = getIntervalText(intervalMinutes);
      render(intervalMinutes * 60);
      startDisplayTicker(startTime);
    });
  });
  showToast(t("toastDrinkResetTimer"));
});

resetBtn.addEventListener("click", () => {
  const startTime = Date.now();
  chrome.storage.local.set({ alarmStartTime: startTime }, () => {
    chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
      render(intervalMinutes * 60);
      startDisplayTicker(startTime);
    });
  });
  showToast(t("toastTimerReset"));
});

intervalSelect.addEventListener("change", (e) => {
  const v = String(e.target.value);
  if (v === "custom") {
    showCustomRow(true);
    syncCustomInputsFromMinutes(customMinutes || intervalMinutes);
    return;
  }
  showCustomRow(false);
  intervalMinutes = Number(v);
  chrome.storage.local.set({ intervalMinutes });
  if (isRunning) {
    const startTime = Date.now();
    chrome.storage.local.set({ alarmStartTime: startTime }, () => {
      chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
        hintEl.textContent = getIntervalText(intervalMinutes);
        render(intervalMinutes * 60);
        startDisplayTicker(startTime);
      });
    });
    showToast(t("toastIntervalUpdated"));
  }
});

customApplyBtn.addEventListener("click", () => {
  const m = minutesFromCustomInput();
  if (!m) {
    showToast(t("toastInvalidTime"));
    return;
  }
  customMinutes = m;
  intervalMinutes = m;
  chrome.storage.local.set({ customMinutes, intervalMinutes });
  if (isRunning) {
    const startTime = Date.now();
    chrome.storage.local.set({ alarmStartTime: startTime }, () => {
      chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
        hintEl.textContent = getIntervalText(intervalMinutes);
        render(intervalMinutes * 60);
        startDisplayTicker(startTime);
      });
    });
  } else {
    hintEl.textContent = getIntervalText(intervalMinutes);
    render(intervalMinutes * 60);
  }
  showToast(t("toastCustomIntervalApplied"));
});

// ==================== 拉/撒 - 排便/排尿打卡 ====================

// 排便模块
let poopYear = new Date().getFullYear();
let poopMonth = new Date().getMonth();
let poopStatsMode = "week";
let poopTooltipTimeout = null;

const poopCalendarTitle = document.getElementById("poopCalendarTitle");
const poopCalendarDays = document.getElementById("poopCalendarDays");
const poopRemarkInput = document.getElementById("poopRemarkInput");
const poopCheckinBtn = document.getElementById("poopCheckinBtn");
const poopTodaySection = document.getElementById("poopTodaySection");
const poopRecordsHeader = document.getElementById("poopRecordsHeader");
const poopRecordsList = document.getElementById("poopRecordsList");
const poopToggleBtn = document.getElementById("poopToggleBtn");
const poopTodayCount = document.getElementById("poopTodayCount");
const bristolMainSelector = document.getElementById("bristolMainSelector");
const bristolMainLabel = document.getElementById("bristolMainLabel");
const bristolMainDesc = document.getElementById("bristolMainDesc");
const poopAmountBtns = document.getElementById("poopAmountBtns");

// 主界面布里斯托分类选择
let selectedBristolType = 0; // 0表示未选择
let selectedPoopAmount = 0;  // 0=未选, 1=少, 2=中, 3=多
let selectedPoopColor = 0;   // 0=未选, 1~7 对应颜色

function renderBristolMainSelector() {
  const types = t("bristolTypes") || [];
  const descs = t("bristolDescs") || [];
  if (!bristolMainSelector) return;

  bristolMainLabel.textContent = currentLang === "en" ? "Bristol Stool Scale" : "大便类型（可选）";
  bristolMainSelector.innerHTML = types.map((label, i) => {
    const isActive = selectedBristolType === (i + 1);
    return `<button class="bristol-main-btn ${isActive ? 'active' : ''}" data-type="${i+1}" data-tooltip="${label} (${descs[i] || ''})">${i+1}</button>`;
  }).join("");

  bristolMainSelector.querySelectorAll(".bristol-main-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = parseInt(btn.dataset.type);
      if (selectedBristolType === type) {
        selectedBristolType = 0;
        btn.classList.remove("active");
      } else {
        selectedBristolType = type;
        bristolMainSelector.querySelectorAll(".bristol-main-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
      updateBristolMainDesc();
    });
  });

  updateBristolMainDesc();
}

function updateBristolMainDesc() {
  if (!bristolMainDesc) return;
  if (selectedBristolType === 0) {
    bristolMainDesc.textContent = currentLang === "en" ? "optional" : "未选择";
    return;
  }
  const types = t("bristolTypes") || [];
  const descs = t("bristolDescs") || [];
  bristolMainDesc.textContent = `${types[selectedBristolType-1] || ''} (${descs[selectedBristolType-1] || ''})`;
}

function clearBristolSelection() {
  selectedBristolType = 0;
  bristolMainSelector?.querySelectorAll(".bristol-main-btn").forEach(b => b.classList.remove("active"));
  updateBristolMainDesc();
}

function renderPoopAmountSelector() {
  const amounts = t("poopAmounts") || [];
  if (!poopAmountBtns) return;
  poopAmountBtns.innerHTML = amounts.map((label, i) =>
    `<button class="poop-amount-btn" data-amount="${i+1}">${label}</button>`
  ).join("");

  poopAmountBtns.querySelectorAll(".poop-amount-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const amount = parseInt(btn.dataset.amount);
      if (selectedPoopAmount === amount) {
        selectedPoopAmount = 0;
        btn.classList.remove("active");
      } else {
        selectedPoopAmount = amount;
        poopAmountBtns.querySelectorAll(".poop-amount-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });
}

function clearPoopAmount() {
  selectedPoopAmount = 0;
  poopAmountBtns?.querySelectorAll(".poop-amount-btn").forEach(b => b.classList.remove("active"));
}

// ==================== 大便颜色选择器 ====================
function renderPoopColorSelector() {
  const colors = t("poopColors") || [];
  const container = document.getElementById("poopColorBtns");
  if (!container) return;
  container.innerHTML = colors.map((label, i) =>
    `<button class="poop-color-btn" data-color="${i+1}" data-tooltip="${label}" style="background:${POOP_COLOR_MAP[i] || '#eee'};"></button>`
  ).join("");

  container.querySelectorAll(".poop-color-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const color = parseInt(btn.dataset.color);
      if (selectedPoopColor === color) {
        selectedPoopColor = 0;
        btn.classList.remove("active");
      } else {
        selectedPoopColor = color;
        container.querySelectorAll(".poop-color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });
}

function clearPoopColor() {
  selectedPoopColor = 0;
  const container = document.getElementById("poopColorBtns");
  container?.querySelectorAll(".poop-color-btn").forEach(b => b.classList.remove("active"));
}

const poopWeekBtn = document.getElementById("poopWeekBtn");
const poopMonthBtn = document.getElementById("poopMonthBtn");
const poopStatsCount = document.getElementById("poopStatsCount");
const poopStatsLabel = document.getElementById("poopStatsLabel");

let poopIsExpanded = true;

function renderPoopCalendar() {
  const firstDay = new Date(poopYear, poopMonth, 1);
  const lastDay = new Date(poopYear, poopMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  poopCalendarTitle.textContent = t("yearMonth", { y: poopYear, m: poopMonth + 1 });
  poopCalendarDays.innerHTML = "";
  
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    const today = getToday();
    
    for (let i = 0; i < startWeekday; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      emptyCell.style.width = "36px";
      emptyCell.style.height = "36px";
      poopCalendarDays.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cell = document.createElement("div");
      const dateStr = `${poopYear}-${String(poopMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.textContent = day;
      cell.className = "day-cell";
      cell.dataset.date = dateStr;
      if (dateStr === today) cell.classList.add("today");
      if (records[dateStr]) {
        cell.classList.add("has-poop");
        const firstRec = records[dateStr][0];
        if (firstRec && firstRec.bristolType) {
          cell.classList.add("bristol-" + firstRec.bristolType);
        }
      }
      cell.addEventListener("mouseenter", (e) => showPoopTooltip(e, dateStr));
      cell.addEventListener("mouseleave", hidePoopTooltip);
      cell.addEventListener("click", () => {
        hidePoopTooltip();
        showPoopEditModal(dateStr, records[dateStr] || []);
      });
      poopCalendarDays.appendChild(cell);
    }
  });
}

function showPoopEditModal(dateStr, dayRecords) {
  const isToday = dateStr === getToday();
  const isFuture = dateStr > getToday();
  showEditModal("💩 " + formatDateDisplay(dateStr) + " " + t("poopEditTitleSuffix"), dateStr, "poop");

  // 如果没有记录，显示添加表单（补打卡）
  if (!dayRecords || dayRecords.length === 0) {
    // 未来日期不能补打卡
    if (isFuture) {
      editModalBody.innerHTML = `<div class="edit-empty" style="text-align:center;padding:24px 0;">${t('futureDateNotAllowed')}</div>`;
      return;
    }

    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">${t('noPoopRecord')}</div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="poopTimeMode" value="default" checked /> ${t('defaultTime')}
        </label>
        <span id="poopDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${defaultTimeStr}</span>
      </div>
      <div class="edit-input-row" id="poopCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="poopCustomTime" value="${defaultTimeStr}" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="poopTimeMode" value="custom" /> ${t('customTime')}
        </label>
      </div>
      <div class="bristol-selector-add" style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('bristolTypeLabel')}</span>
        ${(t("bristolTypes") || []).map((label, i) => `<button class="bristol-btn bristol-btn-add" data-add-type="${i+1}" data-tooltip="${label}(${(t("bristolDescs") || [])[i] || ''})">${i+1}</button>`).join("")}
      </div>
      <div class="poop-amount-selector" style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('poopAmountLabel')}</span>
        ${(t("poopAmounts") || []).map((label, i) => `<button class="poop-amount-btn-sm" data-amount="${i+1}" id="poopAddAmount${i+1}">${label}</button>`).join("")}
      </div>
      <div class="poop-color-selector" style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('poopColorLabel')}</span>
        ${(t("poopColors") || []).map((label, i) => `<button class="poop-color-btn-sm" data-color="${i+1}" id="poopAddColor${i+1}" data-tooltip="${label}" style="background:${POOP_COLOR_MAP[i] || '#eee'};border:2px solid rgba(0,0,0,0.15);"></button>`).join("")}
      </div>
      <div class="edit-input-row" style="margin-top:8px;">
        <input class="edit-input" type="text" id="poopAddRemark" placeholder="${t('remarkPlaceholder')}" />
      </div>
      <button class="edit-save-btn" id="poopAddBtn" style="background: var(--secondary);margin-top:10px;">${t('makeUpCheckinBtn')}</button>
    `;
    
    // 切换时间模式
    document.querySelectorAll('input[name="poopTimeMode"]').forEach(r => {
      r.addEventListener("change", () => {
        const isCustom = r.value === "custom";
        document.getElementById("poopCustomTimeRow").style.display = isCustom ? "flex" : "none";
      });
    });
    
    // 补打卡表单排便量按钮事件
    document.querySelectorAll('.poop-amount-selector .poop-amount-btn-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        const isActive = btn.classList.contains('active');
        document.querySelectorAll('.poop-amount-selector .poop-amount-btn-sm').forEach(b => b.classList.remove('active'));
        if (!isActive) btn.classList.add('active');
      });
    });

    // 补打卡表单大便颜色按钮事件
    editModalBody.querySelectorAll('.poop-color-selector .poop-color-btn-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = parseInt(btn.dataset.color);
        const isActive = btn.classList.contains('active');
        editModalBody.querySelectorAll('.poop-color-selector .poop-color-btn-sm').forEach(b => b.classList.remove('active'));
        if (!isActive) btn.classList.add('active');
      });
    });

    // 补打卡表单 Bristol 按钮事件
    editModalBody.querySelectorAll('.bristol-selector-add .bristol-btn-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = parseInt(btn.dataset.addType);
        const isActive = btn.classList.contains('active');
        editModalBody.querySelectorAll('.bristol-selector-add .bristol-btn-add').forEach(b => b.classList.remove('active'));
        if (!isActive) btn.classList.add('active');
      });
    });
  
    document.getElementById("poopAddBtn").addEventListener("click", () => {
      const remark = document.getElementById("poopAddRemark").value.trim();
      
      let recordTime;
      const timeMode = document.querySelector('input[name="poopTimeMode"]:checked')?.value;
      if (timeMode === "custom") {
        const customVal = document.getElementById("poopCustomTime").value;
        if (customVal) {
          const [h, m] = customVal.split(":");
          recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
        } else {
          recordTime = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
      } else {
        recordTime = isToday ? new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" }) : t("makeUpCheckin");
      }
      
      // 读取补打卡表单中的排便量
      let addAmount = 0;
      document.querySelectorAll('#poopAddAmount1, #poopAddAmount2, #poopAddAmount3').forEach(btn => {
        if (btn.classList.contains('active')) addAmount = parseInt(btn.dataset.amount);
      });
      // 读取补打卡表单中的大便颜色
      let addColor = 0;
      document.querySelectorAll('[id^="poopAddColor"]').forEach(btn => {
        if (btn.classList.contains('active')) addColor = parseInt(btn.dataset.color);
      });
      // 读取补打卡表单中的 Bristol 类型
      let addBristol = 0;
      editModalBody.querySelectorAll('.bristol-selector-add .bristol-btn-add').forEach(btn => {
        if (btn.classList.contains('active')) addBristol = parseInt(btn.dataset.addType);
      });

      chrome.storage.local.get(["poopRecords"], (data) => {
        const records = data.poopRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        const newRec = { time: recordTime, remark, timestamp: Date.now(), isBackfill: !isToday };
        if (addAmount > 0) newRec.amount = addAmount;
        if (addColor > 0) newRec.color = addColor;
        if (addBristol > 0) newRec.bristolType = addBristol;
        records[dateStr].push(newRec);
        persistRecords('poopRecords', records, () => {
          showToast(isToday ? "💩 " + t('checkinSuccess') : "💩 " + t('makeUpCheckinSuccess'));
          renderPoopCalendar();
          updatePoopTodayStatus();
          updatePoopStats();
          chrome.storage.local.get(["poopRecords"], (d) => {
            showPoopEditModal(dateStr, d.poopRecords[dateStr] || []);
          });
        });
      });
    });
    return;
  }
  
  // 解析记录时间
  function parseRecordTimePoop(timeStr) {
    if (!timeStr || timeStr === t("makeUpCheckin")) return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  const bristolTypes = t("bristolTypes") || [];
  const bristolDescs = t("bristolDescs") || [];

  const poopAmounts = t("poopAmounts") || [];
  const poopColors = t("poopColors") || [];

  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTimePoop(rec.time);
    const bristolBtns = bristolTypes.map((label, i) => {
      const isActive = rec.bristolType === (i + 1);
      return `<button class="bristol-btn ${isActive ? 'active' : ''}" data-idx="${idx}" data-type="${i+1}" data-tooltip="${label}(${bristolDescs[i] || ''})">${i+1}</button>`;
    }).join("");
    const bristolLabel = rec.bristolType ? `${bristolTypes[rec.bristolType-1] || ''}(${t('bristolPrefix') || 'Bristol '}${rec.bristolType})` : "";
    const amountBtns = poopAmounts.map((label, i) => {
      const isActive = rec.amount === (i + 1);
      return `<button class="poop-amount-btn-sm ${isActive ? 'active' : ''}" data-idx="${idx}" data-amount="${i+1}">${label}</button>`;
    }).join("");

    return `
    <div class="edit-record-item" data-index="${idx}">
      <div class="edit-record-header">
        <span class="edit-record-time">${t('poopRecord', { num: idx + 1, time: rec.time })}</span>
        <div class="edit-record-actions">
          <button class="edit-btn-edit" data-action="edit-poop" data-index="${idx}">${t('edit')}</button>
          <button class="edit-btn-delete" data-action="delete-poop" data-index="${idx}">${t('delete')}</button>
        </div>
      </div>
      <div class="edit-record-content" id="poopContent${idx}" style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px;">
        ${rec.remark ? rec.remark : (bristolLabel ? `💩 ${bristolLabel}` : t('noRemark'))}
      </div>
      <div style="font-size:11px;color:var(--muted);background:rgba(0,0,0,0.03);border-radius:6px;padding:8px 10px;margin-bottom:8px;">
        ${bristolLabel ? `<div style="margin-bottom:3px;">🎯 Bristol: ${bristolLabel}</div>` : ''}
        <div style="margin-bottom:3px;">💩 ${t('poopAmountLabel')}: ${rec.amount ? poopAmounts[rec.amount - 1] || '' : t('noRemark')}</div>
        <div>🟤 ${t('poopColorLabel')}: <span class="poop-color-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${rec.color ? POOP_COLOR_MAP[rec.color - 1] || '#eee' : 'rgba(0,0,0,0.08)'};vertical-align:middle;"></span> ${rec.color ? poopColors[rec.color - 1] || '' : t('poopColorNotSelected')}</div>
      </div>
      <div style="font-size:10px;color:var(--muted);white-space:nowrap;margin-top:4px;">${t('bristolTypeLabel')}</div>
      <div class="bristol-selector" data-record-idx="${idx}" style="margin-top:4px;">${bristolBtns}</div>
      <div class="poop-amount-selector" data-record-idx="${idx}" style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('poopAmountLabel')}</span>
        ${amountBtns}
      </div>
      <div class="poop-color-label" style="font-size:10px;color:var(--muted);white-space:nowrap;margin-top:6px;">${t('poopColorLabel')}</div>
      <div class="poop-color-picker expanded" data-idx="${idx}" style="margin-top:4px;">
        ${poopColors.map((label, i) => `<button class="poop-color-btn-sm ${rec.color === (i+1) ? 'active' : ''}" data-idx="${idx}" data-color="${i+1}" data-tooltip="${label}" style="background:${POOP_COLOR_MAP[i] || '#eee'};border:2px solid ${rec.color === (i+1) ? 'var(--poop)' : 'rgba(0,0,0,0.15)'};"></button>`).join("")}
      </div>
      <div class="edit-input-row" id="poopEditFormTime${idx}" style="display:none;align-items:center;margin-top:8px;">
        <input type="time" class="edit-input" id="poopEditTime${idx}" value="${parsedTime}" placeholder="HH:mm" style="width:auto;flex:none;" />
        <span style="font-size:11px;color:#999;white-space:nowrap;margin-left:12px;">${t('modifyRecordTime')}</span>
      </div>
      <div class="edit-input-row" id="poopEditForm${idx}" style="display:none;">
        <input class="edit-input" type="text" id="poopEditContent${idx}" value="${rec.remark || ""}" placeholder="${t('editRemarkPlaceholder')}" />
        <button class="edit-save-btn" data-action="save-poop" data-index="${idx}">${t('saveEdit')}</button>
      </div>
    </div>
  `;
  }).join("");

  // Bristol 按钮点击事件（事件委托）
  editModalBody.querySelectorAll(".bristol-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(btn.dataset.idx);
      const type = Number(btn.dataset.type);
      chrome.storage.local.get(["poopRecords"], (data) => {
        const records = data.poopRecords || {};
        if (records[currentEditDate] && records[currentEditDate][idx]) {
          // 切换：再次点击同一类型则取消
          const cur = records[currentEditDate][idx].bristolType;
          records[currentEditDate][idx].bristolType = (cur === type) ? null : type;
          persistRecords('poopRecords', records, () => {
            // 刷新弹窗
            chrome.storage.local.get(["poopRecords"], (d) => {
              if (d.poopRecords && d.poopRecords[currentEditDate]) {
                showPoopEditModal(currentEditDate, d.poopRecords[currentEditDate]);
              }
            });
          });
        }
      });
    });
  });

  // 排便量按钮点击事件
  editModalBody.querySelectorAll(".poop-amount-btn-sm").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(btn.dataset.idx);
      const amount = Number(btn.dataset.amount);
      chrome.storage.local.get(["poopRecords"], (data) => {
        const records = data.poopRecords || {};
        if (records[currentEditDate] && records[currentEditDate][idx]) {
          const cur = records[currentEditDate][idx].amount;
          records[currentEditDate][idx].amount = (cur === amount) ? null : amount;
          persistRecords('poopRecords', records, () => {
            chrome.storage.local.get(["poopRecords"], (d) => {
              if (d.poopRecords && d.poopRecords[currentEditDate]) {
                showPoopEditModal(currentEditDate, d.poopRecords[currentEditDate]);
              }
            });
          });
        }
      });
    });
  });

  // 大便颜色：点击显示区 → 展开/收起选择面板
  editModalBody.querySelectorAll(".poop-color-display").forEach(display => {
    display.addEventListener("click", () => {
      const idx = display.dataset.idx;
      const picker = editModalBody.querySelector(`.poop-color-picker[data-idx="${idx}"]`);
      if (!picker) return;
      // 关闭其他已展开的面板
      editModalBody.querySelectorAll(".poop-color-picker.expanded").forEach(p => {
        if (p !== picker) p.classList.remove("expanded");
      });
      picker.classList.toggle("expanded");
    });
  });

  // 大便颜色按钮点击事件
  editModalBody.querySelectorAll(".poop-color-btn-sm").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = Number(btn.dataset.idx);
      const color = Number(btn.dataset.color);
      chrome.storage.local.get(["poopRecords"], (data) => {
        const records = data.poopRecords || {};
        if (records[currentEditDate] && records[currentEditDate][idx]) {
          const cur = records[currentEditDate][idx].color;
          records[currentEditDate][idx].color = (cur === color) ? null : color;
          persistRecords('poopRecords', records, () => {
            chrome.storage.local.get(["poopRecords"], (d) => {
              if (d.poopRecords && d.poopRecords[currentEditDate]) {
                showPoopEditModal(currentEditDate, d.poopRecords[currentEditDate]);
              }
            });
          });
        }
      });
    });
  });
}

function openPoopEditForm(idx) {
  document.getElementById("poopEditForm" + idx).style.display = "block";
  document.getElementById("poopContent" + idx).style.display = "none";
}

function savePoopRecord(idx) {
  const newRemark = document.getElementById("poopEditContent" + idx).value.trim();
  
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    if (records[currentEditDate] && records[currentEditDate][idx]) {
      records[currentEditDate][idx].remark = newRemark;
      persistRecords('poopRecords', records, () => {
        showToast(t("toastEditSuccess"));
        renderPoopCalendar();
        updatePoopTodayStatus();
        updatePoopStats();
        chrome.storage.local.get(["poopRecords"], (d) => {
          if (d.poopRecords && d.poopRecords[currentEditDate]) {
            showPoopEditModal(currentEditDate, d.poopRecords[currentEditDate]);
          }
        });
      });
    }
  });
}

function deletePoopRecord(idx, dateStr) {
  showConfirm(t("confirmDeleteRecord"), () => {
    const targetDate = dateStr || currentEditDate;
    const isModal = !dateStr;

    _deleteRecordFromStorage("poopRecords", targetDate, idx, (records, targetDate, isEmpty) => {
      // Toast is already shown by the helper function
      renderPoopCalendar();
      updatePoopTodayStatus();
      updatePoopStats();
      if (isModal) {
        if (isEmpty) {
          hideEditModal();
        } else {
          showPoopEditModal(targetDate, records[targetDate]);
        }
      }
    });
  });
}

function showPoopTooltip(e, dateStr) {
  clearTimeout(poopTooltipTimeout);
  poopTooltipTimeout = setTimeout(() => {
    chrome.storage.local.get(["poopRecords"], (data) => {
      const records = data.poopRecords || {};
      const dayRecords = records[dateStr] || [];
      const bristolTypes = t("bristolTypes") || [];
      document.getElementById("tooltipDate").textContent = formatDateDisplay(dateStr);
      const countEl = document.getElementById("tooltipCount");
      countEl.textContent = '💩 ' + dayRecords.length + t('times');
      countEl.classList.remove("pee-count");

      if (dayRecords.length > 0) {
        const poopAmounts = t("poopAmounts") || [];
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => {
          let bristolInfo = "";
          if (rec.bristolType) {
            const bt = bristolTypes[rec.bristolType - 1] || "";
            bristolInfo = `Bristol ${rec.bristolType}: ${bt}`;
          }
          const amountHtml = rec.amount ? `💩 ${t('poopAmountLabel')}: ${poopAmounts[rec.amount - 1] || ""}` : "";
          let colorHtml = "";
          if (rec.color) {
            const colorHex = POOP_COLOR_MAP[rec.color - 1] || '#eee';
            const poopColors = t("poopColors") || [];
            const colorLabel = poopColors[rec.color - 1] || "";
            colorHtml = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorHex};vertical-align:middle;margin-right:4px;" data-tooltip="${colorLabel}"></span>${colorLabel}`;
          }
          const remarkHtml = rec.remark ? rec.remark : '';
          const lines = [];
          if (bristolInfo) lines.push(`🎯 ${bristolInfo}`);
          if (amountHtml) lines.push(amountHtml);
          if (colorHtml) lines.push(`🟤 ${t('poopColorLabel')}: ${colorHtml}`);
          lines.push(`📝 ${remarkHtml || t('noRemark')}`);
          return `
            <div class="tooltip-record">
              <div class="tooltip-record-time">${t('poopRecord', { num: i + 1, time: rec.time })}</div>
              <div class="tooltip-record-detail">
                ${lines.map(l => `<div>${l}</div>`).join("")}
              </div>
            </div>
          `;
        }).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">' + t('tooltipEmptyRecord') + '</div>';
      }

      positionTooltip(e);
      activeTooltipDate = dateStr;
      activeTooltipType = "poop";
      document.getElementById("tooltip").classList.add("show");
    });
  }, 100);
}

function hidePoopTooltip(e) {
  clearTimeout(poopTooltipTimeout);
  if (e && tooltipEl.contains(e.relatedTarget)) return;
  tooltipHideTimeout = setTimeout(() => {
    document.getElementById("tooltip").classList.remove("show");
  }, 200);
}

// === tooltip 自身 hover 保持显示 + 点击编辑 ===
let tooltipHideTimeout = null;
let activeTooltipDate = null;   // 当前tooltip对应的日期
let activeTooltipType = null;   // "eat" | "drink" | "poop" | "pee"
const tooltipEl = document.getElementById("tooltip");
tooltipEl.addEventListener("mouseenter", () => {
  clearTimeout(tooltipHideTimeout);
  clearTimeout(eatTooltipTimeout);
  clearTimeout(drinkTooltipTimeout);
  clearTimeout(poopTooltipTimeout);
});
tooltipEl.addEventListener("mouseleave", () => {
  tooltipHideTimeout = setTimeout(() => {
    tooltipEl.classList.remove("show");
  }, 200);
});
// 点击 tooltip 进入编辑
tooltipEl.addEventListener("click", () => {
  if (!activeTooltipDate || !activeTooltipType) return;
  tooltipEl.classList.remove("show");
  const dateStr = activeTooltipDate;
  if (activeTooltipType === "eat") {
    chrome.storage.local.get(["mealRecords"], (data) => {
      showEatEditModal(dateStr, data.mealRecords?.[dateStr] || []);
    });
  } else if (activeTooltipType === "poop") {
    chrome.storage.local.get(["poopRecords"], (data) => {
      showPoopEditModal(dateStr, data.poopRecords?.[dateStr] || []);
    });
  } else if (activeTooltipType === "pee") {
    chrome.storage.local.get(["peeRecords"], (data) => {
      showPeeEditModal(dateStr, data.peeRecords?.[dateStr] || []);
    });
  }
});

function positionTooltip(e) {
  const rect = e.target.getBoundingClientRect();
  let left = rect.right + 10;
  let top = rect.top - 10;
  if (left + 220 > window.innerWidth) left = rect.left - 230;
  if (left < 10) left = 10;
  if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
  if (top < 10) top = 10;
  document.getElementById("tooltip").style.left = left + "px";
  document.getElementById("tooltip").style.top = top + "px";
}

poopToggleBtn.addEventListener("click", () => {
  poopIsExpanded = !poopIsExpanded;
  poopToggleBtn.classList.toggle("collapsed", !poopIsExpanded);
  poopRecordsList.classList.toggle("collapsed", !poopIsExpanded);
});

poopRecordsHeader.addEventListener("click", (e) => {
  if (e.target === poopToggleBtn) return;
  poopIsExpanded = !poopIsExpanded;
  poopToggleBtn.classList.toggle("collapsed", !poopIsExpanded);
  poopRecordsList.classList.toggle("collapsed", !poopIsExpanded);
});

poopCheckinBtn.addEventListener("click", () => {
  const today = getToday();
  const time = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  const remark = poopRemarkInput.value.trim();

  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    if (!records[today]) records[today] = [];
    const record = { time, remark, timestamp: Date.now() };
    if (selectedBristolType > 0) {
      record.bristolType = selectedBristolType;
    }
    if (selectedPoopAmount > 0) {
      record.amount = selectedPoopAmount;
    }
    if (selectedPoopColor > 0) {
      record.color = selectedPoopColor;
    }
    records[today].push(record);
    persistRecords('poopRecords', records, () => {
      poopRemarkInput.value = "";
      clearBristolSelection();
      clearPoopAmount();
      clearPoopColor();
      renderPoopCalendar();
      updatePoopTodayStatus();
      updatePoopStats();
      showToast(t("toastPoopRecorded"));
    });
  });
});

// 拉屎页面：自动同步当天的饮食备注
function syncMealRemarkToPoop() {
  const today = getToday();
  chrome.storage.local.get(["mealRecords"], (data) => {
    const mealRecords = data.mealRecords || {};
    const todayMeals = mealRecords[today] || [];
    
    if (todayMeals.length > 0) {
      // 收集所有饮食备注和评价
      const remarks = todayMeals
        .filter(m => m.remark)
        .map(m => m.remark);
      const ratings = todayMeals
        .filter(m => m.rating)
        .map(m => `${m.rating}/5 ${getRatingText(m.rating)}`);
      
      let syncText = "";
      if (remarks.length > 0) {
        syncText += t('mealRemarkLabel') + ': ' + remarks.join("; ");
      }
      if (ratings.length > 0) {
        syncText += (syncText ? " | " : "") + `${t('rateLabelShort')}: ${ratings.join(", ")}`;
      }
      
      if (syncText && poopRemarkInput) {
        // 如果备注框为空，自动填充；否则追加
        if (!poopRemarkInput.value.trim()) {
          poopRemarkInput.value = syncText;
          showToast(t("toastRemarkSynced"));
        }
      }
    }
  });
}

function updatePoopTodayStatus() {
  const today = getToday();
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    const todayRecord = records[today];
    const poopColors = t("poopColors") || [];
    if (todayRecord && todayRecord.length > 0) {
      poopTodaySection.style.display = "block";
      poopTodayCount.textContent = todayRecord.length;
      poopRecordsList.innerHTML = todayRecord.map((rec, idx) => `
        <div class="record-item" data-index="${idx}">
          <span class="record-time">${rec.time}</span>
          <span class="record-remark">${rec.remark || t('noRemark')}</span>
          ${rec.color ? `<span class="record-color-dot" style="background:${POOP_COLOR_MAP[rec.color - 1] || '#eee'};" data-tooltip="${poopColors[rec.color - 1] || ""}"></span>` : ""}
          <div class="record-actions">
            <button class="record-action-btn edit-poop-record" data-index="${idx}" data-tooltip="${t('editTitle')}">✏️</button>
            <button class="record-action-btn delete-poop-record" data-index="${idx}" data-tooltip="${t('deleteTitle')}">🗑️</button>
          </div>
        </div>
      `).join("");

    } else {
      poopTodaySection.style.display = "none";
    }
  });
}

function updatePoopStats() {
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    let count = 0;
    let idealCount = 0;
    let hardCount = 0;
    let softCount = 0;
    let totalWithBristol = 0;
    const today = getToday();

    if (poopStatsMode === "week") {
      const range = getWeekRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        dayRecords.forEach(rec => {
          if (rec.bristolType) {
            totalWithBristol++;
            if (rec.bristolType >= 3 && rec.bristolType <= 4) {
              idealCount++;
            } else if (rec.bristolType <= 2) {
              hardCount++;
            } else {
              softCount++;
            }
          }
        });
        cur.setDate(cur.getDate() + 1);
      }
      poopStatsLabel.textContent = t('weekTotal');
    } else {
      const range = getMonthRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        dayRecords.forEach(rec => {
          if (rec.bristolType) {
            totalWithBristol++;
            if (rec.bristolType >= 3 && rec.bristolType <= 4) {
              idealCount++;
            } else if (rec.bristolType <= 2) {
              hardCount++;
            } else {
              softCount++;
            }
          }
        });
        cur.setDate(cur.getDate() + 1);
      }
      poopStatsLabel.textContent = t('monthTotal');
    }
    poopStatsCount.textContent = count;

    // 显示详细统计
    const detailEl = document.getElementById("poopStatsDetail");
    if (detailEl) {
      let html = "";
      if (totalWithBristol > 0) {
        html += `<span class="stats-detail-item">${t('idealCount', { n: idealCount }).replace(/\d+/, '<span class="detail-val">$&</span>')}</span>`;
        html += `<span class="stats-detail-item">${t('hardCount', { n: hardCount }).replace(/\d+/, '<span class="detail-val">$&</span>')}</span>`;
        html += `<span class="stats-detail-item">${t('softCount', { n: softCount }).replace(/\d+/, '<span class="detail-val">$&</span>')}</span>`;
      }
      // 连续理想天数（最多回溯 365 天，防止空数据时无限循环）
      let streak = 0;
      const d = new Date(today);
      const maxLookback = 365;
      for (let i = 0; i < maxLookback; i++) {
        const ds = formatDate(d);
        const dayRecords = records[ds] || [];
        const hasIdeal = dayRecords.some(rec => rec.bristolType && rec.bristolType >= 3 && rec.bristolType <= 4);
        const hasAny = dayRecords.length > 0;
        if (hasIdeal) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else if (!hasAny) {
          d.setDate(d.getDate() - 1);
          continue;
        } else {
          break;
        }
      }
      if (streak > 0) {
        html += `<span class="stats-detail-item">${t('consecutiveIdeal', { n: streak }).replace(/\d+/, '<span class="detail-val">$&</span>')}</span>`;
      }
      detailEl.innerHTML = html;
    }
  });
}

poopWeekBtn.addEventListener("click", () => {
  poopStatsMode = "week";
  poopWeekBtn.classList.add("active");
  poopMonthBtn.classList.remove("active");
  updatePoopStats();
});

poopMonthBtn.addEventListener("click", () => {
  poopStatsMode = "month";
  poopMonthBtn.classList.add("active");
  poopWeekBtn.classList.remove("active");
  updatePoopStats();
});

document.getElementById("poopPrevMonth").addEventListener("click", () => {
  poopMonth--;
  if (poopMonth < 0) { poopMonth = 11; poopYear--; }
  renderPoopCalendar();
});

document.getElementById("poopNextMonth").addEventListener("click", () => {
  poopMonth++;
  if (poopMonth > 11) { poopMonth = 0; poopYear++; }
  renderPoopCalendar();
});

// 排尿模块
let peeYear = new Date().getFullYear();
let peeMonth = new Date().getMonth();
let peeStatsMode = "week";
let peeTooltipTimeout = null;

const peeCalendarTitle = document.getElementById("peeCalendarTitle");
const peeCalendarDays = document.getElementById("peeCalendarDays");
const peeRemarkInput = document.getElementById("peeRemarkInput");
const peeCheckinBtn = document.getElementById("peeCheckinBtn");
const peeTodaySection = document.getElementById("peeTodaySection");
const peeRecordsHeader = document.getElementById("peeRecordsHeader");
const peeRecordsList = document.getElementById("peeRecordsList");
const peeToggleBtn = document.getElementById("peeToggleBtn");
const peeTodayCount = document.getElementById("peeTodayCount");
const peeWeekBtn = document.getElementById("peeWeekBtn");
const peeMonthBtn = document.getElementById("peeMonthBtn");
const peeStatsCount = document.getElementById("peeStatsCount");
const peeStatsLabel = document.getElementById("peeStatsLabel");

let peeIsExpanded = true;

function renderPeeCalendar() {
  const firstDay = new Date(peeYear, peeMonth, 1);
  const lastDay = new Date(peeYear, peeMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  peeCalendarTitle.textContent = t("yearMonth", { y: peeYear, m: peeMonth + 1 });
  peeCalendarDays.innerHTML = "";
  
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    const today = getToday();
    
    for (let i = 0; i < startWeekday; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      emptyCell.style.width = "36px";
      emptyCell.style.height = "36px";
      peeCalendarDays.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cell = document.createElement("div");
      const dateStr = `${peeYear}-${String(peeMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.textContent = day;
      cell.className = "day-cell";
      cell.dataset.date = dateStr;
      if (dateStr === today) cell.classList.add("today");
      if (records[dateStr]) cell.classList.add("has-pee");
      cell.addEventListener("mouseenter", (e) => showPeeTooltip(e, dateStr));
      cell.addEventListener("mouseleave", hidePeeTooltip);
      cell.addEventListener("click", () => {
        hidePeeTooltip();
        showPeeEditModal(dateStr, records[dateStr] || []);
      });
      peeCalendarDays.appendChild(cell);
    }
  });
}

function showPeeEditModal(dateStr, dayRecords) {
  const isToday = dateStr === getToday();
  showEditModal("💧 " + formatDateDisplay(dateStr) + " " + t("peeEditTitleSuffix"), dateStr, "pee");
  
  // 如果没有记录，显示添加表单（补打卡）
  if (!dayRecords || dayRecords.length === 0) {
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    // 渲染颜色选择器（补打卡表单）
    const peeColors = t("peeColors") || [];
    const colorBtns = peeColors.map((label, i) =>
      `<button class="pee-color-btn-sm" data-color="${i+1}" data-tooltip="${label}" style="background:${PEE_COLOR_MAP[i] || '#eee'};border:2px solid rgba(0,0,0,0.15);"></button>`
    ).join("");

    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">${t('noPeeRecord')}</div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="peeTimeMode" value="default" checked /> ${t('defaultTime')}
        </label>
        <span id="peeDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${defaultTimeStr}</span>
      </div>
      <div class="edit-input-row" id="peeCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="peeCustomTime" value="${defaultTimeStr}" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="peeTimeMode" value="custom" /> ${t('customTime')}
        </label>
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="peeAddRemark" placeholder="${t('remarkPlaceholder')}" />
      </div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--muted);">${t('peeColorLabel')}:</span>
        ${colorBtns}
        <span id="peeAddColorLabel" style="font-size:11px;color:var(--pee);font-weight:600;"></span>
      </div>
      <button class="edit-save-btn" id="peeAddBtn" style="background: var(--pee);">${t('makeUpCheckinBtn')}</button>
    `;
    
    // 切换时间模式
    document.querySelectorAll('input[name="peeTimeMode"]').forEach(r => {
      r.addEventListener("change", () => {
        document.getElementById("peeCustomTimeRow").style.display = r.value === "custom" ? "flex" : "none";
      });
    });

    // 补打卡表单：颜色按钮点击事件
    let addFormColor = 0;
    editModalBody.querySelectorAll(".pee-color-btn-sm").forEach(btn => {
      btn.addEventListener("click", () => {
        const color = parseInt(btn.dataset.color);
        const label = btn.dataset.tooltip;
        if (addFormColor === color) {
          addFormColor = 0;
          btn.classList.remove("active");
          btn.style.border = "2px solid rgba(0,0,0,0.15)";
          document.getElementById("peeAddColorLabel").textContent = "";
        } else {
          addFormColor = color;
          editModalBody.querySelectorAll(".pee-color-btn-sm").forEach(b => {
            b.classList.remove("active");
            b.style.border = "2px solid rgba(0,0,0,0.15)";
          });
          btn.classList.add("active");
          btn.style.border = "2px solid var(--pee)";
          document.getElementById("peeAddColorLabel").textContent = label;
        }
      });
    });
    
    document.getElementById("peeAddBtn").addEventListener("click", () => {
      const remark = document.getElementById("peeAddRemark").value.trim();
      
      let recordTime;
      const timeMode = document.querySelector('input[name="peeTimeMode"]:checked')?.value;
      if (timeMode === "custom") {
        const customVal = document.getElementById("peeCustomTime").value;
        if (customVal) {
          const [h, m] = customVal.split(":");
          recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
        } else {
          recordTime = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
      } else {
        recordTime = isToday ? new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" }) : t("makeUpCheckin");
      }
      
      chrome.storage.local.get(["peeRecords"], (data) => {
        const records = data.peeRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        records[dateStr].push({ time: recordTime, remark, amount: selectedPeeAmount, color: addFormColor, timestamp: Date.now(), isBackfill: !isToday });
        persistRecords('peeRecords', records, () => {
          showToast(isToday ? "💧 " + t('checkinSuccess') : "💧 " + t('makeUpCheckinSuccess'));
          renderPeeCalendar();
          updatePeeTodayStatus();
          updatePeeStats();
          chrome.storage.local.get(["peeRecords"], (d) => {
            showPeeEditModal(dateStr, d.peeRecords[dateStr] || []);
          });
        });
      });
    });
    return;
  }
  
  // 解析记录时间
  function parseRecordTimePee(timeStr) {
    if (!timeStr || timeStr === t("makeUpCheckin")) return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  const peeAmounts = t("peeAmounts") || [];
  const peeColors = t("peeColors") || [];
  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTimePee(rec.time);

    // 尿量按钮
    const amountBtns = peeAmounts.map((label, i) => {
      const isActive = rec.amount === (i + 1);
      return `<button class="pee-amount-btn-sm ${isActive ? 'active' : ''}" data-idx="${idx}" data-amount="${i+1}">${label}</button>`;
    }).join("");
    const amountLabel = rec.amount ? peeAmounts[rec.amount - 1] || "" : "";

    // 颜色按钮
    const colorBtns = peeColors.map((label, i) => {
      const colorNum = i + 1;
      const isActive = rec.color === colorNum;
      const bgColor = PEE_COLOR_MAP[i] || '#eee';
      return `<button class="pee-color-btn-sm ${isActive ? 'active' : ''}" data-idx="${idx}" data-color="${colorNum}" data-tooltip="${label}" style="background:${bgColor};border:2px solid ${isActive ? 'var(--pee)' : 'rgba(0,0,0,0.15)'};"></button>`;
    }).join("");
    const colorLabel = rec.color ? peeColors[rec.color - 1] || "" : "";

    return `
    <div class="edit-record-item" data-index="${idx}">
      <div class="edit-record-header">
        <span class="edit-record-time">${t('peeRecord', { num: idx + 1, time: rec.time })}</span>
        <div class="edit-record-actions">
          <button class="edit-btn-edit" data-action="edit-pee" data-index="${idx}">${t('edit')}</button>
          <button class="edit-btn-delete" data-action="delete-pee" data-index="${idx}">${t('delete')}</button>
        </div>
      </div>
      <div class="edit-record-content" id="peeContent${idx}">${rec.remark || t('noRemark')}</div>
      <div class="pee-amount-selector" data-record-idx="${idx}" style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('peeAmountLabel')}</span>
        ${amountBtns}
      </div>
      <div class="pee-color-selector" data-record-idx="${idx}" style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap;">${t('peeColorLabel')}</span>
        ${colorBtns}
      </div>
      <div class="edit-input-row" id="peeEditFormTime${idx}" style="display:none;align-items:center;">
        <input type="time" class="edit-input" id="peeEditTime${idx}" value="${parsedTime}" placeholder="HH:mm" style="width:auto;flex:none;" />
        <span style="font-size:11px;color:#999;white-space:nowrap;margin-left:12px;">${t('modifyRecordTime')}</span>
      </div>
      <div class="edit-input-row" id="peeEditForm${idx}" style="display:none;">
        <input class="edit-input" type="text" id="peeEditContent${idx}" value="${rec.remark || ""}" placeholder="${t('editRemarkPlaceholder')}" />
        <button class="edit-save-btn" data-action="save-pee" data-index="${idx}">${t('saveEdit')}</button>
      </div>
    </div>
  `;
  }).join("");

  // 尿量按钮点击事件（事件委托）
  editModalBody.querySelectorAll(".pee-amount-btn-sm").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const amount = Number(btn.dataset.amount);
      chrome.storage.local.get(["peeRecords"], (data) => {
        const records = data.peeRecords || {};
        if (records[currentEditDate] && records[currentEditDate][idx]) {
          const cur = records[currentEditDate][idx].amount;
          records[currentEditDate][idx].amount = (cur === amount) ? null : amount;
          persistRecords('peeRecords', records, () => {
            chrome.storage.local.get(["peeRecords"], (d) => {
              if (d.peeRecords && d.peeRecords[currentEditDate]) {
                showPeeEditModal(currentEditDate, d.peeRecords[currentEditDate]);
              }
            });
          });
        }
      });
    });
  });

  // 尿液颜色按钮点击事件（事件委托）
  editModalBody.querySelectorAll(".pee-color-btn-sm").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const color = Number(btn.dataset.color);
      chrome.storage.local.get(["peeRecords"], (data) => {
        const records = data.peeRecords || {};
        if (records[currentEditDate] && records[currentEditDate][idx]) {
          const cur = records[currentEditDate][idx].color;
          records[currentEditDate][idx].color = (cur === color) ? null : color;
          persistRecords('peeRecords', records, () => {
            chrome.storage.local.get(["peeRecords"], (d) => {
              if (d.peeRecords && d.peeRecords[currentEditDate]) {
                showPeeEditModal(currentEditDate, d.peeRecords[currentEditDate]);
              }
            });
          });
        }
      });
    });
  });
}

function openPeeEditForm(idx) {
  document.getElementById("peeEditForm" + idx).style.display = "block";
  document.getElementById("peeContent" + idx).style.display = "none";
}

function savePeeRecord(idx) {
  const newRemark = document.getElementById("peeEditContent" + idx).value.trim();
  
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    if (records[currentEditDate] && records[currentEditDate][idx]) {
      records[currentEditDate][idx].remark = newRemark;
      persistRecords('peeRecords', records, () => {
        showToast(t("toastEditSuccess"));
        renderPeeCalendar();
        updatePeeTodayStatus();
        updatePeeStats();
        chrome.storage.local.get(["peeRecords"], (d) => {
          if (d.peeRecords && d.peeRecords[currentEditDate]) {
            showPeeEditModal(currentEditDate, d.peeRecords[currentEditDate]);
          }
        });
      });
    }
  });
}

function deletePeeRecord(idx, dateStr) {
  showConfirm(t("confirmDeleteRecord"), () => {
    const targetDate = dateStr || currentEditDate;
    const isModal = !dateStr;

    _deleteRecordFromStorage("peeRecords", targetDate, idx, (records, targetDate, isEmpty) => {
      // Toast is already shown by the helper function
      renderPeeCalendar();
      updatePeeTodayStatus();
      updatePeeStats();
      if (isModal) {
        if (isEmpty) {
          hideEditModal();
        } else {
          showPeeEditModal(targetDate, records[targetDate]);
        }
      }
    });
  });
}

function showPeeTooltip(e, dateStr) {
  clearTimeout(peeTooltipTimeout);
  peeTooltipTimeout = setTimeout(() => {
    chrome.storage.local.get(["peeRecords"], (data) => {
      const records = data.peeRecords || {};
      const dayRecords = records[dateStr] || [];
      document.getElementById("tooltipDate").textContent = formatDateDisplay(dateStr);
      const countEl = document.getElementById("tooltipCount");
      countEl.textContent = '💧 ' + dayRecords.length + t('times');
      countEl.classList.add("pee-count");

      if (dayRecords.length > 0) {
        const peeAmounts = t("peeAmounts") || [];
        const peeColors = t("peeColors") || [];
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => {
          let amountInfo = "";
          if (rec.amount) {
            amountInfo = `<span style="color:var(--pee);font-weight:600;margin-left:4px;">${peeAmounts[rec.amount - 1] || ""}</span>`;
          }
          let colorInfo = "";
          if (rec.color) {
            const colorHex = PEE_COLOR_MAP[rec.color - 1] || '#eee';
            const colorLabel = peeColors[rec.color - 1] || "";
            colorInfo = ` <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorHex};vertical-align:middle;margin-left:4px;" data-tooltip="${colorLabel}"></span>`;
          }
          return `
          <div class="tooltip-record">
            <div class="tooltip-record-time">${t('peeRecord', { num: i + 1, time: rec.time })} ${amountInfo}${colorInfo}</div>
            ${rec.remark ? `<div class="tooltip-record-remark">${rec.remark}</div>` : ""}
          </div>
        `;
        }).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">' + t('tooltipEmptyRecord') + '</div>';
      }

      positionTooltip(e);
      activeTooltipDate = dateStr;
      activeTooltipType = "pee";
      document.getElementById("tooltip").classList.add("show");
    });
  }, 100);
}

function hidePeeTooltip(e) {
  clearTimeout(peeTooltipTimeout);
  if (e && tooltipEl.contains(e.relatedTarget)) return;
  tooltipHideTimeout = setTimeout(() => {
    document.getElementById("tooltip").classList.remove("show");
  }, 200);
}

// ==================== 尿量选择器 ====================
let selectedPeeAmount = 0; // 0=未选, 1=少, 2=中, 3=多
const peeAmountBtns = document.getElementById("peeAmountBtns");

function renderPeeAmountSelector() {
  const amounts = t("peeAmounts") || [];
  if (!peeAmountBtns) return;
  peeAmountBtns.innerHTML = amounts.map((label, i) =>
    `<button class="pee-amount-btn" data-amount="${i+1}">${label}</button>`
  ).join("");

  peeAmountBtns.querySelectorAll(".pee-amount-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const amount = parseInt(btn.dataset.amount);
      if (selectedPeeAmount === amount) {
        selectedPeeAmount = 0;
        btn.classList.remove("active");
      } else {
        selectedPeeAmount = amount;
        peeAmountBtns.querySelectorAll(".pee-amount-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });
}

function clearPeeAmount() {
  selectedPeeAmount = 0;
  peeAmountBtns?.querySelectorAll(".pee-amount-btn").forEach(b => b.classList.remove("active"));
}

// ==================== 尿液颜色选择器 ====================
const PEE_COLOR_MAP = [
  "#e8f4f8",   // 1: 透明/极淡
  "#ffffcc",   // 2: 淡黄
  "#ffcc00",   // 3: 黄色
  "#ff9900",   // 4: 深黄
  "#c87533",   // 5: 茶色/琥珀
  "#8b4513"    // 6: 异常深褐色
];

const POOP_COLOR_MAP = [
  "#8B5E3C",   // 1: 深褐色 Dark Brown
  "#C4A882",   // 2: 浅褐色 Light Brown
  "#E5A443",   // 3: 黄色 Yellow
  "#6B8E23",   // 4: 绿色 Green
  "#2C2C2C",   // 5: 黑色 Black
  "#C0392B",   // 6: 红色 Red
  "#C0BDB8"    // 7: 灰白色 Clay/Grey
];

let selectedPeeColor = 0; // 0=未选, 1~6 对应颜色

function renderPeeColorSelector() {
  const colors = t("peeColors") || [];
  const container = document.getElementById("peeColorBtns");
  if (!container) return;
  container.innerHTML = colors.map((label, i) =>
    `<button class="pee-color-btn" data-color="${i+1}" data-tooltip="${label}" style="background:${PEE_COLOR_MAP[i] || '#eee'};"></button>`
  ).join("");

  container.querySelectorAll(".pee-color-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const color = parseInt(btn.dataset.color);
      if (selectedPeeColor === color) {
        selectedPeeColor = 0;
        btn.classList.remove("active");
      } else {
        selectedPeeColor = color;
        container.querySelectorAll(".pee-color-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  });
}

function clearPeeColor() {
  selectedPeeColor = 0;
  const container = document.getElementById("peeColorBtns");
  container?.querySelectorAll(".pee-color-btn").forEach(b => b.classList.remove("active"));
}

peeToggleBtn.addEventListener("click", () => {
  peeIsExpanded = !peeIsExpanded;
  peeToggleBtn.classList.toggle("collapsed", !peeIsExpanded);
  peeRecordsList.classList.toggle("collapsed", !peeIsExpanded);
});

peeRecordsHeader.addEventListener("click", (e) => {
  if (e.target === peeToggleBtn) return;
  peeIsExpanded = !peeIsExpanded;
  peeToggleBtn.classList.toggle("collapsed", !peeIsExpanded);
  peeRecordsList.classList.toggle("collapsed", !peeIsExpanded);
});

peeCheckinBtn.addEventListener("click", () => {
  const today = getToday();
  const time = new Date().toLocaleTimeString(currentLang === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  const remark = peeRemarkInput.value.trim();

  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, remark, amount: selectedPeeAmount, color: selectedPeeColor, timestamp: Date.now() });
    persistRecords('peeRecords', records, () => {
      peeRemarkInput.value = "";
      renderPeeCalendar();
      updatePeeTodayStatus();
      updatePeeStats();
      showToast(t("toastPeeRecorded"));
      clearPeeAmount();
      clearPeeColor();
    });
  });
});

// 撒尿页面：自动同步当天的饮食备注
function syncMealRemarkToPee() {
  const today = getToday();
  chrome.storage.local.get(["mealRecords"], (data) => {
    const mealRecords = data.mealRecords || {};
    const todayMeals = mealRecords[today] || [];
    
    if (todayMeals.length > 0) {
      // 收集所有饮食备注和评价
      const remarks = todayMeals
        .filter(m => m.remark)
        .map(m => m.remark);
      const ratings = todayMeals
        .filter(m => m.rating)
        .map(m => `${m.rating}/5 ${getRatingText(m.rating)}`);
      
      let syncText = "";
      if (remarks.length > 0) {
        syncText += t('mealRemarkLabel') + ': ' + remarks.join("; ");
      }
      if (ratings.length > 0) {
        syncText += (syncText ? " | " : "") + `${t('rateLabelShort')}: ${ratings.join(", ")}`;
      }
      
      if (syncText && peeRemarkInput) {
        // 如果备注框为空，自动填充；否则追加
        if (!peeRemarkInput.value.trim()) {
          peeRemarkInput.value = syncText;
          showToast(t("toastRemarkSynced"));
        }
      }
    }
  });
}

function updatePeeTodayStatus() {
  const today = getToday();
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    const todayRecord = records[today];
    if (todayRecord && todayRecord.length > 0) {
      peeTodaySection.style.display = "block";
      peeTodayCount.textContent = todayRecord.length;
      const peeAmounts = t("peeAmounts") || [];
      const peeColors = t("peeColors") || [];
      peeRecordsList.innerHTML = todayRecord.map((rec, idx) => {
        const amountText = rec.amount ? ` 💧${peeAmounts[rec.amount - 1] || ""}` : "";
        const colorDot = rec.color ? `<span class="record-color-dot" style="background:${PEE_COLOR_MAP[rec.color - 1] || '#eee'};" data-tooltip="${peeColors[rec.color - 1] || ""}"></span>` : "";
        return `
        <div class="record-item" data-index="${idx}">
          <span class="record-time pee-time">${rec.time}</span>
          <span class="record-remark">${rec.remark || t('noRemark')}${amountText}</span>
          ${colorDot}
          <div class="record-actions">
            <button class="record-action-btn edit-pee-record" data-index="${idx}" data-tooltip="${t('editTitle')}">✏️</button>
            <button class="record-action-btn delete-pee-record" data-index="${idx}" data-tooltip="${t('deleteTitle')}">🗑️</button>
          </div>
        </div>
      `;
      }).join("");

    } else {
      peeTodaySection.style.display = "none";
    }
  });
}

function updatePeeStats() {
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    let count = 0;
    let dayCount = 0;
    const allTimestamps = [];

    if (peeStatsMode === "week") {
      const range = getWeekRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        if (dayRecords.length > 0) dayCount++;
        dayRecords.forEach(rec => {
          if (rec.timestamp) allTimestamps.push(rec.timestamp);
        });
        cur.setDate(cur.getDate() + 1);
      }
      peeStatsLabel.textContent = t('weekTotal');
    } else {
      const range = getMonthRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        const dayRecords = records[dateStr] || [];
        count += dayRecords.length;
        if (dayRecords.length > 0) dayCount++;
        dayRecords.forEach(rec => {
          if (rec.timestamp) allTimestamps.push(rec.timestamp);
        });
        cur.setDate(cur.getDate() + 1);
      }
      peeStatsLabel.textContent = t('monthTotal');
    }

    peeStatsCount.textContent = count;

    const dailyAvg = dayCount > 0 ? (count / dayCount).toFixed(1) : "0";
    const dailyAvgEl = document.getElementById("peeDailyAvg");
    if (dailyAvgEl) dailyAvgEl.textContent = dailyAvg;

    let maxInterval = "--";
    let minInterval = "--";
    if (allTimestamps.length >= 2) {
      allTimestamps.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < allTimestamps.length; i++) {
        intervals.push(Math.round((allTimestamps[i] - allTimestamps[i-1]) / 60000));
      }
      maxInterval = formatInterval(Math.max(...intervals));
      minInterval = formatInterval(Math.min(...intervals));
    }
    const maxEl = document.getElementById("peeMaxInterval");
    const minEl = document.getElementById("peeMinInterval");
    if (maxEl) maxEl.textContent = maxInterval;
    if (minEl) minEl.textContent = minInterval;
  });
}

function formatInterval(minutes) {
  if (minutes < 60) return minutes + t('unitMinutes');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + t('unitHours') + (m > 0 ? m + t('unitMinutes') : "");
}

peeWeekBtn.addEventListener("click", () => {
  peeStatsMode = "week";
  peeWeekBtn.classList.add("active");
  peeMonthBtn.classList.remove("active");
  updatePeeStats();
});

peeMonthBtn.addEventListener("click", () => {
  peeStatsMode = "month";
  peeMonthBtn.classList.add("active");
  peeWeekBtn.classList.remove("active");
  updatePeeStats();
});

document.getElementById("peePrevMonth").addEventListener("click", () => {
  peeMonth--;
  if (peeMonth < 0) { peeMonth = 11; peeYear--; }
  renderPeeCalendar();
});

document.getElementById("peeNextMonth").addEventListener("click", () => {
  peeMonth++;
  if (peeMonth > 11) { peeMonth = 0; peeYear++; }
  renderPeeCalendar();
});

// ==================== 编辑弹窗事件委托 ====================
// 使用事件委托处理编辑/删除按钮点击
editModalBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  
  const action = btn.dataset.action;
  const idx = parseInt(btn.dataset.index, 10);
  
  // 饮食编辑
  if (action === "edit-eat") {
    document.getElementById("eatPreview" + idx).style.display = "none";
    document.getElementById("eatEditWrap" + idx).style.display = "block";

    // 绑定星级交互（5颗星，支持半星）
    const starContainer = document.getElementById("eatEditRatingStars" + idx);
    if (starContainer && !starContainer.dataset.bound) {
      starContainer.dataset.bound = "1";
      let editRating = parseFloat(document.getElementById("eatEditRating" + idx).value) || 0;

      // 初始化显示
      function updateEditStarsDisplay(rating) {
        starContainer.querySelectorAll(".edit-star").forEach((star, i) => {
          const starValue = i + 1;
          const fill = star.querySelector(".edit-fill");
          if (rating === 0) {
            fill.style.clipPath = "inset(0 100% 0 0)";
          } else if (starValue <= Math.floor(rating)) {
            fill.style.clipPath = "inset(0 0% 0 0)";
          } else if (starValue - 0.5 === rating) {
            fill.style.clipPath = "inset(0 50% 0 0)";
          } else {
            fill.style.clipPath = "inset(0 100% 0 0)";
          }
        });
      }
      updateEditStarsDisplay(editRating);

      starContainer.querySelectorAll(".edit-star").forEach((star, starIdx) => {
        star.addEventListener("mousemove", (e) => {
          const rect = star.getBoundingClientRect();
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          const rating = isLeftHalf ? (starIdx + 0.5) : (starIdx + 1);
          starContainer.querySelectorAll(".edit-star").forEach((s, i) => {
            const starValue = i + 1;
            const fill = s.querySelector(".edit-fill");
            if (starValue <= Math.floor(rating)) {
              fill.style.clipPath = "inset(0 0% 0 0)";
            } else if (starValue - 0.5 === rating) {
              fill.style.clipPath = "inset(0 50% 0 0)";
            } else {
              fill.style.clipPath = "inset(0 100% 0 0)";
            }
          });
        });

        star.addEventListener("click", (e) => {
          const rect = star.getBoundingClientRect();
          const isLeftHalf = e.clientX - rect.left < rect.width / 2;
          const rating = isLeftHalf ? (starIdx + 0.5) : (starIdx + 1);
          editRating = editRating === rating ? 0 : rating;
          document.getElementById("eatEditRating" + idx).value = editRating;
          updateEditStarsDisplay(editRating);
          document.getElementById("eatEditRatingText" + idx).textContent = getRatingText(editRating);
        });
      });

      // 鼠标离开时恢复已选中的状态
      starContainer.addEventListener("mouseleave", () => {
        updateEditStarsDisplay(editRating);
      });
    }

    // 绑定饱腹感交互
    const fullnessContainer = document.getElementById("eatEditFullnessBtns" + idx);
    if (fullnessContainer && !fullnessContainer.dataset.bound) {
      fullnessContainer.dataset.bound = "1";
      fullnessContainer.querySelectorAll(".edit-fullness-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const level = parseInt(btn.dataset.level);
          const currentLevel = parseInt(document.getElementById("eatEditFullness" + idx).value) || 0;
          const newLevel = currentLevel === level ? 0 : level;
          document.getElementById("eatEditFullness" + idx).value = newLevel;
          fullnessContainer.querySelectorAll(".edit-fullness-btn").forEach(b => {
            const isActive = parseInt(b.dataset.level) === newLevel;
            b.classList.toggle("active", isActive);
            b.style.background = isActive ? 'var(--eat)' : 'rgba(255,255,255,0.8)';
            b.style.color = isActive ? '#fff' : 'var(--text)';
            b.style.borderColor = isActive ? 'var(--eat)' : 'rgba(245,158,11,0.2)';
          });
        });
      });
    }

    // 绑定标签交互
    const tagsContainer = document.getElementById("eatEditTagsGrid" + idx);
    if (tagsContainer && !tagsContainer.dataset.bound) {
      tagsContainer.dataset.bound = "1";
      tagsContainer.querySelectorAll(".edit-tag-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tag = btn.dataset.tag;
          const isActive = btn.classList.contains("active");
          if (isActive) {
            btn.classList.remove("active");
            btn.style.borderColor = 'rgba(245,158,11,0.2)';
            btn.style.background = 'rgba(245,158,11,0.06)';
            btn.style.color = 'var(--text)';
          } else {
            btn.classList.add("active");
            btn.style.borderColor = 'var(--eat)';
            btn.style.background = 'rgba(245,158,11,0.15)';
            btn.style.color = 'var(--eat)';
          }
        });
      });
    }
  } else if (action === "save-eat") {
    const newType = document.getElementById("eatEditType" + idx).value;
    const newContent = document.getElementById("eatEditContent" + idx).value.trim();
    if (!newContent) { showToast(t("toastInputEmpty")); return; }
    // 获取编辑后的时间
    let newTime = null;
    const editTimeEl = document.getElementById("eatEditTime" + idx);
    if (editTimeEl && editTimeEl.value) {
      const [h, m] = editTimeEl.value.split(":");
      newTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
    }
    // 获取编辑后的备注、评价、饱腹感和标签
    const newRemark = document.getElementById("eatEditRemark" + idx) ? document.getElementById("eatEditRemark" + idx).value.trim() : "";
    const newRating = document.getElementById("eatEditRating" + idx) ? parseFloat(document.getElementById("eatEditRating" + idx).value) || 0 : 0;
    const newFullness = document.getElementById("eatEditFullness" + idx) ? parseInt(document.getElementById("eatEditFullness" + idx).value) || undefined : undefined;
    const tagsGrid = document.getElementById("eatEditTagsGrid" + idx);
    const newTags = tagsGrid ? Array.from(tagsGrid.querySelectorAll(".edit-tag-btn.active")).map(b => b.dataset.tag) : undefined;

    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      if (records[currentEditDate] && records[currentEditDate][idx]) {
        records[currentEditDate][idx].type = newType;
        records[currentEditDate][idx].content = newContent;
        records[currentEditDate][idx].remark = newRemark;
        records[currentEditDate][idx].rating = newRating;
        records[currentEditDate][idx].fullness = newFullness;
        records[currentEditDate][idx].tags = newTags && newTags.length > 0 ? newTags : undefined;
        if (newTime) records[currentEditDate][idx].time = newTime;
        persistRecords('mealRecords', records, () => {
          showToast(t("toastEditSuccess"));
          renderEatCalendar();
          updateMealRecords();
          chrome.storage.local.get(["mealRecords"], (d) => {
            if (d.mealRecords && d.mealRecords[currentEditDate]) {
              showEatEditModal(currentEditDate, d.mealRecords[currentEditDate]);
            }
          });
        });
      }
    });
  } else if (action === "delete-eat") {
    deleteEatRecord(idx);
  }
  
  // 排便编辑
  else if (action === "edit-poop") {
    document.getElementById("poopEditFormTime" + idx).style.display = "flex";
    document.getElementById("poopEditForm" + idx).style.display = "block";
    document.getElementById("poopContent" + idx).style.display = "none";
  } else if (action === "save-poop") {
    const newRemark = document.getElementById("poopEditContent" + idx).value.trim();
    // 获取编辑后的时间
    let newTime = null;
    const editTimeEl = document.getElementById("poopEditTime" + idx);
    if (editTimeEl && editTimeEl.value) {
      const [h, m] = editTimeEl.value.split(":");
      newTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
    }
    chrome.storage.local.get(["poopRecords"], (data) => {
      const records = data.poopRecords || {};
      if (records[currentEditDate] && records[currentEditDate][idx]) {
        if (newTime) records[currentEditDate][idx].time = newTime;
        records[currentEditDate][idx].remark = newRemark;
        persistRecords('poopRecords', records, () => {
          showToast(t("toastEditSuccess"));
          renderPoopCalendar();
          updatePoopTodayStatus();
          updatePoopStats();
          chrome.storage.local.get(["poopRecords"], (d) => {
            if (d.poopRecords && d.poopRecords[currentEditDate]) {
              showPoopEditModal(currentEditDate, d.poopRecords[currentEditDate]);
            }
          });
        });
      }
    });
  } else if (action === "delete-poop") {
    deletePoopRecord(idx);
  }
  
  // 排尿编辑
  else if (action === "edit-pee") {
    document.getElementById("peeEditFormTime" + idx).style.display = "flex";
    document.getElementById("peeEditForm" + idx).style.display = "block";
    document.getElementById("peeContent" + idx).style.display = "none";
  } else if (action === "save-pee") {
    const newRemark = document.getElementById("peeEditContent" + idx).value.trim();
    // 获取编辑后的时间
    let newTime = null;
    const editTimeEl = document.getElementById("peeEditTime" + idx);
    if (editTimeEl && editTimeEl.value) {
      const [h, m] = editTimeEl.value.split(":");
      newTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
    }
    chrome.storage.local.get(["peeRecords"], (data) => {
      const records = data.peeRecords || {};
      if (records[currentEditDate] && records[currentEditDate][idx]) {
        if (newTime) records[currentEditDate][idx].time = newTime;
        records[currentEditDate][idx].remark = newRemark;
        persistRecords('peeRecords', records, () => {
          showToast(t("toastEditSuccess"));
          renderPeeCalendar();
          updatePeeTodayStatus();
          updatePeeStats();
          chrome.storage.local.get(["peeRecords"], (d) => {
            if (d.peeRecords && d.peeRecords[currentEditDate]) {
              showPeeEditModal(currentEditDate, d.peeRecords[currentEditDate]);
            }
          });
        });
      }
    });
  } else if (action === "delete-pee") {
    deletePeeRecord(idx);
  }
});

// ==================== 监听来自后台脚本的消息 ====================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DRINK_RECORDED") {
    updateDrinkStats();
  }
});

// 兜底：监听 storage 变化，确保数据同步（sendMessage 可能因 popup 未打开而失败）
chrome.storage.onChanged.addListener((changes) => {
  if (changes.drinkRecords) {
    updateDrinkStats();
  }
});

// ==================== 主题系统 ====================
// 新增主题只需在此追加一项 + 在 i18n.js 补翻译，下拉框会自动渲染。

// 角标色从 THEME_PRESETS 自动派生（消除双表维护，新增主题自动同步）
const THEME_BADGE_COLOR = Object.fromEntries(
  Object.entries(THEME_PRESETS).map(([k, p]) => [k, p.vars && p.vars["--primary"] || '#0b6bff'])
);

const root = document.documentElement;
const bodyEl = document.body;
let currentThemeId = "default";

// 动态渲染主题下拉选项（新增主题无需改 HTML）
function renderThemeOptions() {
  const menu = document.getElementById("themeMenu");
  if (!menu) return;
  menu.innerHTML = "";
  Object.entries(THEME_PRESETS).forEach(([id, p]) => {
    const item = document.createElement("div");
    item.className = "theme-item" + (id === currentThemeId ? " active" : "");
    item.dataset.theme = id;
    item.innerHTML = `<span class="theme-dot" style="background:${p.dot}"></span><span class="theme-label"></span>`;
    item.querySelector(".theme-label").textContent = t(p.name);
    item.addEventListener("click", () => selectTheme(id));
    menu.appendChild(item);
  });
}

// 选择并应用主题
function selectTheme(themeId) {
  applyTheme(themeId);
  closeThemeDropdown();
  chrome.storage.local.set({ selectedTheme: themeId }, () => {
    showToast(t("toastThemeSwitched", { theme: t(THEME_PRESETS[themeId].name) }));
  });
}

// 关闭下拉菜单
function closeThemeDropdown() {
  const el = document.getElementById("themeDropdown");
  if (el) el.classList.remove("open");
}

function applyTheme(themeId) {
  const preset = THEME_PRESETS[themeId];
  if (!preset) return;
  currentThemeId = themeId;

  // 设置 data-theme 属性（用于 CSS 选择器）
  document.body.setAttribute("data-theme", themeId);

  // 应用 CSS 变量
  Object.entries(preset.vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  // 背景渐变
  bodyEl.style.background = preset.bgGradient;

  // 更新触发按钮色块 + 当前主题名 + 下拉项选中态
  const sw = document.getElementById("themeSwatch");
  if (sw) sw.style.background = preset.dot;
  const cur = document.getElementById("themeCurrent");
  if (cur) cur.textContent = t(preset.name);
  document.querySelectorAll(".theme-item").forEach(it => {
    it.classList.toggle("active", it.dataset.theme === themeId);
  });
}

function loadTheme() {
  chrome.storage.local.get(["selectedTheme"], (data) => {
    const themeId = data.selectedTheme || "default";
    renderThemeOptions();
    applyTheme(themeId);
  });
}

loadTheme();

// ==================== 自定义滚动条（替代原生，随主题变色） ====================
function initCustomScrollbar() {
  const bar = document.getElementById("customScrollbar");
  const thumb = bar ? bar.querySelector(".custom-scrollbar-thumb") : null;
  if (!bar || !thumb) return;

  // 调试开关：定位根因后改为 false 删除日志
  const DEBUG = false;
  const dlog = (...a) => { if (DEBUG) console.log("[scrollbar]", ...a); };

  let active = null; // { el, type: "viewport" | "bounded" }

  // 判定当前活动滚动容器
  // 有界容器（sidebar / 弹窗）优先；否则主 popup 视为"视口型"（浏览器 frame 滚动）
  function getActiveContainer() {
    const tagModal = document.getElementById("tagModal");
    if (tagModal && tagModal.classList.contains("active")) {
      const body = tagModal.querySelector(".tag-modal-body");
      if (body && body.scrollHeight > body.clientHeight) return { el: body, type: "bounded" };
    }
    const badgeModal = document.getElementById("badgeModalOverlay");
    if (badgeModal && !badgeModal.classList.contains("hidden")) {
      const body = badgeModal.querySelector(".badge-modal");
      if (body && body.scrollHeight > body.clientHeight) return { el: body, type: "bounded" };
    }
    const sidebar = document.getElementById("sidebarPanel");
    if (sidebar && sidebar.classList.contains("open")) {
      if (sidebar.scrollHeight > sidebar.clientHeight) return { el: sidebar, type: "bounded" };
    }
    // 主 popup：Chrome 扩展弹窗无 body 固定高度时，实际由浏览器 frame 滚动
    // 用视口型指标（window.innerHeight / documentElement.scrollHeight / window.scrollY）
    return { el: document.documentElement, type: "viewport" };
  }

  // 取不同容器类型的滚动指标
  function getMetrics(a) {
    if (a.type === "viewport") {
      return {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: window.innerHeight,
        scrollTop: window.scrollY || window.pageYOffset || 0,
      };
    }
    return {
      scrollHeight: a.el.scrollHeight,
      clientHeight: a.el.clientHeight,
      scrollTop: a.el.scrollTop,
    };
  }

  // 滚动到指定位置（区分视口型与有界型）
  function setScroll(a, y) {
    if (a.type === "viewport") {
      window.scrollTo(0, y);
    } else {
      a.el.scrollTop = y;
    }
  }

  function update() {
    active = getActiveContainer();
    const m = getMetrics(active);
    const maxScroll = m.scrollHeight - m.clientHeight;
    const scrollable = maxScroll > 1;
    dlog("update:", active.type, "scrollHeight=", m.scrollHeight, "clientHeight=", m.clientHeight, "scrollTop=", m.scrollTop, "scrollable=", scrollable);
    if (!scrollable) {
      bar.classList.remove("visible");
      thumb.style.height = "0px";
      return;
    }
    bar.classList.add("visible");

    let trackH, rect;
    if (active.type === "viewport") {
      // 视口型：轨道固定贴视口右侧
      trackH = window.innerHeight;
      bar.style.top = "0px";
      bar.style.height = trackH + "px";
      bar.style.right = "0px";
    } else {
      // 有界型：轨道跟随元素
      rect = active.el.getBoundingClientRect();
      trackH = rect.height;
      const rightGap = window.innerWidth - rect.right;
      bar.style.top = rect.top + "px";
      bar.style.height = trackH + "px";
      bar.style.right = Math.max(0, rightGap) + "px";
    }

    const ratio = m.clientHeight / m.scrollHeight;
    // thumb 高度保持在视口 45%~60% 之间，视觉上约弹窗 1/2，不会太短也不会太长
    const minThumbH = Math.round(trackH * 0.45);
    const maxThumbH = Math.round(trackH * 0.6);
    const thumbH = Math.max(minThumbH, Math.min(maxThumbH, Math.floor(trackH * ratio)));
    const scrollRatio = maxScroll > 0 ? m.scrollTop / maxScroll : 0;
    const maxThumbTop = trackH - thumbH;
    thumb.style.height = thumbH + "px";
    thumb.style.transform = "translateY(" + (scrollRatio * maxThumbTop) + "px)";
  }

  // 全局捕获滚动（容器会动态切换；capture 兼容内部容器，window 兼容主 popup frame 滚动）
  document.addEventListener("scroll", update, true);
  window.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  // 初始渲染可能未完成，延迟刷新几次
  setTimeout(update, 200);
  setTimeout(update, 500);
  setTimeout(update, 1000);

  // 拖拽 thumb 滚动
  let dragging = false, startY = 0, startScrollTop = 0;
  thumb.addEventListener("mousedown", (e) => {
    dragging = true;
    startY = e.clientY;
    startScrollTop = getMetrics(active).scrollTop;
    bar.classList.add("dragging");
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging || !active) return;
    const trackH = bar.clientHeight;
    const thumbH = thumb.offsetHeight;
    const maxThumbTop = trackH - thumbH;
    const maxScroll = getMetrics(active).scrollHeight - getMetrics(active).clientHeight;
    if (maxThumbTop <= 0) return;
    const deltaRatio = (e.clientY - startY) / maxThumbTop;
    setScroll(active, startScrollTop + deltaRatio * maxScroll);
  });
  document.addEventListener("mouseup", () => {
    dragging = false;
    bar.classList.remove("dragging");
  });

  // 点击轨道跳转
  bar.addEventListener("click", (e) => {
    if (e.target === thumb || !active) return;
    const rect = bar.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const thumbH = thumb.offsetHeight;
    const maxThumbTop = bar.clientHeight - thumbH;
    const m = getMetrics(active);
    const maxScroll = m.scrollHeight - m.clientHeight;
    if (maxThumbTop <= 0) return;
    const ratio = (clickY - thumbH / 2) / maxThumbTop;
    setScroll(active, ratio * maxScroll);
  });

  // 内容高度变化时刷新（ResizeObserver 比 MutationObserver 更可靠）
  let debounceTimer = null;
  const scheduleUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(update, 120);
  };
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(document.body);
    const sidebar = document.getElementById("sidebarPanel");
    const tagModal = document.getElementById("tagModal");
    if (sidebar) ro.observe(sidebar);
    if (tagModal) ro.observe(tagModal);
  } else {
    const mo = new MutationObserver(scheduleUpdate);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // 侧边栏/弹窗打开动画结束后再刷新一次
  const sidebar = document.getElementById("sidebarPanel");
  const tagModal = document.getElementById("tagModal");
  if (sidebar) sidebar.addEventListener("transitionend", update);
  if (tagModal) tagModal.addEventListener("transitionend", update);

  // 暴露给主题切换等外部调用
  window.updateCustomScrollbar = update;

  update();
}

initCustomScrollbar();

// 绑定主题切换事件（自定义下拉框）
const themeDropdownEl = document.getElementById("themeDropdown");
const themeTriggerEl = document.getElementById("themeTrigger");
if (themeTriggerEl && themeDropdownEl) {
  themeTriggerEl.addEventListener("click", (e) => {
    e.stopPropagation();
    themeDropdownEl.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!themeDropdownEl.contains(e.target)) {
      themeDropdownEl.classList.remove("open");
    }
  });
}



// ==================== 默认首页设置 ====================
function applyDefaultTab(tabId) {
  // 更新按钮选中态
  document.querySelectorAll(".default-tab-opt").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
}

function loadDefaultTab(callback) {
  chrome.storage.local.get(["defaultTab"], (data) => {
    const tabId = data.defaultTab || "drink";
    applyDefaultTab(tabId);
    if (callback) callback(tabId);
  });
}

// 绑定默认首页切换事件
document.querySelectorAll(".default-tab-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    applyDefaultTab(tabId);
    chrome.storage.local.set({ defaultTab: tabId }, () => {
      const tabNames = { eat: t("tabNameEat"), drink: t("tabNameDrink"), poop: t("tabNamePoop"), pee: t("tabNamePee"), period: t("tabNamePeriod") };
      showToast(t("toastDefaultPage", { page: tabNames[tabId] }));
    });
  });
});

// 页面加载时恢复默认首页选中态
loadDefaultTab();

// ==================== 功能开关侧边栏 ====================
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarPanel = document.getElementById("sidebarPanel");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");

function openSidebar() {
  sidebarPanel.classList.add("open");
  sidebarOverlay.classList.add("show");
}
function closeSidebar() {
  sidebarPanel.classList.remove("open");
  sidebarOverlay.classList.remove("show");
}

sidebarToggleBtn.addEventListener("click", openSidebar);
sidebarCloseBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// 功能模块映射
const moduleMap = {
  eat:   { page: "pageEat", nav: "navEat", switch: "sbEat" },
  drink: { page: "pageDrink", nav: "navDrink", switch: "sbDrink" },
  poop:  { page: "pagePoop", nav: "navPoop", switch: "sbPoop" },
  pee:   { page: "pagePee", nav: "navPee", switch: "sbPee" }
};

function applyModuleVisibility() {
  Object.keys(moduleMap).forEach(key => {
    const m = moduleMap[key];
    const isOn = document.getElementById(m.switch).checked;
    const pageEl = document.getElementById(m.page);
    const navEl = document.getElementById(m.nav);
    
    if (pageEl) pageEl.classList.toggle("hidden-module", !isOn);
    if (navEl) navEl.classList.toggle("hidden-module", !isOn);
  });
  
  // 如果当前 tab 被隐藏了，切换到第一个可见的 tab
  if (moduleMap[currentTab] && document.getElementById(moduleMap[currentTab].page)?.classList.contains("hidden-module")) {
    const visibleTab = Object.keys(moduleMap).find(k => 
      document.getElementById(moduleMap[k].switch).checked
    );
    if (visibleTab) switchTab(visibleTab);
  }
}

// 加载保存的状态
function loadModuleStates() {
  chrome.storage.local.get(["moduleStates"], (data) => {
    const states = data.moduleStates || { eat: true, drink: true, poop: true, pee: true };
    ["eat","drink","poop","pee"].forEach(key => {
      document.getElementById(moduleMap[key].switch).checked = !!states[key];
    });
    applyModuleVisibility();
  });
}

// 监听开关变化
["eat","drink","poop","pee"].forEach(key => {
  document.getElementById(moduleMap[key].switch).addEventListener("change", () => {
    const states = {};
    ["eat","drink","poop","pee"].forEach(k => { 
      states[k] = document.getElementById(moduleMap[k].switch).checked; 
    });
    chrome.storage.local.set({ moduleStates: states }, () => {
      applyModuleVisibility();
      const _modNames = { eat: t("eatModule"), drink: t("drinkModule"), poop: t("poopModule"), pee: t("peeModule") }; showToast(document.getElementById(moduleMap[key].switch).checked ? t("moduleShown", { name: _modNames[key] }) : t("moduleHidden", { name: _modNames[key] }));
    });
  });
});

// ==================== 初始化 ====================
document.getElementById("navEat").addEventListener("click", () => switchTab("eat"));
document.getElementById("navDrink").addEventListener("click", () => switchTab("drink"));
document.getElementById("navPoop").addEventListener("click", () => switchTab("poop"));
document.getElementById("navPee").addEventListener("click", () => switchTab("pee"));
document.getElementById("navPeriod").addEventListener("click", () => switchTab("period"));

// 事件委托：今日记录列表（只绑定一次，避免每次渲染都绑定）
(function () {
  // 排便记录列表
  const poopList = document.getElementById("poopRecordsList");
  if (poopList) {
    poopList.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-poop-record");
      if (editBtn) {
        e.stopPropagation();
        const today = getToday();
        chrome.storage.local.get(["poopRecords"], (data) => {
          const records = data.poopRecords || {};
          showPoopEditModal(today, records[today] || []);
        });
        return;
      }
      const delBtn = e.target.closest(".delete-poop-record");
      if (delBtn) {
        e.stopPropagation();
        deletePoopRecord(parseInt(delBtn.dataset.index), getToday());
      }
    });
  }

  // 排尿记录列表
  const peeList = document.getElementById("peeRecordsList");
  if (peeList) {
    peeList.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-pee-record");
      if (editBtn) {
        e.stopPropagation();
        const today = getToday();
        chrome.storage.local.get(["peeRecords"], (data) => {
          const records = data.peeRecords || {};
          showPeeEditModal(today, records[today] || []);
        });
        return;
      }
      const delBtn = e.target.closest(".delete-pee-record");
      if (delBtn) {
        e.stopPropagation();
        deletePeeRecord(parseInt(delBtn.dataset.index), getToday());
      }
    });
  }

  // 饮食记录列表
  const mealList = document.getElementById("mealRecordsList");
  if (mealList) {
    mealList.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-meal");
      if (editBtn) {
        e.stopPropagation();
        const today = getToday();
        chrome.storage.local.get(["mealRecords"], (data) => {
          const records = data.mealRecords || {};
          showEatEditModal(today, records[today] || []);
        });
        return;
      }
      const delBtn = e.target.closest(".delete-meal");
      if (delBtn) {
        e.stopPropagation();
        deleteEatRecord(parseInt(delBtn.dataset.index), getToday());
      }
    });
  }
})();

// 从存储读取默认首页，若无则默认喝水
chrome.storage.local.get(["defaultTab"], (data) => {
  const defaultTab = data.defaultTab || "drink";
  restoreAllBackups(() => switchTab(defaultTab));
});

initDrinkTimer();
updateDrinkStats();
updateBadge();
loadModuleStates();

// 自定义标签弹窗事件
document.getElementById("tagModalClose")?.addEventListener("click", closeTagModal);
document.getElementById("tagModalCancel")?.addEventListener("click", closeTagModal);
document.getElementById("tagModalConfirm")?.addEventListener("click", confirmAddCustomTag);
document.getElementById("tagModal")?.addEventListener("click", (e) => {
  if (!e.target.closest('[data-modal-inner="1"]')) {
    closeTagModal();
  }
});

// 饮食默认时间设置弹窗事件
document.getElementById("mealDefaultTimeModalClose")?.addEventListener("click", closeMealDefaultSettingsModal);
document.getElementById("mealDefaultTimeModalCancel")?.addEventListener("click", closeMealDefaultSettingsModal);
document.getElementById("mealDefaultTimeModalConfirm")?.addEventListener("click", saveMealDefaultSettings);
document.getElementById("mealDefaultTimeModal")?.addEventListener("click", (e) => {
  // 点击遮罩背景（非内容区）时关闭
  if (!e.target.closest('[data-modal-inner="1"]')) {
    closeMealDefaultSettingsModal();
  }
});

// 语言切换按钮事件
document.querySelectorAll(".lang-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    const lang = btn.dataset.lang;
    setLanguage(lang);
    document.querySelectorAll(".lang-opt").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    // 刷新主题下拉选项文案（随语言切换）
    renderThemeOptions();
    applyTheme(currentThemeId);
    showToast(t("toastDefaultLang", { lang: lang === "zh" ? t("langZh") : t("langEn") }));
    // 强制刷新当前 tab 的动态内容
    switchTab(currentTab, true);
  });
});

// 页面加载时恢复语言
loadLanguage(() => {
  // 设置语言按钮选中状态
  document.querySelectorAll(".lang-opt").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
  applyI18n();
  // 重新应用动态状态文本，避免被 applyI18n 覆盖
  applyRunningUI(isRunning);
  applyNotifUI(notifToggle.checked);
  // 角标开关初始化
  var sbBadge = document.getElementById("sbBadge");
  if (sbBadge) {
    chrome.storage.local.get(["badgeEnabled"], function(data) {
      sbBadge.checked = (data.badgeEnabled !== false);
      updateBadge();
    });
    sbBadge.addEventListener("change", function() {
      chrome.storage.local.set({ badgeEnabled: sbBadge.checked }, function() {
        updateBadge();
      });
    });
  }
  // === 角标内容选择器 ===
  var badgeContentType = "drink_today";
  function getBadgeI18nKey(val) {
    return "badgeOpt" + val.split("_").map(function(s){ return s.charAt(0).toUpperCase() + s.slice(1); }).join("");
  }
  function updateBadgeContentLabel() {
    var el = document.getElementById("badgeContentLabel");
    if (el) el.textContent = t(getBadgeI18nKey(badgeContentType));
  }
  chrome.storage.local.get(["badgeContentType"], function(data) {
    badgeContentType = data.badgeContentType || "drink_today";
    updateBadgeContentLabel();
  });
  var badgeContentBtn = document.getElementById("badgeContentBtn");
  var badgeModalOverlay = document.getElementById("badgeModalOverlay");
  var badgeModalClose = document.getElementById("badgeModalClose");
  if (badgeContentBtn && badgeModalOverlay) {
    badgeContentBtn.addEventListener("click", function() {
      badgeModalOverlay.classList.remove("hidden");
      badgeModalOverlay.querySelectorAll(".badge-modal-option").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.value === badgeContentType);
      });
    });
  }
  if (badgeModalClose && badgeModalOverlay) {
    badgeModalClose.addEventListener("click", function() {
      badgeModalOverlay.classList.add("hidden");
    });
    badgeModalOverlay.addEventListener("click", function(e) {
      if (e.target === badgeModalOverlay) badgeModalOverlay.classList.add("hidden");
    });
  }
  document.querySelectorAll(".badge-modal-option").forEach(function(btn) {
    btn.addEventListener("click", function() {
      badgeContentType = this.dataset.value;
      chrome.storage.local.set({ badgeContentType: badgeContentType }, function() {
        updateBadgeContentLabel();
        badgeModalOverlay.classList.add("hidden");
        updateBadge();
      });
    });
  });
});

// ==================== 自定义提醒 ====================
// 防御：保存 t 引用，防止运行时回调参数覆盖全局 t
const _t = (typeof t === 'function') ? t : (key) => key;
const REMINDER_ICONS = ["⏰","💊","💧","🏃","🍽️","🏋️","📿","🧘","🚶","📋","🔔","🎒","🧪","✏️","🏥"];

let customReminders = [];
let editingReminderId = null;
let reminderSelectedIcon = "⏰";

function loadReminders(cb) {
  chrome.storage.local.get(["customReminders"], (data) => {
    customReminders = data.customReminders || [];
    if (cb) cb();
  });
}

function saveReminders() {
  chrome.storage.local.set({ customReminders });
  chrome.runtime.sendMessage({ type: "REFRESH_REMINDERS" }).catch(() => {});
}

function renderReminderList() {
  const list = document.getElementById("reminderList");
  if (!list) return;
  if (customReminders.length === 0) {
    list.innerHTML = `<div class="reminder-empty" data-i18n="noReminders">${_t("noReminders")}</div>`;
    applyI18n();
    return;
  }
  list.innerHTML = customReminders.map(r => `
    <div class="reminder-item" data-id="${r.id}">
      <div class="reminder-item-left">
        <span class="reminder-item-icon">${r.icon || "⏰"}</span>
        <div>
          <div class="reminder-item-label">${r.label}</div>
          <div class="reminder-item-times">${(r.times || []).map(time => _t("remindAt") + " " + time).join("，")}</div>
        </div>
      </div>
      <div class="reminder-item-actions">
        <button class="reminder-item-btn edit-reminder" data-id="${r.id}" data-tooltip="${_t("editReminder")}">✏️</button>
        <button class="reminder-item-btn delete-reminder" data-id="${r.id}" data-tooltip="${_t("delete")}">🗑️</button>
      </div>
    </div>
  `).join("");
  applyI18n();
}

function openReminderModal(reminder) {
  editingReminderId = reminder ? reminder.id : null;
  const modal = document.getElementById("reminderModal");
  const title = document.getElementById("reminderModalTitle");
  title.textContent = reminder ? t("editReminder") : t("addReminder");
  document.getElementById("reminderLabelInput").value = reminder ? reminder.label : "";
  reminderSelectedIcon = reminder ? (reminder.icon || "⏰") : "⏰";
  document.getElementById("reminderEnabledInput").checked = reminder ? (!!reminder.enabled) : true;

  const iconGrid = document.getElementById("reminderIconGrid");
  iconGrid.innerHTML = REMINDER_ICONS.map(ic =>
    `<button class="reminder-icon-btn ${ic === reminderSelectedIcon ? 'active' : ''}" data-icon="${ic}">${ic}</button>`
  ).join('');
  iconGrid.querySelectorAll(".reminder-icon-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      reminderSelectedIcon = btn.dataset.icon;
      iconGrid.querySelectorAll(".reminder-icon-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  renderReminderTimes(reminder ? (reminder.times || []) : ["08:00"]);
  modal.classList.add("show");
}

function renderReminderTimes(times) {
  const list = document.getElementById("reminderTimesList");
  list.innerHTML = times.map((t, i) => `
    <div class="reminder-time-row">
      <input type="time" class="reminder-time-input" value="${t}" data-idx="${i}" />
      <button class="reminder-time-remove" data-idx="${i}">×</button>
    </div>
  `).join('');
  list.querySelectorAll(".reminder-time-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      times.splice(parseInt(btn.dataset.idx), 1);
      renderReminderTimes(times);
    });
  });
}

function closeReminderModal() {
  document.getElementById("reminderModal").classList.remove("show");
  editingReminderId = null;
}

function saveReminder() {
  const label = document.getElementById("reminderLabelInput").value.trim();
  if (!label) { showToast(t("reminderLabelRequired") || "请输入提醒名称"); return; }
  const enabled = document.getElementById("reminderEnabledInput").checked;
  const times = [];
  document.querySelectorAll(".reminder-time-input").forEach(inp => {
    if (inp.value) times.push(inp.value);
  });
  if (times.length === 0) { showToast(t("reminderTimeRequired") || "请至少添加一个时间"); return; }

  if (editingReminderId) {
    const idx = customReminders.findIndex(r => r.id === editingReminderId);
    if (idx >= 0) {
      customReminders[idx].label = label;
      customReminders[idx].icon = reminderSelectedIcon;
      customReminders[idx].times = times;
      customReminders[idx].enabled = enabled;
    }
    showToast(t("reminderUpdated"));
  } else {
    customReminders.push({
      id: "rem_" + Date.now(),
      label,
      icon: reminderSelectedIcon,
      times,
      enabled,
      lastTriggered: {}
    });
    showToast(t("reminderAdded"));
  }

  saveReminders();
  renderReminderList();
  closeReminderModal();
}

document.getElementById("addReminderBtn")?.addEventListener("click", () => openReminderModal(null));
document.getElementById("reminderModalClose")?.addEventListener("click", closeReminderModal);
document.getElementById("reminderModalCancel")?.addEventListener("click", closeReminderModal);
document.getElementById("reminderModalConfirm")?.addEventListener("click", saveReminder);
document.getElementById("reminderAddTimeBtn")?.addEventListener("click", () => {
  const list = document.getElementById("reminderTimesList");
  const currentTimes = [];
  list.querySelectorAll(".reminder-time-input").forEach(inp => currentTimes.push(inp.value || "08:00"));
  currentTimes.push("08:00");
  renderReminderTimes(currentTimes);
});

document.getElementById("reminderList")?.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".edit-reminder");
  if (editBtn) {
    const r = customReminders.find(r => r.id === editBtn.dataset.id);
    if (r) openReminderModal(r);
    return;
  }
  const delBtn = e.target.closest(".delete-reminder");
  if (delBtn) {
    showConfirm(t("confirmDeleteReminder"), () => {
      customReminders = customReminders.filter(r => r.id !== delBtn.dataset.id);
      saveReminders();
      renderReminderList();
      showToast(t("reminderDeleted"));
    });
  }
});

loadReminders(() => renderReminderList());

// ==================== 捐赠支持 ====================
const donateBtn = document.getElementById("donateBtn");
const donateQrOverlay = document.getElementById("donateQrOverlay");
const donateQrClose = document.getElementById("donateQrClose");

if (donateBtn) {
  donateBtn.addEventListener("click", () => {
    if (donateQrOverlay) {
      donateQrOverlay.classList.add("show");
    }
  });
}

if (donateQrClose) {
  donateQrClose.addEventListener("click", () => {
    if (donateQrOverlay) {
      donateQrOverlay.classList.remove("show");
    }
  });
}

if (donateQrOverlay) {
  donateQrOverlay.addEventListener("click", (e) => {
    if (e.target === donateQrOverlay) {
      donateQrOverlay.classList.remove("show");
    }
  });
}

// 捐赠弹窗 tab 切换
document.querySelectorAll(".donate-qr-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".donate-qr-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".donate-qr-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const panel = document.getElementById("donatePanel" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
    if (panel) panel.classList.add("active");
  });
});

// ==================== 经期记录功能（开关式） ====================
let periodCalendarYear = new Date().getFullYear();
let periodCalendarMonth = new Date().getMonth();
let periodCycles = []; // { startDate, endDate, days }
let selectedMood = 0;
let selectedPain = 0;
let selectedSymptoms = [];
let selectedFlow = 0;

// 迁移旧数据（periodRecords → periodCycles）
function migratePeriodData(records, callback) {
  const dates = Object.keys(records)
    .filter(d => records[d] && records[d].flow > 0)
    .sort();
  if (dates.length === 0) return callback([]);
  const cycles = [];
  let curStart = dates[0], curEnd = dates[0];
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(curEnd + "T00:00:00");
    const curr = new Date(dates[i] + "T00:00:00");
    const gap = Math.round((curr - prev) / 86400000);
    if (gap <= 2) {
      curEnd = dates[i];
    } else {
      cycles.push({ startDate: curStart, endDate: curEnd });
      curStart = dates[i];
      curEnd = dates[i];
    }
  }
  cycles.push({ startDate: curStart, endDate: curEnd });
  callback(cycles);
}

// 加载经期周期数据
function loadPeriodCycles(callback) {
  chrome.storage.local.get(["periodCycles", "periodRecords"], (data) => {
    if (data.periodCycles) {
      periodCycles = data.periodCycles;
      // 兼容旧数据：将 mood/symptoms/remark 迁移到 days 中
      periodCycles.forEach(c => {
        if (c.mood !== undefined || c.symptoms !== undefined || c.remark !== undefined) {
          if (!c.days) c.days = {};
          if (c.startDate && !c.days[c.startDate]) {
            c.days[c.startDate] = {
              mood: c.mood !== undefined ? c.mood : undefined,
              symptoms: c.symptoms || [],
              remark: c.remark || ""
            };
          }
          // 清除旧字段
          delete c.mood;
          delete c.symptoms;
          delete c.remark;
        }
        if (!c.days) c.days = {};
      });
      // 保存迁移后的数据
      persistRecords('periodCycles', periodCycles);
      if (callback) callback();
    } else if (data.periodRecords) {
      migratePeriodData(data.periodRecords, (cycles) => {
        periodCycles = cycles;
        // 同样做旧数据迁移
        periodCycles.forEach(c => {
          if (!c.days) c.days = {};
        });
        persistRecords('periodCycles', periodCycles, () => {
          chrome.storage.local.remove(["periodRecords"]);
          if (callback) callback();
        });
      });
    } else {
      periodCycles = [];
      if (callback) callback();
    }
  });
}

// 保存经期周期数据
function savePeriodCycles() {
  persistRecords('periodCycles', periodCycles, () => {
    renderPeriodCalendar();
    updatePeriodStats();
    renderPeriodBarChart();
    renderPeriodCycleTable();
  });
}

// 获取进行中的经期
function getActivePeriod() {
  return periodCycles.find(c => c.endDate === null);
}

// 格式化日期为 YYYY-MM-DD
function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 获取日期范围内的所有日期字符串
function getDatesInRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(getToday());
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(formatDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// 当前选中的经期日期（用于按天记录心情/症状）
let selectedPeriodDate = null;

// 未保存标记
let periodUnsaved = false;
function markPeriodUnsaved() {
  periodUnsaved = true;
  const btn = document.getElementById("periodSaveMoodBtn");
  if (btn) btn.classList.add("unsaved");
}
function clearPeriodUnsaved() {
  periodUnsaved = false;
  const btn = document.getElementById("periodSaveMoodBtn");
  if (btn) btn.classList.remove("unsaved");
}

// 渲染经期日历
function renderPeriodCalendar() {
  const calendarDays = document.getElementById("periodCalendarDays");
  if (!calendarDays) return;
  calendarDays.innerHTML = "";

  const firstDay = new Date(periodCalendarYear, periodCalendarMonth, 1);
  const lastDay = new Date(periodCalendarYear, periodCalendarMonth + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = getToday();

  // 预测下次经期：基于历史周期长度均值推算
  let predictedStart = null, predictedEnd = null;
  if (periodCycles.length >= 2 && !getActivePeriod()) {
    const sorted = [...periodCycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].startDate + "T00:00:00");
      const curr = new Date(sorted[i].startDate + "T00:00:00");
      const len = Math.round((curr - prev) / 86400000);
      if (len > 20 && len < 45) gaps.push(len);
    }
    if (gaps.length > 0) {
      const avgCycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      const completed = periodCycles.filter(c => c.endDate);
      let avgDur = 5;
      if (completed.length) {
        const durs = completed.map(c =>
          Math.round((new Date(c.endDate + "T00:00:00") - new Date(c.startDate + "T00:00:00")) / 86400000) + 1
        );
        avgDur = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
      }
      const lastStart = sorted[sorted.length - 1].startDate;
      const ps = new Date(lastStart + "T00:00:00");
      ps.setDate(ps.getDate() + avgCycle);
      const pe = new Date(ps);
      pe.setDate(pe.getDate() + avgDur - 1);
      predictedStart = formatDateStr(ps);
      predictedEnd = formatDateStr(pe);
    }
  }

  // 前置空白填充
  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell empty";
    emptyCell.style.width = "36px";
    emptyCell.style.height = "36px";
    calendarDays.appendChild(emptyCell);
  }

  // 添加本月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${periodCalendarYear}-${String(periodCalendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const day = document.createElement("div");
    day.className = "day-cell";
    day.textContent = d;
    day.dataset.date = dateStr;

    if (dateStr === today) {
      day.classList.add("today");
    }

    // 检查是否属于某个经期周期并着色
    let inCycle = false;
    for (let i = 0; i < periodCycles.length; i++) {
      const cycle = periodCycles[i];
      const range = getDatesInRange(cycle.startDate, cycle.endDate);
      if (range.includes(dateStr)) {
        const idx = range.indexOf(dateStr);
        const intensity = Math.min(4, Math.ceil((idx + 1) / 2));
        day.classList.add(`period-day-${intensity}`);
        inCycle = true;

        // 显示该天的心情 emoji
        const dayData = (cycle.days || {})[dateStr];
        if (dayData && dayData.mood !== undefined && dayData.mood >= 0) {
          const moodEmojis = t("periodMoodEmojis") || [];
          const moodEmoji = moodEmojis[dayData.mood] || "";
          if (moodEmoji) {
            const moodEl = document.createElement("span");
            moodEl.className = "day-mood";
            moodEl.textContent = moodEmoji;
            day.appendChild(moodEl);
          }
        }
        break;
      }
    }

    // 预测经期高亮（非实际经期、且在预测区间内）
    if (!inCycle && predictedStart && predictedEnd && dateStr >= predictedStart && dateStr <= predictedEnd) {
      day.classList.add("period-predicted");
    }

    // 经期日期：悬浮显示 tooltip，点击进入编辑
    if (inCycle) {
      day.classList.add("period-date");
      day.classList.add("has-delete-btn"); // 用于CSS定位

      // 添加删除周期的X按钮（右上角，悬停显示）
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "period-cell-delete-btn";
      deleteBtn.innerHTML = "×";
      deleteBtn.setAttribute("data-tooltip", t("periodClearCycle") || "清除本次周期");
      deleteBtn.addEventListener("click", (ev) => {
        ev.stopPropagation(); // 阻止触发日期点击事件
        showConfirm(t("periodClearCycleConfirm") || "确定清除本次周期记录吗？", () => {
          // 找到该日期所属的cycle，删除整个cycle
          const targetCycle = getCycleByDate(dateStr);
          if (targetCycle) {
            const idx = periodCycles.indexOf(targetCycle);
            if (idx !== -1) {
              periodCycles.splice(idx, 1);
              savePeriodCycles();
              showToast(t("periodCycleCleared") || "该周期记录已清除");
              // 如果当前选中的日期在被删除的cycle中，清空选中状态
              if (selectedPeriodDate) {
                const range = getDatesInRange(targetCycle.startDate, targetCycle.endDate);
                if (range.includes(selectedPeriodDate)) {
                  selectedPeriodDate = null;
                  selectMood(-1);
                  selectSymptoms([]);
                  selectBloodColor(-1);
                  const remarkInput = document.getElementById("periodRemarkInput");
                  if (remarkInput) remarkInput.value = "";
                  clearPeriodUnsaved();
                  updatePeriodToggleBtn();
                }
              }
            }
          }
        });
      });
      day.appendChild(deleteBtn);

      // 悬浮显示 tooltip
      day.addEventListener("mouseenter", (e) => {
        const targetCycle = getCycleByDate(dateStr);
        const dayData = targetCycle ? ((targetCycle.days || {})[dateStr] || {}) : {};
        const range = targetCycle ? getDatesInRange(targetCycle.startDate, targetCycle.endDate) : [];
        const dayIdx = range.indexOf(dateStr) + 1;
        showPeriodTooltip(e, dateStr, targetCycle, dayData, day, dayIdx);
      });
      day.addEventListener("mouseleave", () => {
        hidePeriodTooltip();
      });
      // 点击选中日期，进入编辑模式（先检查未保存）
      day.addEventListener("click", () => {
        if (periodUnsaved) {
          showConfirm(t("periodUnsavedConfirm"), () => {
            clearPeriodUnsaved();
            selectPeriodDate(dateStr);
          });
          return;
        }
        selectPeriodDate(dateStr);
      });
      if (selectedPeriodDate === dateStr) {
        day.classList.add("selected-period-day");
      }
    } else {
      // 非经期日期：点击可补签（作为经期第一天）
      day.style.cursor = "pointer";
      day.setAttribute("data-tooltip", t("periodBackdateHint") || "点击可补签为经期第一天");
      day.addEventListener("click", () => {
        if (periodUnsaved) {
          showConfirm(t("periodUnsavedConfirm"), () => {
            clearPeriodUnsaved();
            backdateProceed();
          });
          return;
        }
        backdateProceed();
        function backdateProceed() {
          // 检查是否已在某个周期内（防御性检查）
          if (getCycleByDate(dateStr)) {
            showToast(t("periodDateInCycle"));
            return;
          }
          // 检查是否已有进行中的经期（未结束）
          const active = getActivePeriod();
          if (active) {
            showToast(t("periodPleaseSaveFirst"));
            return;
          }
          // 确认补签
          const dateDisplay = formatDateDisplay(dateStr);
          showConfirm(t("periodBackdateConfirm", { date: dateDisplay }), () => {
            // 创建新周期
            periodCycles.push({ startDate: dateStr, endDate: null, days: {} });
            savePeriodCycles();
            selectPeriodDate(dateStr);
            updatePeriodToggleBtn();
            showToast(t("toastPeriodRecorded"));
          });
        }
      });
    }

    calendarDays.appendChild(day);
  }

  // 更新日历标题
  const titleEl = document.getElementById("periodCalendarTitle");
  if (titleEl) {
    titleEl.textContent = t("yearMonth", {
      y: periodCalendarYear,
      m: periodCalendarMonth + 1
    });
  }

  // 预测经期横幅
  const banner = document.getElementById("periodPredictBanner");
  if (banner) {
    if (predictedStart && predictedEnd) {
      banner.style.display = "block";
      banner.textContent = t("periodPredicted") + "：" + t("periodPredictRange", {
        start: predictedStart.slice(5),
        end: predictedEnd.slice(5)
      });
    } else {
      banner.style.display = "none";
    }
  }

  // 如果没有选中任何经期日期，默认选中今天或最近经期日期
  if (!selectedPeriodDate || !getCycleByDate(selectedPeriodDate)) {
    const active = getActivePeriod();
    if (active) {
      selectPeriodDate(getToday());
    } else if (periodCycles.length > 0) {
      const last = periodCycles[periodCycles.length - 1];
      if (last.endDate) selectPeriodDate(last.endDate);
    }
  }
}

// 根据日期找到所属周期
function getCycleByDate(dateStr) {
  return periodCycles.find(c => {
    const range = getDatesInRange(c.startDate, c.endDate);
    return range.includes(dateStr);
  });
}

// 选中某个经期日期，加载该天的心情/症状/备注
function selectPeriodDate(dateStr) {
  const cycle = getCycleByDate(dateStr);
  if (!cycle) return;
  selectedPeriodDate = dateStr;

  // 更新日历高亮
  document.querySelectorAll("#periodCalendarDays .day-cell").forEach(el => {
    el.classList.toggle("selected-period-day", el.dataset.date === dateStr);
  });

  // 加载该天数据
  const dayData = (cycle.days || {})[dateStr] || {};
  selectMood(dayData.mood !== undefined ? dayData.mood : -1);
  setPainSlider(dayData.pain !== undefined && dayData.pain >= 0 ? dayData.pain : 0);
  selectSymptoms(dayData.symptoms || []);
  setFlowSlider(dayData.flow !== undefined && dayData.flow >= 0 ? dayData.flow : 0);
  selectBloodColor(dayData.bloodColor !== undefined ? dayData.bloodColor : -1);

  const remarkInput = document.getElementById("periodRemarkInput");
  if (remarkInput) remarkInput.value = dayData.remark || "";

  // 显示详情内容区域（选中日期时展开，方便编辑）
  const detailContent = document.getElementById("periodDetailContent");
  if (detailContent) detailContent.classList.add("show");
  const divider = document.getElementById("periodStatusDivider");
  if (divider && !divider.classList.contains("show")) divider.classList.add("show");
  clearPeriodUnsaved();
  // 更新状态文字（天数跟随选中日期）
  updatePeriodToggleBtn();
}

// ==================== 经期日历悬浮 tooltip ====================
let periodTooltipTimeout = null;

function showPeriodTooltip(e, dateStr, cycle, dayData, targetElement, dayIndex) {
  clearTimeout(periodTooltipTimeout);
  const tooltip = document.getElementById("periodTooltip");
  if (!tooltip) return;

  try {
    // 日期 + 第几天
    const dateEl = tooltip.querySelector(".pt-date");
    if (dateEl) {
      let dateText = formatDateDisplay(dateStr);
      if (dayIndex !== undefined && dayIndex >= 1) {
        dateText += ` · ${t("periodDay", { n: dayIndex })}`;
      }
      dateEl.textContent = dateText;
    }

    // 心情
    const moodEl = document.getElementById("ptMood");
    if (moodEl) {
      if (dayData && dayData.mood !== undefined && dayData.mood >= 0) {
        const moodTexts = t("periodMoods") || [];
        const moodEmojis = t("periodMoodEmojis") || [];
        moodEl.innerHTML = `<span class="pt-label">${t("periodMoodLabel")}</span><span>${moodEmojis[dayData.mood] || ""} ${moodTexts[dayData.mood] || ""}</span>`;
        moodEl.style.display = "flex";
      } else {
        moodEl.style.display = "none";
      }
    }

    // 痛感
    const painEl = document.getElementById("ptPain");
    if (painEl) {
      if (dayData && dayData.pain !== undefined && dayData.pain >= 0) {
        const painTexts = t("periodPainLevels") || [];
        const painEmojis = t("periodPainEmojis") || [];
        painEl.innerHTML = `<span class="pt-label">${t("periodPainLabel")}</span><span>${painEmojis[dayData.pain] || ""} ${painTexts[dayData.pain] || ""}</span>`;
        painEl.style.display = "flex";
      } else {
        painEl.style.display = "none";
      }
    }

    // 症状
    const symptomsEl = document.getElementById("ptSymptoms");
    if (symptomsEl) {
      if (dayData && dayData.symptoms && dayData.symptoms.length > 0) {
        const symptomTexts = t("periodSymptoms") || [];
        const symptomEmojis = t("periodSymptomEmojis") || [];
        const symptomsHtml = dayData.symptoms.map(s => {
          return `${symptomEmojis[s] || ""} ${symptomTexts[s] || ""}`;
        }).join(" ");
        symptomsEl.innerHTML = `<span class="pt-label">${t("periodSymptomsLabel")}</span><span>${symptomsHtml}</span>`;
        symptomsEl.style.display = "flex";
      } else {
        symptomsEl.style.display = "none";
      }
    }

    // 流量
    const flowEl = document.getElementById("ptFlow");
    if (flowEl) {
      if (dayData && dayData.flow !== undefined && dayData.flow >= 0) {
        const flowTexts = t("periodFlowLevels") || [];
        const flowEmojis = t("periodFlowEmojis") || [];
        flowEl.innerHTML = `<span class="pt-label">${t("periodFlowLabel")}</span><span>${flowEmojis[dayData.flow] || ""} ${flowTexts[dayData.flow] || ""}</span>`;
        flowEl.style.display = "flex";
      } else {
        flowEl.style.display = "none";
      }
    }

    // 血的颜色
    const bloodEl = document.getElementById("ptBlood");
    if (bloodEl) {
      if (dayData && dayData.bloodColor !== undefined && dayData.bloodColor >= 0) {
        const colorNames = t("periodBloodColors") || [];
        const colorValues = BLOOD_COLOR_VALUES;
        const idx = dayData.bloodColor;
        bloodEl.innerHTML = `<span class="pt-label">${t("periodBloodColorLabel")}</span><span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorValues[idx]};border:1px solid rgba(0,0,0,0.12);"></span>${colorNames[idx] || ""}</span>`;
        bloodEl.style.display = "flex";
      } else {
        bloodEl.style.display = "none";
      }
    }

    // 备注
    const remarkEl = document.getElementById("ptRemark");
    if (remarkEl) {
      if (dayData && dayData.remark) {
        remarkEl.textContent = dayData.remark;
        remarkEl.style.display = "block";
      } else {
        remarkEl.style.display = "none";
      }
    }

    // 定位 tooltip（显示在日期单元格下方）
    positionPeriodTooltip(e, targetElement);
    tooltip.classList.add("show");
  } catch (err) {
    console.error("showPeriodTooltip error:", err);
  }
}

function hidePeriodTooltip() {
  clearTimeout(periodTooltipTimeout);
  periodTooltipTimeout = setTimeout(() => {
    const tooltip = document.getElementById("periodTooltip");
    if (tooltip) tooltip.classList.remove("show");
  }, 150);
}

function positionPeriodTooltip(e, targetElement) {
  const tooltip = document.getElementById("periodTooltip");
  if (!tooltip) return;

  // 临时显示以获取尺寸
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";
  const tooltipRect = tooltip.getBoundingClientRect();
  tooltip.style.display = "";
  tooltip.style.visibility = "";

  let left, top;
  if (targetElement) {
    // 基于目标元素定位：在元素下方居中
    const rect = targetElement.getBoundingClientRect();
    left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    if (left < 8) left = 8;
    top = rect.bottom + 8;
    // 如果超出视口下方，则显示在元素上方
    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = rect.top - tooltipRect.height - 8;
    }
  } else {
    // 回退到鼠标位置定位
    const x = e.clientX;
    const y = e.clientY;
    const offsetX = 12;
    const offsetY = 12;
    left = x + offsetX;
    top = y + offsetY;
    if (left + tooltipRect.width > window.innerWidth) {
      left = x - tooltipRect.width - offsetX;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = y - tooltipRect.height - offsetY;
    }
  }

  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  if (top < 8) top = 8;

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

// 更新经期状态卡片（Toggle + 状态文字 + 详情区域）
function updatePeriodToggleBtn() {
  const input = document.getElementById("periodToggleInput");
  const statusText = document.getElementById("periodStatusText");
  const divider = document.getElementById("periodStatusDivider");
  const detailContent = document.getElementById("periodDetailContent");
  if (!input || !statusText) return;

  // 优先使用选中的日期，没有选中则用今天
  const targetDate = selectedPeriodDate || getToday();

  // 使用 getCycleByDate 一致地查找周期（与 selectPeriodDate 相同逻辑）
  const cycle = getCycleByDate(targetDate);
  const isPeriod = !!cycle;

  input.checked = isPeriod;

  if (isPeriod && cycle) {
    const range = getDatesInRange(cycle.startDate, cycle.endDate);
    const dayIndex = range.indexOf(targetDate) + 1;
    statusText.textContent = t("periodStatusOn") + (dayIndex > 0 ? ` · 第${dayIndex}天` : "");
    statusText.classList.add("active");
    if (divider) divider.classList.add("show");
    if (detailContent) detailContent.classList.add("show");
  } else {
    statusText.textContent = t("periodStatusOff");
    statusText.classList.remove("active");
    if (divider) divider.classList.remove("show");
    if (detailContent) detailContent.classList.remove("show");
  }
}

// 选择心情
function selectMood(mood) {
  selectedMood = mood;
  const btns = document.querySelectorAll("#periodMoodBtns .period-mood-btn");
  btns.forEach((btn, idx) => {
    btn.classList.toggle("active", idx === mood && mood >= 0);
  });
}

// 选择症状
function selectSymptoms(symptoms) {
  selectedSymptoms = symptoms || [];
  const btns = document.querySelectorAll("#periodSymptomBtns .period-symptom-btn");
  btns.forEach((btn, idx) => {
    btn.classList.toggle("active", selectedSymptoms.includes(idx));
  });
}

// 初始化心情按钮
function initPeriodMoodBtns() {
  const container = document.getElementById("periodMoodBtns");
  if (!container) return;
  const moodEmojis = t("periodMoodEmojis");
  container.innerHTML = "";
  moodEmojis.forEach((emoji, idx) => {
    const btn = document.createElement("button");
    btn.className = "period-mood-btn";
    btn.textContent = emoji;
    btn.dataset.mood = idx;
    const moodTexts = t("periodMoods");
    btn.dataset.tooltip = moodTexts[idx] || "";
    btn.addEventListener("click", () => {
      selectMood(idx);
      markPeriodUnsaved();
    });
    container.appendChild(btn);
  });
}

// 初始化症状按钮
function initPeriodSymptomBtns() {
  const container = document.getElementById("periodSymptomBtns");
  if (!container) return;
  const symptoms = t("periodSymptoms");
  const symptomEmojis = t("periodSymptomEmojis");
  container.innerHTML = "";
  symptoms.forEach((symptom, idx) => {
    const btn = document.createElement("button");
    btn.className = "period-symptom-btn";
    btn.innerHTML = `${symptomEmojis[idx]} ${symptom}`;
    btn.dataset.symptom = idx;
    btn.addEventListener("click", () => {
      const symptomIdx = parseInt(btn.dataset.symptom);
      if (selectedSymptoms.includes(symptomIdx)) {
        selectedSymptoms = selectedSymptoms.filter(s => s !== symptomIdx);
      } else {
        selectedSymptoms.push(symptomIdx);
      }
      selectSymptoms(selectedSymptoms);
      markPeriodUnsaved();
    });
    container.appendChild(btn);
  });
}

// 初始化血的颜色按钮
const BLOOD_COLOR_VALUES = ["#e53e3e", "#8b0000", "#8b4513", "#ffb6c1", "#ffa500"];
function initPeriodBloodColorBtns() {
  const container = document.getElementById("periodBloodColorBtns");
  if (!container) return;
  const colors = t("periodBloodColors");
  container.innerHTML = "";
  colors.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.className = "period-blood-btn";
    btn.dataset.colorIdx = idx;
    btn.innerHTML = `<span class="period-blood-swatch" style="background:${BLOOD_COLOR_VALUES[idx]}"></span>`;
    btn.dataset.tooltip = name;
    btn.addEventListener("click", () => { selectBloodColor(idx); markPeriodUnsaved(); });
    container.appendChild(btn);
  });
}

// 选择血的颜色
let selectedBloodColor = -1;
function selectBloodColor(idx) {
  if (selectedBloodColor === idx) {
    selectedBloodColor = -1;
  } else {
    selectedBloodColor = idx;
  }
  document.querySelectorAll("#periodBloodColorBtns .period-blood-btn").forEach(btn => {
    btn.classList.toggle("selected", parseInt(btn.dataset.colorIdx) === selectedBloodColor);
  });
}

// 痛感 Slider 逻辑 - 动态读取 i18n
function getPainEmojis() {
  const lang = currentLang || "zh";
  const raw = (I18N[lang] && I18N[lang]["periodPainEmojis"]) || I18N["zh"]["periodPainEmojis"];
  return raw || ["😊", "🙂", "😣", "😫", "😭"];
}
function getPainLevels() {
  const lang = currentLang || "zh";
  const raw = (I18N[lang] && I18N[lang]["periodPainLevels"]) || I18N["zh"]["periodPainLevels"];
  return raw || ["无明显痛感", "轻微疼痛", "中度疼痛", "重度疼痛", "剧烈疼痛"];
}

function initPeriodPainSlider() {
  const slider = document.getElementById("periodPainSlider");
  const emojiEl = document.getElementById("periodPainEmoji");
  const labelEl = document.getElementById("periodPainLabel");
  const ticksEl = document.getElementById("periodPainTicks");
  if (!slider || !emojiEl || !labelEl) return;

  // 动态生成 emoji ticks（6 档，按档位精确对齐 thumb 中心）
  if (ticksEl) {
    const emojis = getPainEmojis();
    const max = emojis.length - 1;
    ticksEl.innerHTML = emojis.map((e, i) =>
      `<span style="left:calc(8px + (100% - 16px) * ${i / max})" data-val="${i}">${e}</span>`
    ).join("");
    ticksEl.querySelectorAll("span").forEach(sp => {
      sp.addEventListener("click", () => {
        slider.value = sp.dataset.val;
        updatePainDisplay(slider.value);
        highlightPainTick(parseInt(sp.dataset.val));
        markPeriodUnsaved();
      });
    });
    highlightPainTick(parseInt(slider.value));
  }

  function updatePainDisplay(val) {
    const v = parseInt(val);
    const emojis = getPainEmojis();
    const levels = getPainLevels();
    emojiEl.textContent = emojis[v] || "";
    labelEl.textContent = levels[v] || "";
    labelEl.style.color = "var(--period)";
    selectedPain = v;
  }

  function highlightPainTick(val) {
    if (!ticksEl) return;
    ticksEl.querySelectorAll("span").forEach(s => s.classList.remove("active"));
    const sp = ticksEl.querySelector(`span[data-val="${val}"]`);
    if (sp) sp.classList.add("active");
  }

  slider.addEventListener("input", (e) => {
    updatePainDisplay(e.target.value);
    highlightPainTick(parseInt(e.target.value));
    markPeriodUnsaved();
  });

  // 初始化显示
  updatePainDisplay(slider.value);
}

function setPainSlider(val) {
  const slider = document.getElementById("periodPainSlider");
  if (!slider) return;
  const v = Math.max(0, parseInt(val));
  slider.value = v;
  const emojiEl = document.getElementById("periodPainEmoji");
  const labelEl = document.getElementById("periodPainLabel");
  const emojis = getPainEmojis();
  const levels = getPainLevels();
  if (emojiEl) emojiEl.textContent = emojis[v] || "";
  if (labelEl) {
    labelEl.textContent = levels[v] || "";
    labelEl.style.color = "var(--period)";
  }
  const ticksEl = document.getElementById("periodPainTicks");
  if (ticksEl) {
    ticksEl.querySelectorAll("span").forEach(s => s.classList.remove("active"));
    const sp = ticksEl.querySelector(`span[data-val="${v}"]`);
    if (sp) sp.classList.add("active");
  }
  selectedPain = v;
}

// 流量 Slider 逻辑 - 动态读取 i18n
function getFlowEmojis() {
  const lang = currentLang || "zh";
  const raw = (I18N[lang] && I18N[lang]["periodFlowEmojis"]) || I18N["zh"]["periodFlowEmojis"];
  return raw || ["🩲", "🩹", "💧", "💦", "🌊"];
}
function getFlowLevels() {
  const lang = currentLang || "zh";
  const raw = (I18N[lang] && I18N[lang]["periodFlowLevels"]) || I18N["zh"]["periodFlowLevels"];
  return raw || ["很少", "少", "中", "多", "很多"];
}

function initPeriodFlowSlider() {
  const slider = document.getElementById("periodFlowSlider");
  const emojiEl = document.getElementById("periodFlowEmoji");
  const labelEl = document.getElementById("periodFlowLabel");
  const ticksEl = document.getElementById("periodFlowTicks");
  if (!slider || !emojiEl || !labelEl) return;

  // 动态生成 emoji ticks（6 档，按档位精确对齐 thumb 中心）
  if (ticksEl) {
    const emojis = getFlowEmojis();
    const max = emojis.length - 1;
    ticksEl.innerHTML = emojis.map((e, i) =>
      `<span style="left:calc(8px + (100% - 16px) * ${i / max})" data-val="${i}">${e}</span>`
    ).join("");
    ticksEl.querySelectorAll("span").forEach(sp => {
      sp.addEventListener("click", () => {
        slider.value = sp.dataset.val;
        updateFlowDisplay(slider.value);
        highlightFlowTick(parseInt(sp.dataset.val));
        markPeriodUnsaved();
      });
    });
    highlightFlowTick(parseInt(slider.value));
  }

  function updateFlowDisplay(val) {
    const v = parseInt(val);
    const emojis = getFlowEmojis();
    const levels = getFlowLevels();
    emojiEl.textContent = emojis[v] || "";
    labelEl.textContent = levels[v] || "";
    labelEl.style.color = "var(--period)";
    selectedFlow = v;
  }

  function highlightFlowTick(val) {
    if (!ticksEl) return;
    ticksEl.querySelectorAll("span").forEach(s => s.classList.remove("active"));
    const sp = ticksEl.querySelector(`span[data-val="${val}"]`);
    if (sp) sp.classList.add("active");
  }

  slider.addEventListener("input", (e) => {
    updateFlowDisplay(e.target.value);
    highlightFlowTick(parseInt(e.target.value));
    markPeriodUnsaved();
  });

  // 初始化显示
  updateFlowDisplay(slider.value);
}

function setFlowSlider(val) {
  const slider = document.getElementById("periodFlowSlider");
  if (!slider) return;
  const v = Math.max(0, parseInt(val));
  slider.value = v;
  const emojiEl = document.getElementById("periodFlowEmoji");
  const labelEl = document.getElementById("periodFlowLabel");
  const emojis = getFlowEmojis();
  const levels = getFlowLevels();
  if (emojiEl) emojiEl.textContent = emojis[v] || "";
  if (labelEl) {
    labelEl.textContent = levels[v] || "";
    labelEl.style.color = "var(--period)";
  }
  const ticksEl = document.getElementById("periodFlowTicks");
  if (ticksEl) {
    ticksEl.querySelectorAll("span").forEach(s => s.classList.remove("active"));
    const sp = ticksEl.querySelector(`span[data-val="${v}"]`);
    if (sp) sp.classList.add("active");
  }
  selectedFlow = v;
}

// 监听语言切换，刷新 slider 显示
document.addEventListener("i18nApplied", () => {
  const painSlider = document.getElementById("periodPainSlider");
  const flowSlider = document.getElementById("periodFlowSlider");
  if (painSlider) {
    const v = parseInt(painSlider.value);
    const emojiEl = document.getElementById("periodPainEmoji");
    const labelEl = document.getElementById("periodPainLabel");
    const emojis = getPainEmojis();
    const levels = getPainLevels();
    if (emojiEl) emojiEl.textContent = emojis[v] || "";
    if (labelEl) {
      labelEl.textContent = levels[v] || "";
      labelEl.style.color = "var(--period)";
    }
    // 重新生成刻度（emoji 随语言变化）
    const ticksEl = document.getElementById("periodPainTicks");
    if (ticksEl) {
      const max = emojis.length - 1;
      ticksEl.innerHTML = emojis.map((e, i) =>
        `<span style="left:calc(8px + (100% - 16px) * ${i / max})" data-val="${i}">${e}</span>`
      ).join("");
      const sp = ticksEl.querySelector(`span[data-val="${v}"]`);
      if (sp) sp.classList.add("active");
    }
  }
  if (flowSlider) {
    const v = parseInt(flowSlider.value);
    const emojiEl = document.getElementById("periodFlowEmoji");
    const labelEl = document.getElementById("periodFlowLabel");
    const emojis = getFlowEmojis();
    const levels = getFlowLevels();
    if (emojiEl) emojiEl.textContent = emojis[v] || "";
    if (labelEl) {
      labelEl.textContent = levels[v] || "";
      labelEl.style.color = "var(--period)";
    }
    const ticksEl = document.getElementById("periodFlowTicks");
    if (ticksEl) {
      const max = emojis.length - 1;
      ticksEl.innerHTML = emojis.map((e, i) =>
        `<span style="left:calc(8px + (100% - 16px) * ${i / max})" data-val="${i}">${e}</span>`
      ).join("");
      const sp = ticksEl.querySelector(`span[data-val="${v}"]`);
      if (sp) sp.classList.add("active");
    }
  }
});

// 更新经期统计
function updatePeriodStats() {
  const completed = periodCycles.filter(c => c.endDate !== null);
  const total = completed.length;
  document.getElementById("periodTotalCycles").textContent = total || "--";

  if (total === 0) {
    document.getElementById("periodAvgCycle").textContent = "--";
    document.getElementById("periodAvgDuration").textContent = "--";
    document.getElementById("periodAbnormalCount").textContent = "--";
    return;
  }

  // 计算周期长度（相邻周期起始日间隔）
  const cycleLengths = [];
  for (let i = 1; i < periodCycles.length; i++) {
    if (periodCycles[i].endDate !== null && periodCycles[i - 1].endDate !== null) {
      const prevStart = new Date(periodCycles[i - 1].startDate + "T00:00:00");
      const currStart = new Date(periodCycles[i].startDate + "T00:00:00");
      const len = Math.round((currStart - prevStart) / 86400000);
      if (len > 20 && len < 45) cycleLengths.push(len);
    }
  }

  const avgCycle = cycleLengths.length > 0
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : 28;
  document.getElementById("periodAvgCycle").textContent = avgCycle + " " + t("periodBarChartDay");

  // 计算经期持续时间
  const durations = completed.map(c => {
    const s = new Date(c.startDate + "T00:00:00");
    const e = new Date(c.endDate + "T00:00:00");
    return Math.round((e - s) / 86400000) + 1;
  });

  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 5;
  document.getElementById("periodAvgDuration").textContent = avgDuration + " " + t("periodBarChartDay");

  // 合并异常次数（周期长度异常 + 经期天数异常）
  let cycleAbnormal = 0;
  cycleLengths.forEach(len => { if (Math.abs(len - avgCycle) > 3) cycleAbnormal++; });
  let durationAbnormal = 0;
  durations.forEach(d => { if (Math.abs(d - avgDuration) > 1) durationAbnormal++; });
  const totalAbnormal = cycleAbnormal + durationAbnormal;
  document.getElementById("periodAbnormalCount").textContent = totalAbnormal + " " + t("periodBarChartDay");
}

// 渲染周期趋势条形图（圆角胶囊形，左右双条 + 均值参考线）
function renderPeriodBarChart() {
  const container = document.getElementById("periodBarChart");
  if (!container) return;

  // 获取最近6个已完成周期（按时间倒序）
  const completed = periodCycles.filter(c => c.endDate !== null);
  if (completed.length === 0) {
    container.innerHTML = `<div style="color:var(--muted);text-align:center;padding:8px 0;font-size:11px;">${t("periodNoRecord")}</div>`;
    return;
  }

  const recent = completed.slice(-6); // 最近6个
  const sorted = [...recent].reverse(); // 倒序显示（最新的在上方）

  // 计算每条周期的周期长度和持续天数（统一用本地时间，避免UTC偏差）
  const chartData = sorted.map((cycle) => {
    const start = new Date(cycle.startDate + "T00:00:00");
    const end = new Date(cycle.endDate + "T00:00:00");
    const duration = Math.round((end - start) / 86400000) + 1;
    let cycleLen = null;
    const ci = periodCycles.indexOf(cycle);
    if (ci > 0 && periodCycles[ci - 1].endDate) {
      const prev = new Date(periodCycles[ci - 1].startDate + "T00:00:00");
      const curr = new Date(cycle.startDate + "T00:00:00");
      cycleLen = Math.round((curr - prev) / 86400000);
      if (cycleLen <= 20 || cycleLen >= 45) cycleLen = null;
    }
    return { cycle, duration, cycleLen };
  });

  // 计算参考基准和异常阈值
  const allCycleLens = chartData.filter(d => d.cycleLen).map(d => d.cycleLen);
  const avgCycle = allCycleLens.length > 0
    ? Math.round(allCycleLens.reduce((a, b) => a + b, 0) / allCycleLens.length)
    : 28;
  const allDurations = chartData.map(d => d.duration);
  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 5;

  // 最大基准（含均值，确保均值线不溢出）
  const maxCycleLen = Math.max(...allCycleLens, 35, avgCycle);
  const maxDuration = Math.max(...allDurations, 8, avgDuration);
  const avgCyclePct = (avgCycle / maxCycleLen) * 100;
  const avgDurationPct = (avgDuration / maxDuration) * 100;

  let html = "";
  chartData.forEach((d) => {
    const seq = completed.length - periodCycles.indexOf(d.cycle);

    // 周期长度：缺失时以 28 天估算（虚线占位），确保两条数据同时出现
    const cycleVal = d.cycleLen !== null ? d.cycleLen : 28;
    const cycleWidth = Math.max(6, (cycleVal / maxCycleLen) * 100);
    const durationWidth = (d.duration / maxDuration) * 100;

    const cycleAbnormal = d.cycleLen ? Math.abs(d.cycleLen - avgCycle) > 3 : false;
    const durationAbnormal = Math.abs(d.duration - avgDuration) > 1;

    const cycleValueText = d.cycleLen !== null ? d.cycleLen : "≈" + 28;
    const cycleEstimateCls = d.cycleLen === null ? " bar-estimate" : "";
    const cycleAbnormalCls = cycleAbnormal ? " bar-abnormal" : "";
    const durAbnormalCls = durationAbnormal ? " bar-abnormal" : "";

    html += `<div class="bar-row">
      <div class="bar-label">#${seq}</div>
      <div class="bar-bars">
        <div class="bar-line">
          <div class="bar-track">
            <div class="bar-fill bar-fill-cycle${cycleEstimateCls}${cycleAbnormalCls}" style="width:${cycleWidth}%;"></div>
            <span class="bar-avg-line" style="left:${avgCyclePct}%;"></span>
          </div>
          <div class="bar-value${cycleEstimateCls}${cycleAbnormalCls}">${cycleValueText}</div>
        </div>
        <div class="bar-line">
          <div class="bar-track">
            <div class="bar-fill bar-fill-duration${durAbnormalCls}" style="width:${durationWidth}%;"></div>
            <span class="bar-avg-line" style="left:${avgDurationPct}%;"></span>
          </div>
          <div class="bar-value${durAbnormalCls}">${d.duration}</div>
        </div>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

// 渲染周期记录时间轴
function renderPeriodCycleTable() {
  const container = document.getElementById("periodCycleTable");
  if (!container) return;
  if (periodCycles.length === 0) {
    container.innerHTML = `<div class="tl-empty">
      <div class="tl-empty-icon">🩸</div>
      <div>${t("periodNoRecord")}</div>
    </div>`;
    return;
  }

  const active = getActivePeriod();
  const avgDuration = (() => {
    const completed = periodCycles.filter(c => c.endDate !== null);
    if (completed.length === 0) return 5;
    const durs = completed.map(c => {
      const s = new Date(c.startDate + "T00:00:00");
      const e = new Date(c.endDate + "T00:00:00");
      return Math.round((e - s) / 86400000) + 1;
    });
    return Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
  })();

  // 所有周期倒序显示（最新的在上方）
  const sorted = [...periodCycles].reverse();

  let html = `<div class="tl-list"><div class="tl-line"></div>`;

  sorted.forEach((cycle) => {
    const isActive = active && active.startDate === cycle.startDate;
    const ci = periodCycles.indexOf(cycle);

    // 计算持续天数（统一归零时间，避免时分秒误差）
    let duration = null;
    let rangeStr = "";
    const cycleStart = new Date(cycle.startDate + "T00:00:00");
    if (cycle.endDate) {
      const endDate = new Date(cycle.endDate + "T00:00:00");
      duration = Math.round((endDate - cycleStart) / 86400000) + 1;
      const endFmt = cycle.endDate.slice(5); // MM-DD
      rangeStr = `${cycle.startDate.slice(5)} ~ ${endFmt}`;
    } else if (isActive) {
      const todayStr = getToday();
      const today = new Date(todayStr + "T00:00:00");
      duration = Math.round((today - cycleStart) / 86400000) + 1;
      rangeStr = t("periodActiveShort");
    }

    // 计算周期长度（与上一个周期间隔）
    let cycleLenStr = "--";
    if (ci > 0 && periodCycles[ci - 1].endDate) {
      const prev = new Date(periodCycles[ci - 1].startDate + "T00:00:00");
      const curr = new Date(cycle.startDate + "T00:00:00");
      const len = Math.round((curr - prev) / 86400000);
      if (len > 20 && len < 45) cycleLenStr = len + " " + t("periodBarChartDay");
    }

    // 进度百分比（仅进行中）
    let progressPct = 0;
    if (isActive) {
      progressPct = Math.min(100, Math.round((duration / avgDuration) * 100));
    }

    const cardClass = isActive ? "tl-card active" : "tl-card";
    const dotClass = isActive ? "tl-dot active" : "tl-dot";
    const titleText = isActive
      ? t("periodActive").replace("{n}", duration)
      : cycle.startDate;

    html += `<div class="tl-item">
      <div class="${dotClass}"></div>
      <div class="${cardClass}">
        <div class="tl-card-title">${titleText}</div>
        <div class="tl-card-range">${rangeStr ? rangeStr : cycle.startDate}</div>
        <div class="tl-card-meta">${t("periodCycleTableDuration")}: ${duration !== null ? duration + " " + t("periodBarChartDay") : '--'}  ·  ${t("periodCycleTableCycleLen")}: ${cycleLenStr}</div>
        ${isActive ? `<div class="tl-progress-bar"><div class="tl-progress-fill" data-pct="${progressPct}"></div></div>` : ""}
      </div>
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // 进度条动画（延迟一帧让 DOM 先渲染）
  requestAnimationFrame(() => {
    container.querySelectorAll(".tl-progress-fill").forEach(el => {
      el.style.width = el.getAttribute("data-pct") + "%";
    });
  });
}

// 初始化经期记录功能
function initPeriodTracker() {
  loadPeriodCycles(() => {
    renderPeriodCalendar();
    updatePeriodStats();
    renderPeriodBarChart();
    renderPeriodCycleTable();
    updatePeriodToggleBtn();
  });

  // 初始化按钮
  initPeriodMoodBtns();
  initPeriodPainSlider();
  initPeriodSymptomBtns();
  initPeriodFlowSlider();
  initPeriodBloodColorBtns();

  // 备注输入标记未保存
  const remarkInput = document.getElementById("periodRemarkInput");
  if (remarkInput) {
    remarkInput.addEventListener("input", markPeriodUnsaved);
  }

  // Tooltip 悬浮延迟处理（鼠标移到 tooltip 上不立即消失）
  const periodTooltipEl = document.getElementById("periodTooltip");
  if (periodTooltipEl) {
    periodTooltipEl.addEventListener("mouseenter", () => { clearTimeout(periodTooltipTimeout); });
    periodTooltipEl.addEventListener("mouseleave", () => { hidePeriodTooltip(); });
  }

  // 月份切换
  const prevBtn = document.getElementById("periodPrevMonth");
  const nextBtn = document.getElementById("periodNextMonth");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      periodCalendarMonth--;
      if (periodCalendarMonth < 0) { periodCalendarMonth = 11; periodCalendarYear--; }
      renderPeriodCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      periodCalendarMonth++;
      if (periodCalendarMonth > 11) { periodCalendarMonth = 0; periodCalendarYear++; }
      renderPeriodCalendar();
    });
  }

  // 经期开关 Toggle（开始/结束经期，支持补签）
  const toggleInput = document.getElementById("periodToggleInput");
  if (toggleInput) {
    toggleInput.addEventListener("change", () => {
      if (periodUnsaved) {
        showToast(t("periodPleaseSaveFirst") || "请先保存当前修改");
        toggleInput.checked = !toggleInput.checked;
        return;
      }
      const active = getActivePeriod();
      if (toggleInput.checked) {
        // 开启经期（支持补签：优先用选中日期，否则用今天）
        if (!active) {
          const startDate = (selectedPeriodDate && !getCycleByDate(selectedPeriodDate))
            ? selectedPeriodDate
            : getToday();
          periodCycles.push({ startDate, endDate: null, days: {} });
          savePeriodCycles();
          updatePeriodToggleBtn();
          selectPeriodDate(startDate);
          showToast(t("toastPeriodRecorded"));
          clearPeriodUnsaved();
        }
      } else {
        // 关闭经期（需要确认）
        if (active) {
          showConfirm(t("periodEndConfirm"), () => {
            active.endDate = getToday();
            savePeriodCycles();
            updatePeriodToggleBtn();
            selectedPeriodDate = null;
            clearPeriodUnsaved();
          }, () => {
            toggleInput.checked = true;
          });
        }
      }
    });
  }

  // 保存心情/症状按钮（按天保存）
  const saveMoodBtn = document.getElementById("periodSaveMoodBtn");
  if (saveMoodBtn) {
    saveMoodBtn.addEventListener("click", () => {
      const dateToSave = selectedPeriodDate || getToday();
      const cycle = getCycleByDate(dateToSave);
      if (!cycle) {
        showToast(t("periodSelectDay") || "请先点击日历选择一个经期日期");
        return;
      }
      if (!cycle.days) cycle.days = {};
      cycle.days[dateToSave] = {
        mood: selectedMood >= 0 ? selectedMood : undefined,
        pain: selectedPain,
        symptoms: [...selectedSymptoms],
        flow: selectedFlow,
        bloodColor: selectedBloodColor >= 0 ? selectedBloodColor : undefined,
        remark: (document.getElementById("periodRemarkInput") || {}).value || ""
      };
      savePeriodCycles();
      clearPeriodUnsaved();
      renderPeriodCalendar(); // 重新渲染日历以显示心情 emoji
      showToast(t("periodDaySaved") || "该天记录已保存");
    });
  }
}

initPeriodTracker();

// ============ 数据可靠性：主数据 + 备份自愈 ============
// 写入主数据的同时写一份备份；主数据缺失时从备份恢复。
function persistRecords(key, data, cb) {
  chrome.storage.local.set({ [key]: data }, () => {
    if (chrome.runtime.lastError) {
      console.error("[persist] 保存失败", key, chrome.runtime.lastError.message);
    } else {
      const bk = key + "Backup";
      chrome.storage.local.set({ [bk]: data });
    }
    if (typeof cb === "function") cb();
  });
}

// 启动时若主数据完全缺失（键不存在）但有非空备份，则恢复。
function restoreAllBackups(cb) {
  const keys = ["mealRecords", "poopRecords", "peeRecords", "periodCycles"];
  const allKeys = keys.concat(keys.map(k => k + "Backup"));
  chrome.storage.local.get(allKeys, (data) => {
    keys.forEach(k => {
      if (!data.hasOwnProperty(k)) {
        const bk = data[k + "Backup"];
        if (bk && (Array.isArray(bk) ? bk.length : Object.keys(bk).length) > 0) {
          chrome.storage.local.set({ [k]: bk }, () => {
            console.warn("[backup] 已从备份恢复", k);
          });
        }
      }
    });
    if (typeof cb === "function") cb();
  });
}

// ============ 数据导出/导入备份 ============
function exportBackup() {
  chrome.storage.local.get(null, (data) => {
    const backup = {
      version: 1,
      exportTime: new Date().toISOString(),
      data: data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("backupExportSuccess"));
  });
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.data || typeof backup.data !== "object") {
        showToast(t("backupImportInvalid"));
        return;
      }
      showConfirm(t("backupImportConfirm"), () => {
        chrome.storage.local.set(backup.data, () => {
          showToast(t("backupImportSuccess"));
          setTimeout(() => location.reload(), 800);
        });
      });
    } catch (err) {
      showToast(t("backupImportInvalid"));
    }
  };
  reader.readAsText(file);
}

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
if (exportBtn) exportBtn.addEventListener("click", exportBackup);
if (importBtn) importBtn.addEventListener("click", () => importFile && importFile.click());
if (importFile) importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importBackup(file);
  e.target.value = "";
});

// ==================== CSV 按模块导出 ====================
function exportCsv(module) {
  const keyMap = { eat: "mealRecords", drink: "drinkRecords", poop: "poopRecords", pee: "peeRecords", period: "periodCycles" };
  const key = keyMap[module];
  if (!key) return;
  chrome.storage.local.get([key], (data) => {
    const rec = data[key];
    let headers = [], rows = [];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

    if (module === "eat") {
      const typeMap = currentLang === "en"
        ? { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }
        : { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
      headers = ["日期", "时间", "餐型", "评分", "饱腹度", "标签", "备注"];
      const records = rec || {};
      for (const d in records) (records[d] || []).forEach((m) => {
        rows.push([d, m.time || "", typeMap[m.type] || m.type || "", m.rating || "", m.fullness || "", (m.tags || []).join("/"), m.remark || ""]);
      });
    } else if (module === "drink") {
      headers = ["日期", "时间"];
      const records = rec || {};
      for (const d in records) (records[d] || []).forEach((r) => rows.push([d, r.time || ""]));
    } else if (module === "poop") {
      const amounts = t("poopAmounts") || [], colors = t("poopColors") || [], bristol = t("bristolTypes") || [];
      headers = ["日期", "时间", "Bristol类型", "排便量", "颜色", "备注", "是否补打卡"];
      const records = rec || {};
      for (const d in records) (records[d] || []).forEach((r) => {
        rows.push([d, r.time || "", r.bristolType ? (bristol[r.bristolType - 1] || r.bristolType) : "", r.amount ? (amounts[r.amount - 1] || "") : "", r.color ? (colors[r.color - 1] || "") : "", r.remark || "", r.isBackfill ? "是" : ""]);
      });
    } else if (module === "pee") {
      const amounts = t("peeAmounts") || [], colors = t("peeColors") || [];
      headers = ["日期", "时间", "尿量", "颜色", "备注", "是否补打卡"];
      const records = rec || {};
      for (const d in records) (records[d] || []).forEach((r) => {
        rows.push([d, r.time || "", r.amount ? (amounts[r.amount - 1] || "") : "", r.color ? (colors[r.color - 1] || "") : "", r.remark || "", r.isBackfill ? "是" : ""]);
      });
    } else if (module === "period") {
      headers = ["开始日期", "结束日期", "持续天数", "周期长度"];
      const cycles = rec || [];
      cycles.forEach((c, i) => {
        let dur = "", cyc = "";
        if (c.endDate) {
          const s = new Date(c.startDate + "T00:00:00"), e = new Date(c.endDate + "T00:00:00");
          dur = Math.round((e - s) / 86400000) + 1;
        }
        if (i > 0 && cycles[i - 1].endDate) {
          const len = Math.round((new Date(c.startDate + "T00:00:00") - new Date(cycles[i - 1].startDate + "T00:00:00")) / 86400000);
          if (len > 20 && len < 45) cyc = len;
        }
        rows.push([c.startDate, c.endDate || "", dur, cyc]);
      });
    }

    if (rows.length === 0) { showToast(t("csvNoData")); return; }
    const csv = "﻿" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const nameMap = { eat: "meal", drink: "drink", poop: "poop", pee: "pee", period: "period" };
    a.download = `daily-tracker-${nameMap[module]}-${getToday()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    showToast(t("csvExported"));
  });
}

const exportCsvBtn = document.getElementById("exportCsvBtn");
const csvChooser = document.getElementById("csvChooser");
const csvChooserClose = document.getElementById("csvChooserClose");
if (exportCsvBtn) exportCsvBtn.addEventListener("click", () => {
  if (csvChooser) csvChooser.style.display = csvChooser.style.display === "none" ? "block" : "none";
});
if (csvChooserClose) csvChooserClose.addEventListener("click", () => { if (csvChooser) csvChooser.style.display = "none"; });
if (csvChooser) csvChooser.querySelectorAll(".csv-mod-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    exportCsv(btn.dataset.mod);
    if (csvChooser) csvChooser.style.display = "none";
  });
});

// ==================== 全局键盘绑定：Enter 快速打卡 ====================
// 在当前 tab 按 Enter 触发该页主操作按钮，复用现有按钮逻辑。
// 防护：输入框内不拦截、任何弹窗/浮层打开时不拦截、喝水未运行给提示。
function isAnyModalOpen() {
  const tagModal = document.getElementById("tagModal");
  const badgeModalOverlay = document.getElementById("badgeModalOverlay");
  const reminderModal = document.getElementById("reminderModal");
  return (
    (editModal && editModal.classList.contains("show")) ||
    (drinkEditOverlay && drinkEditOverlay.classList.contains("show")) ||
    (tagModal && tagModal.classList.contains("active")) ||
    (badgeModalOverlay && !badgeModalOverlay.classList.contains("hidden")) ||
    (sidebarPanel && sidebarPanel.classList.contains("open")) ||
    (reminderModal && reminderModal.classList.contains("show"))
  );
}

function handleGlobalEnter(e) {
  if (e.key !== "Enter") return;
  // 输入框 / 文本域 / 可编辑元素内不拦截，交给元素自身处理（如 mealInput 的 Enter 记录饮食、备注框换行）
  const el = e.target;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
  // 任何弹窗 / 浮层打开时不拦截，交给弹窗内部处理（如确认按钮）
  if (isAnyModalOpen()) return;
  switch (currentTab) {
    case "drink":
      if (!drinkBtn.disabled) {
        drinkBtn.click();
      } else {
        showToast(t("toastStartTimerFirst"));
      }
      break;
    case "poop":
      if (poopCheckinBtn) poopCheckinBtn.click();
      break;
    case "pee":
      if (peeCheckinBtn) peeCheckinBtn.click();
      break;
    case "period": {
      const saveMoodBtn = document.getElementById("periodSaveMoodBtn");
      if (saveMoodBtn) saveMoodBtn.click();
      break;
    }
    case "eat":
      if (addMealBtn) addMealBtn.click();
      break;
  }
}
document.addEventListener("keydown", handleGlobalEnter);




