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

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

// ==================== 页面切换 ====================
let currentTab = "eat";

function switchTab(tab) {
  currentTab = tab;
  
  // 导航高亮
  ["eat", "drink", "poop", "pee"].forEach(t => {
    document.getElementById(`nav${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.toggle("active", t === tab);
  });
  
  // 页面切换
  ["eat", "drink", "poop", "pee"].forEach(t => {
    document.getElementById(`page${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.toggle("active", t === tab);
  });
  
  // 初始化对应页面
  if (tab === "eat") initEatPage();
  if (tab === "drink") { updateDrinkUI(); updateDrinkStats(); renderDrinkCalendar(); }
  if (tab === "poop") { renderPoopCalendar(); updatePoopTodayStatus(); updatePoopStats(); }
  if (tab === "pee") { renderPeeCalendar(); updatePeeTodayStatus(); updatePeeStats(); }
}

// ==================== 吃 - 饮食记录 ====================
const mealInput = document.getElementById("mealInput");
const mealTypeSelect = document.getElementById("mealType");
const addMealBtn = document.getElementById("addMealBtn");
const mealRecordsList = document.getElementById("mealRecordsList");
const mealRecordsHeader = document.getElementById("mealRecordsHeader");
const mealToggle = document.getElementById("mealToggle");
const mealCount = document.getElementById("mealCount");

let isMealExpanded = true;

mealRecordsHeader.addEventListener("click", () => {
  isMealExpanded = !isMealExpanded;
  mealToggle.classList.toggle("collapsed", !isMealExpanded);
  mealRecordsList.classList.toggle("collapsed", !isMealExpanded);
});

function updateMealRecords() {
  const today = getToday();
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    const todayMeals = records[today] || [];
    
    mealCount.textContent = todayMeals.length;
    
    if (todayMeals.length === 0) {
      mealRecordsList.innerHTML = '<div class="record-empty" style="text-align:center;color:var(--muted);padding:10px;">暂无饮食记录</div>';
    } else {
      mealRecordsList.innerHTML = todayMeals.map(meal => {
        const typeLabel = { breakfast: "🌅 早餐", lunch: "☀️ 午餐", dinner: "🌙 晚餐", snack: "🍪 加餐" };
        return `
          <div class="meal-item">
            <span class="meal-type-tag ${meal.type}">${typeLabel[meal.type]}</span>
            <span class="meal-content">${meal.content}</span>
            <span class="meal-time">${meal.time}</span>
          </div>
        `;
      }).join("");
    }
  });
}

addMealBtn.addEventListener("click", () => {
  const content = mealInput.value.trim();
  if (!content) {
    showToast("请输入饮食内容");
    return;
  }
  
  const today = getToday();
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const type = mealTypeSelect.value;
  
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    if (!records[today]) records[today] = [];
    
    records[today].push({ content, time, type, timestamp: Date.now() });
    
    chrome.storage.local.set({ mealRecords: records }, () => {
      mealInput.value = "";
      renderEatCalendar();
      updateMealRecords();
      showToast("🍽️ 饮食已记录");
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
  eatCalendarTitle.textContent = `${eatYear}年${eatMonth + 1}月`;
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
      if (records[dateStr] && records[dateStr].length > 0) cell.classList.add("has-eat");
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
  const typeLabel = { breakfast: "🌅 早餐", lunch: "☀️ 午餐", dinner: "🌙 晚餐", snack: "🍪 加餐" };
  const isToday = dateStr === getToday();
  showEditModal("🍽️ " + formatDateDisplay(dateStr) + " 饮食", dateStr, "eat");
  
  // 如果没有记录，显示添加表单
  if (!dayRecords || dayRecords.length === 0) {
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">暂无饮食记录</div>
      <div class="edit-input-row">
        <select class="edit-type-select" id="eatAddType">
          <option value="breakfast">🌅 早餐</option>
          <option value="lunch">☀️ 午餐</option>
          <option value="dinner">🌙 晚餐</option>
          <option value="snack">🍪 加餐</option>
        </select>
      </div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="eatTimeMode" value="default" checked /> 默认时间
        </label>
        <span id="eatDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${defaultTimeStr}</span>
      </div>
      <div class="edit-input-row" id="eatCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="eatCustomTime" value="${defaultTimeStr}" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="eatTimeMode" value="custom" /> 自定义时间
        </label>
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAddContent" placeholder="吃了什么？" />
      </div>
      <button class="edit-save-btn" id="eatAddBtn" style="background: var(--eat);">+ 添加记录</button>
    `;
    
    // 切换时间模式
    document.querySelectorAll('input[name="eatTimeMode"]').forEach(r => {
      r.addEventListener("change", () => {
        const isCustom = r.value === "custom";
        document.getElementById("eatDefaultTimeRow").style.display = isCustom ? "none" : "flex";
        document.getElementById("eatCustomTimeRow").style.display = isCustom ? "flex" : "none";
      });
    });
    
    // 更新默认时间显示
    setInterval(() => {
      if (!document.querySelector('input[name="eatTimeMode"]:checked')) return;
      if (document.querySelector('input[name="eatTimeMode"]:checked').value === "default") {
        const now2 = new Date();
        document.getElementById("eatDefaultTimeDisplay").textContent =
          `${String(now2.getHours()).padStart(2,"0")}:${String(now2.getMinutes()).padStart(2,"0")}`;
      }
    }, 30000);
    
    document.getElementById("eatAddBtn").addEventListener("click", () => {
      const type = document.getElementById("eatAddType").value;
      const content = document.getElementById("eatAddContent").value.trim();
      if (!content) { showToast("请输入饮食内容"); return; }
      
      // 获取时间
      let recordTime;
      const timeMode = document.querySelector('input[name="eatTimeMode"]:checked')?.value;
      if (timeMode === "custom") {
        const customVal = document.getElementById("eatCustomTime").value;
        if (customVal) {
          const [h, m] = customVal.split(":");
          recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
        } else {
          recordTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
      } else {
        recordTime = isToday ? new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "补打卡";
      }
      
      chrome.storage.local.get(["mealRecords"], (data) => {
        const records = data.mealRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        records[dateStr].push({ content, time: recordTime, type, timestamp: Date.now(), isBackfill: !isToday });
        chrome.storage.local.set({ mealRecords: records }, () => {
          showToast(isToday ? "🍽️ 饮食已记录" : "🍽️ 补打卡成功");
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
    if (!timeStr || timeStr === "补打卡") return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTime(rec.time);
    return `
    <div class="edit-record-item" data-index="${idx}">
      <div class="edit-record-header">
        <span class="edit-record-time">${typeLabel[rec.type] || ""} ${rec.time}</span>
        <div class="edit-record-actions">
          <button class="edit-btn-edit" data-action="edit-eat" data-index="${idx}">编辑</button>
          <button class="edit-btn-delete" data-action="delete-eat" data-index="${idx}">删除</button>
        </div>
      </div>
      <div class="edit-record-content" id="eatContent${idx}">${rec.content}</div>
      <div class="edit-input-row" id="eatEditForm${idx}" style="display:none;">
        <select class="edit-type-select" id="eatEditType${idx}">
          <option value="breakfast" ${rec.type === 'breakfast' ? 'selected' : ''}>🌅 早餐</option>
          <option value="lunch" ${rec.type === 'lunch' ? 'selected' : ''}>☀️ 午餐</option>
          <option value="dinner" ${rec.type === 'dinner' ? 'selected' : ''}>🌙 晚餐</option>
          <option value="snack" ${rec.type === 'snack' ? 'selected' : ''}>🍪 加餐</option>
        </select>
      </div>
      <div class="edit-input-row" id="eatEditFormTime${idx}" style="display:none;align-items:center;">
        <input type="time" class="edit-input" id="eatEditTime${idx}" value="${parsedTime}" placeholder="HH:mm" style="width:auto;flex:none;" />
        <span style="font-size:11px;color:#999;white-space:nowrap;margin-left:12px;">修改记录时间</span>
      </div>
      <div class="edit-input-row" id="eatEditFormContent${idx}" style="display:none;">
        <input class="edit-input" type="text" id="eatEditContent${idx}" value="${rec.content}" />
        <button class="edit-save-btn" data-action="save-eat" data-index="${idx}">保存修改</button>
      </div>
    </div>
  `;
  }).join("") + `
    <!-- 追加新记录区域 -->
    <div class="edit-add-new-section" style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(245,158,11,0.25);">
      <div style="font-size:12px;font-weight:600;color:var(--eat);margin-bottom:8px;display:flex;align-items:center;gap:4px;">
        ➕ 追加记录
      </div>
      <div class="edit-input-row">
        <select class="edit-type-select" id="eatAppendType">
          <option value="breakfast">🌅 早餐</option>
          <option value="lunch">☀️ 午餐</option>
          <option value="dinner">🌙 晚餐</option>
          <option value="snack">🍪 加餐</option>
        </select>
      </div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="eatAppendTimeMode" value="default" checked /> 默认时间
        </label>
        <span id="eatAppendDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${new Date().getHours().toString().padStart(2,"0")}:${new Date().getMinutes().toString().padStart(2,"0")}</span>
      </div>
      <div class="edit-input-row" id="eatAppendCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="eatAppendCustomTime" value="" placeholder="HH:mm" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="eatAppendTimeMode" value="custom" /> 自定义时间
        </label>
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="eatAppendContent" placeholder="吃了什么？" />
      </div>
      <button class="edit-save-btn" id="eatAppendBtn" style="background:var(--eat);">+ 添加此记录</button>
    </div>
  `;

  // 追加时间模式切换
  document.querySelectorAll('input[name="eatAppendTimeMode"]').forEach(r => {
    r.addEventListener("change", () => {
      document.getElementById("eatAppendCustomTimeRow").style.display = r.value === "custom" ? "flex" : "none";
    });
  });

  // 追加按钮事件
  document.getElementById("eatAppendBtn").addEventListener("click", () => {
    const type = document.getElementById("eatAppendType").value;
    const content = document.getElementById("eatAppendContent").value.trim();
    if (!content) { showToast("请输入饮食内容"); return; }

    let recordTime;
    const timeMode = document.querySelector('input[name="eatAppendTimeMode"]:checked')?.value;
    if (timeMode === "custom") {
      const customVal = document.getElementById("eatAppendCustomTime").value;
      if (customVal) {
        const [h, m] = customVal.split(":");
        recordTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
      } else {
        recordTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      }
    } else {
      recordTime = isToday ? new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "补打卡";
    }

    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      if (!records[dateStr]) records[dateStr] = [];
      records[dateStr].push({ content, time: recordTime, type, timestamp: Date.now(), isBackfill: !isToday });
      chrome.storage.local.set({ mealRecords: records }, () => {
        showToast(isToday ? "🍽️ 饮食已记录" : "🍽️ 补打卡成功");
        renderEatCalendar();
        updateMealRecords();
        chrome.storage.local.get(["mealRecords"], (d) => {
          showEatEditModal(dateStr, d.mealRecords[dateStr] || []);
        });
      });
    });
  });
}

function openEatEditForm(idx) {
  document.getElementById("eatEditForm" + idx).style.display = "block";
  document.getElementById("eatContent" + idx).style.display = "none";
}

function saveEatRecord(idx) {
  const newType = document.getElementById("eatEditType" + idx).value;
  const newContent = document.getElementById("eatEditContent" + idx).value.trim();
  
  if (!newContent) {
    showToast("内容不能为空");
    return;
  }
  
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    if (records[currentEditDate] && records[currentEditDate][idx]) {
      records[currentEditDate][idx].type = newType;
      records[currentEditDate][idx].content = newContent;
      chrome.storage.local.set({ mealRecords: records }, () => {
        showToast("修改成功");
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

function deleteEatRecord(idx) {
  if (!confirm("确定要删除这条记录吗？")) return;
  
  chrome.storage.local.get(["mealRecords"], (data) => {
    const records = data.mealRecords || {};
    if (records[currentEditDate]) {
      records[currentEditDate].splice(idx, 1);
      if (records[currentEditDate].length === 0) {
        delete records[currentEditDate];
        hideEditModal();
      }
      chrome.storage.local.set({ mealRecords: records }, () => {
        showToast("已删除");
        renderEatCalendar();
        updateMealRecords();
        if (records[currentEditDate]) {
          showEatEditModal(currentEditDate, records[currentEditDate]);
        }
      });
    }
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
      countEl.textContent = `🍽️ ${dayRecords.length}次`;
      countEl.classList.remove("pee-count");
      countEl.classList.add("eat-count");
      
      // 恢复tooltip主题色
      const headerEl = document.querySelector(".tooltip-header");
      if (headerEl) headerEl.style.borderBottomColor = "rgba(245,158,11,0.2)";
      
      if (dayRecords.length > 0) {
        const typeLabel = { breakfast: "🌅 早餐", lunch: "☀️ 午餐", dinner: "🌙 晚餐", snack: "🍪 加餐" };
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => `
          <div class="tooltip-record">
            <div class="tooltip-record-time">${typeLabel[rec.type] || ""} ${rec.time}</div>
            <div class="tooltip-record-remark">${rec.content}</div>
          </div>
        `).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">暂无饮食记录</div>';
      }
      
      positionTooltip(e);
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

function initEatPage() {
  renderEatCalendar();
  updateMealRecords();
}

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
  if (mins % 60 === 0) return `每 ${mins / 60} 小时提醒一次`;
  else if (mins >= 1) return `每 ${mins} 分钟提醒一次`;
  else return `每 ${Math.round(mins * 60)} 秒提醒一次`;
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
  timerStatus.textContent = running ? "运行中" : "未开启";
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
    hintEl.textContent = "提醒未开启";
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
  notifStatus.textContent = enabled ? "已开启" : "未开启";
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
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    const today = getToday();
    const todayCount = records[today] ? records[today].length : 0;
    
    let weekCount = 0;
    const range = getWeekRange();
    const cur = new Date(range.start);
    while (cur <= range.end) {
      const dateStr = formatDate(cur);
      weekCount += (records[dateStr] || []).length;
      cur.setDate(cur.getDate() + 1);
    }
    
    document.getElementById("drinkTodayCount").textContent = todayCount;
    document.getElementById("drinkWeekCount").textContent = weekCount;
  });
}

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
  drinkCalendarTitle.textContent = `${drinkCalYear}年${drinkCalMonth + 1}月`;
  
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
    countEl.textContent = `💧 ${dayRecords.length}次`;
    countEl.className = "tooltip-poop-count drink-count";
    
    // 切换tooltip主题色为蓝色
    const headerEl = document.querySelector(".tooltip-header");
    if (headerEl) {
      headerEl.style.borderBottomColor = "rgba(11,107,255,0.2)";
    }
    
    if (dayRecords.length > 0) {
      document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => `
        <div class="tooltip-record">
          <div class="tooltip-record-time">第${i + 1}杯 · ${rec.time}</div>
        </div>
      `).join("");
    } else {
      document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">当天无喝水记录</div>';
    }
    
    positionTooltip(e);
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
    showToast("提醒已开启 ✓");
  } else {
    chrome.runtime.sendMessage({ type: "CANCEL_ALARM" });
    chrome.storage.local.set({ timerRunning: false });
    applyRunningUI(false);
    showToast("提醒已关闭");
  }
});

notifToggle.addEventListener("change", async () => {
  if (notifToggle.checked) {
    // Chrome Extension 不需要请求权限，直接开启
    if (!chrome.notifications) {
      showToast("通知 API 不可用");
      applyNotifUI(false);
      return;
    }
    // 验证通知功能可用
    chrome.notifications.create("perm-test-" + Date.now(), {
      type: "basic",
      iconUrl: "icon128.png",
      title: "喝水提醒",
      message: "通知已启用 ✓"
    }, () => {
      if (chrome.runtime.lastError) {
        applyNotifUI(false);
        showToast("通知不可用: " + chrome.runtime.lastError.message);
      } else {
        chrome.storage.local.set({ notifEnabled: true });
        applyNotifUI(true);
        showToast("通知已开启 ✓");
      }
    });
  } else {
    chrome.storage.local.set({ notifEnabled: false });
    applyNotifUI(false);
    showToast("通知已关闭");
  }
});

drinkBtn.addEventListener("click", () => {
  const startTime = Date.now();
  const today = getToday();
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  
  chrome.storage.local.get(["drinkRecords"], (data) => {
    const records = data.drinkRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, timestamp: Date.now() });
    chrome.storage.local.set({ drinkRecords: records }, () => {
      updateDrinkStats();
    });
  });
  
  chrome.storage.local.set({ alarmStartTime: startTime }, () => {
    chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
      hintEl.textContent = getIntervalText(intervalMinutes);
      render(intervalMinutes * 60);
      startDisplayTicker(startTime);
    });
  });
  showToast("喝水记录 ✓ 倒计时已重置");
});

resetBtn.addEventListener("click", () => {
  const startTime = Date.now();
  chrome.storage.local.set({ alarmStartTime: startTime }, () => {
    chrome.runtime.sendMessage({ type: "SET_ALARM", minutes: intervalMinutes }, () => {
      render(intervalMinutes * 60);
      startDisplayTicker(startTime);
    });
  });
  showToast("倒计时已重置");
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
    showToast("间隔已更新");
  }
});

customApplyBtn.addEventListener("click", () => {
  const m = minutesFromCustomInput();
  if (!m) {
    showToast("请输入有效的时间");
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
  showToast("自定义间隔已应用");
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
const poopUndoBtn = document.getElementById("poopUndoBtn");
const poopTodayCount = document.getElementById("poopTodayCount");
const poopWeekBtn = document.getElementById("poopWeekBtn");
const poopMonthBtn = document.getElementById("poopMonthBtn");
const poopStatsCount = document.getElementById("poopStatsCount");
const poopStatsLabel = document.getElementById("poopStatsLabel");

let poopIsExpanded = true;

function renderPoopCalendar() {
  const firstDay = new Date(poopYear, poopMonth, 1);
  const lastDay = new Date(poopYear, poopMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  poopCalendarTitle.textContent = `${poopYear}年${poopMonth + 1}月`;
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
      if (records[dateStr]) cell.classList.add("has-poop");
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
  showEditModal("💩 " + formatDateDisplay(dateStr) + " 排便", dateStr, "poop");
  
  // 如果没有记录，显示添加表单（补打卡）
  if (!dayRecords || dayRecords.length === 0) {
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">暂无排便记录</div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="poopTimeMode" value="default" checked /> 默认时间
        </label>
        <span id="poopDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${defaultTimeStr}</span>
      </div>
      <div class="edit-input-row" id="poopCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="poopCustomTime" value="${defaultTimeStr}" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="poopTimeMode" value="custom" /> 自定义时间
        </label>
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="poopAddRemark" placeholder="添加备注（可选）" />
      </div>
      <button class="edit-save-btn" id="poopAddBtn" style="background: var(--secondary);">+ 补打卡</button>
    `;
    
    // 切换时间模式
    document.querySelectorAll('input[name="poopTimeMode"]').forEach(r => {
      r.addEventListener("change", () => {
        const isCustom = r.value === "custom";
        document.getElementById("poopCustomTimeRow").style.display = isCustom ? "flex" : "none";
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
          recordTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
      } else {
        recordTime = isToday ? new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "补打卡";
      }
      
      chrome.storage.local.get(["poopRecords"], (data) => {
        const records = data.poopRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        records[dateStr].push({ time: recordTime, remark, timestamp: Date.now(), isBackfill: !isToday });
        chrome.storage.local.set({ poopRecords: records }, () => {
          showToast(isToday ? "💩 打卡成功" : "💩 补打卡成功");
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
    if (!timeStr || timeStr === "补打卡") return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTimePoop(rec.time);
    return `
    <div class="edit-record-item" data-index="${idx}">
      <div class="edit-record-header">
        <span class="edit-record-time">第${idx + 1}次 ${rec.time}</span>
        <div class="edit-record-actions">
          <button class="edit-btn-edit" data-action="edit-poop" data-index="${idx}">编辑</button>
          <button class="edit-btn-delete" data-action="delete-poop" data-index="${idx}">删除</button>
        </div>
      </div>
      <div class="edit-record-content" id="poopContent${idx}">${rec.remark || "无备注"}</div>
      <div class="edit-input-row" id="poopEditFormTime${idx}" style="display:none;align-items:center;">
        <input type="time" class="edit-input" id="poopEditTime${idx}" value="${parsedTime}" placeholder="HH:mm" style="width:auto;flex:none;" />
        <span style="font-size:11px;color:#999;white-space:nowrap;margin-left:12px;">修改记录时间</span>
      </div>
      <div class="edit-input-row" id="poopEditForm${idx}" style="display:none;">
        <input class="edit-input" type="text" id="poopEditContent${idx}" value="${rec.remark || ""}" placeholder="修改备注（可选）" />
        <button class="edit-save-btn" data-action="save-poop" data-index="${idx}">保存修改</button>
      </div>
    </div>
  `;
  }).join("");
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
      chrome.storage.local.set({ poopRecords: records }, () => {
        showToast("修改成功");
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

function deletePoopRecord(idx) {
  if (!confirm("确定要删除这条记录吗？")) return;
  
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    if (records[currentEditDate]) {
      records[currentEditDate].splice(idx, 1);
      if (records[currentEditDate].length === 0) {
        delete records[currentEditDate];
        hideEditModal();
      }
      chrome.storage.local.set({ poopRecords: records }, () => {
        showToast("已删除");
        renderPoopCalendar();
        updatePoopTodayStatus();
        updatePoopStats();
        if (records[currentEditDate]) {
          showPoopEditModal(currentEditDate, records[currentEditDate]);
        }
      });
    }
  });
}

function showPoopTooltip(e, dateStr) {
  clearTimeout(poopTooltipTimeout);
  poopTooltipTimeout = setTimeout(() => {
    chrome.storage.local.get(["poopRecords"], (data) => {
      const records = data.poopRecords || {};
      const dayRecords = records[dateStr] || [];
      document.getElementById("tooltipDate").textContent = formatDateDisplay(dateStr);
      const countEl = document.getElementById("tooltipCount");
      countEl.textContent = `💩 ${dayRecords.length}次`;
      countEl.classList.remove("pee-count");
      
      if (dayRecords.length > 0) {
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => `
          <div class="tooltip-record">
            <div class="tooltip-record-time">第${i + 1}次 ${rec.time}</div>
            ${rec.remark ? `<div class="tooltip-record-remark">${rec.remark}</div>` : ""}
          </div>
        `).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">暂无打卡记录</div>';
      }
      
      positionTooltip(e);
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

// === tooltip 自身 hover 保持显示 ===
let tooltipHideTimeout = null;
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
  if (e.target === poopToggleBtn || e.target.closest(".btn-undo")) return;
  poopIsExpanded = !poopIsExpanded;
  poopToggleBtn.classList.toggle("collapsed", !poopIsExpanded);
  poopRecordsList.classList.toggle("collapsed", !poopIsExpanded);
});

poopUndoBtn.addEventListener("click", () => {
  const today = getToday();
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    if (!records[today] || records[today].length === 0) {
      showToast("今日暂无打卡记录");
      return;
    }
    records[today].pop();
    if (records[today].length === 0) delete records[today];
    chrome.storage.local.set({ poopRecords: records }, () => {
      renderPoopCalendar();
      updatePoopTodayStatus();
      updatePoopStats();
      showToast("已撤销最近一次打卡");
    });
  });
});

poopCheckinBtn.addEventListener("click", () => {
  const today = getToday();
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const remark = poopRemarkInput.value.trim();
  
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, remark, timestamp: Date.now() });
    chrome.storage.local.set({ poopRecords: records }, () => {
      poopRemarkInput.value = "";
      renderPoopCalendar();
      updatePoopTodayStatus();
      updatePoopStats();
      showToast("💩 打卡成功！");
    });
  });
});

function updatePoopTodayStatus() {
  const today = getToday();
  chrome.storage.local.get(["poopRecords"], (data) => {
    const records = data.poopRecords || {};
    const todayRecord = records[today];
    if (todayRecord && todayRecord.length > 0) {
      poopTodaySection.style.display = "block";
      poopTodayCount.textContent = todayRecord.length;
      poopRecordsList.innerHTML = todayRecord.map(rec => `
        <div class="record-item">
          <span class="record-time">${rec.time}</span>
          <span class="record-remark">${rec.remark || "无备注"}</span>
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
    if (poopStatsMode === "week") {
      const range = getWeekRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        count += (records[dateStr] || []).length;
        cur.setDate(cur.getDate() + 1);
      }
      poopStatsLabel.textContent = "本周累计";
    } else {
      const range = getMonthRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        count += (records[dateStr] || []).length;
        cur.setDate(cur.getDate() + 1);
      }
      poopStatsLabel.textContent = "本月累计";
    }
    poopStatsCount.textContent = count;
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
const peeUndoBtn = document.getElementById("peeUndoBtn");
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
  peeCalendarTitle.textContent = `${peeYear}年${peeMonth + 1}月`;
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
  showEditModal("💧 " + formatDateDisplay(dateStr) + " 排尿", dateStr, "pee");
  
  // 如果没有记录，显示添加表单（补打卡）
  if (!dayRecords || dayRecords.length === 0) {
    const now = new Date();
    const defaultTimeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    editModalBody.innerHTML = `
      <div class="edit-empty" style="margin-bottom: 12px;">暂无排尿记录</div>
      <div class="edit-input-row" style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
          <input type="radio" name="peeTimeMode" value="default" checked /> 默认时间
        </label>
        <span id="peeDefaultTimeDisplay" style="font-size:12px;color:#999;font-weight:500;">${defaultTimeStr}</span>
      </div>
      <div class="edit-input-row" id="peeCustomTimeRow" style="display:none;">
        <input type="time" class="edit-input" id="peeCustomTime" value="${defaultTimeStr}" />
      </div>
      <div class="edit-input-row">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="peeTimeMode" value="custom" /> 自定义时间
        </label>
      </div>
      <div class="edit-input-row">
        <input class="edit-input" type="text" id="peeAddRemark" placeholder="添加备注（可选）" />
      </div>
      <button class="edit-save-btn" id="peeAddBtn" style="background: var(--pee);">+ 补打卡</button>
    `;
    
    // 切换时间模式
    document.querySelectorAll('input[name="peeTimeMode"]').forEach(r => {
      r.addEventListener("change", () => {
        document.getElementById("peeCustomTimeRow").style.display = r.value === "custom" ? "flex" : "none";
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
          recordTime = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
      } else {
        recordTime = isToday ? new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "补打卡";
      }
      
      chrome.storage.local.get(["peeRecords"], (data) => {
        const records = data.peeRecords || {};
        if (!records[dateStr]) records[dateStr] = [];
        records[dateStr].push({ time: recordTime, remark, timestamp: Date.now(), isBackfill: !isToday });
        chrome.storage.local.set({ peeRecords: records }, () => {
          showToast(isToday ? "💧 打卡成功" : "💧 补打卡成功");
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
    if (!timeStr || timeStr === "补打卡") return "";
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2,"0")}:${match[2]}`;
    return "";
  }

  editModalBody.innerHTML = dayRecords.map((rec, idx) => {
    const parsedTime = parseRecordTimePee(rec.time);
    return `
    <div class="edit-record-item" data-index="${idx}">
      <div class="edit-record-header">
        <span class="edit-record-time">第${idx + 1}次 ${rec.time}</span>
        <div class="edit-record-actions">
          <button class="edit-btn-edit" data-action="edit-pee" data-index="${idx}">编辑</button>
          <button class="edit-btn-delete" data-action="delete-pee" data-index="${idx}">删除</button>
        </div>
      </div>
      <div class="edit-record-content" id="peeContent${idx}">${rec.remark || "无备注"}</div>
      <div class="edit-input-row" id="peeEditFormTime${idx}" style="display:none;align-items:center;">
        <input type="time" class="edit-input" id="peeEditTime${idx}" value="${parsedTime}" placeholder="HH:mm" style="width:auto;flex:none;" />
        <span style="font-size:11px;color:#999;white-space:nowrap;margin-left:12px;">修改记录时间</span>
      </div>
      <div class="edit-input-row" id="peeEditForm${idx}" style="display:none;">
        <input class="edit-input" type="text" id="peeEditContent${idx}" value="${rec.remark || ""}" placeholder="修改备注（可选）" />
        <button class="edit-save-btn" data-action="save-pee" data-index="${idx}">保存修改</button>
      </div>
    </div>
  `;
  }).join("");
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
      chrome.storage.local.set({ peeRecords: records }, () => {
        showToast("修改成功");
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

function deletePeeRecord(idx) {
  if (!confirm("确定要删除这条记录吗？")) return;
  
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    if (records[currentEditDate]) {
      records[currentEditDate].splice(idx, 1);
      if (records[currentEditDate].length === 0) {
        delete records[currentEditDate];
        hideEditModal();
      }
      chrome.storage.local.set({ peeRecords: records }, () => {
        showToast("已删除");
        renderPeeCalendar();
        updatePeeTodayStatus();
        updatePeeStats();
        if (records[currentEditDate]) {
          showPeeEditModal(currentEditDate, records[currentEditDate]);
        }
      });
    }
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
      countEl.textContent = `💧 ${dayRecords.length}次`;
      countEl.classList.add("pee-count");
      
      if (dayRecords.length > 0) {
        document.getElementById("tooltipRecords").innerHTML = dayRecords.map((rec, i) => `
          <div class="tooltip-record">
            <div class="tooltip-record-time">第${i + 1}次 ${rec.time}</div>
            ${rec.remark ? `<div class="tooltip-record-remark">${rec.remark}</div>` : ""}
          </div>
        `).join("");
      } else {
        document.getElementById("tooltipRecords").innerHTML = '<div class="tooltip-empty">暂无打卡记录</div>';
      }
      
      positionTooltip(e);
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

peeToggleBtn.addEventListener("click", () => {
  peeIsExpanded = !peeIsExpanded;
  peeToggleBtn.classList.toggle("collapsed", !peeIsExpanded);
  peeRecordsList.classList.toggle("collapsed", !peeIsExpanded);
});

peeRecordsHeader.addEventListener("click", (e) => {
  if (e.target === peeToggleBtn || e.target.closest(".btn-undo")) return;
  peeIsExpanded = !peeIsExpanded;
  peeToggleBtn.classList.toggle("collapsed", !peeIsExpanded);
  peeRecordsList.classList.toggle("collapsed", !peeIsExpanded);
});

peeUndoBtn.addEventListener("click", () => {
  const today = getToday();
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    if (!records[today] || records[today].length === 0) {
      showToast("今日暂无打卡记录");
      return;
    }
    records[today].pop();
    if (records[today].length === 0) delete records[today];
    chrome.storage.local.set({ peeRecords: records }, () => {
      renderPeeCalendar();
      updatePeeTodayStatus();
      updatePeeStats();
      showToast("已撤销最近一次打卡");
    });
  });
});

peeCheckinBtn.addEventListener("click", () => {
  const today = getToday();
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const remark = peeRemarkInput.value.trim();
  
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, remark, timestamp: Date.now() });
    chrome.storage.local.set({ peeRecords: records }, () => {
      peeRemarkInput.value = "";
      renderPeeCalendar();
      updatePeeTodayStatus();
      updatePeeStats();
      showToast("💧 打卡成功！");
    });
  });
});

function updatePeeTodayStatus() {
  const today = getToday();
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    const todayRecord = records[today];
    if (todayRecord && todayRecord.length > 0) {
      peeTodaySection.style.display = "block";
      peeTodayCount.textContent = todayRecord.length;
      peeRecordsList.innerHTML = todayRecord.map(rec => `
        <div class="record-item">
          <span class="record-time pee-time">${rec.time}</span>
          <span class="record-remark">${rec.remark || "无备注"}</span>
        </div>
      `).join("");
    } else {
      peeTodaySection.style.display = "none";
    }
  });
}

function updatePeeStats() {
  chrome.storage.local.get(["peeRecords"], (data) => {
    const records = data.peeRecords || {};
    let count = 0;
    if (peeStatsMode === "week") {
      const range = getWeekRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        count += (records[dateStr] || []).length;
        cur.setDate(cur.getDate() + 1);
      }
      peeStatsLabel.textContent = "本周累计";
    } else {
      const range = getMonthRange();
      const cur = new Date(range.start);
      const end = new Date(range.end);
      while (cur <= end) {
        const dateStr = formatDate(cur);
        count += (records[dateStr] || []).length;
        cur.setDate(cur.getDate() + 1);
      }
      peeStatsLabel.textContent = "本月累计";
    }
    peeStatsCount.textContent = count;
  });
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
    document.getElementById("eatEditForm" + idx).style.display = "block";
    document.getElementById("eatEditFormTime" + idx).style.display = "flex";
    document.getElementById("eatEditFormContent" + idx).style.display = "block";
    document.getElementById("eatContent" + idx).style.display = "none";
  } else if (action === "save-eat") {
    const newType = document.getElementById("eatEditType" + idx).value;
    const newContent = document.getElementById("eatEditContent" + idx).value.trim();
    if (!newContent) { showToast("内容不能为空"); return; }
    // 获取编辑后的时间
    let newTime = null;
    const editTimeEl = document.getElementById("eatEditTime" + idx);
    if (editTimeEl && editTimeEl.value) {
      const [h, m] = editTimeEl.value.split(":");
      newTime = `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
    }
    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      if (records[currentEditDate] && records[currentEditDate][idx]) {
        records[currentEditDate][idx].type = newType;
        records[currentEditDate][idx].content = newContent;
        if (newTime) records[currentEditDate][idx].time = newTime;
        chrome.storage.local.set({ mealRecords: records }, () => {
          showToast("修改成功");
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
    if (!confirm("确定要删除这条记录吗？")) return;
    chrome.storage.local.get(["mealRecords"], (data) => {
      const records = data.mealRecords || {};
      if (records[currentEditDate]) {
        records[currentEditDate].splice(idx, 1);
        if (records[currentEditDate].length === 0) { delete records[currentEditDate]; hideEditModal(); }
        chrome.storage.local.set({ mealRecords: records }, () => {
          showToast("已删除");
          renderEatCalendar();
          updateMealRecords();
          if (records[currentEditDate]) { showEatEditModal(currentEditDate, records[currentEditDate]); }
        });
      }
    });
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
        chrome.storage.local.set({ poopRecords: records }, () => {
          showToast("修改成功");
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
    if (!confirm("确定要删除这条记录吗？")) return;
    chrome.storage.local.get(["poopRecords"], (data) => {
      const records = data.poopRecords || {};
      if (records[currentEditDate]) {
        records[currentEditDate].splice(idx, 1);
        if (records[currentEditDate].length === 0) { delete records[currentEditDate]; hideEditModal(); }
        chrome.storage.local.set({ poopRecords: records }, () => {
          showToast("已删除");
          renderPoopCalendar();
          updatePoopTodayStatus();
          updatePoopStats();
          if (records[currentEditDate]) { showPoopEditModal(currentEditDate, records[currentEditDate]); }
        });
      }
    });
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
        chrome.storage.local.set({ peeRecords: records }, () => {
          showToast("修改成功");
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
    if (!confirm("确定要删除这条记录吗？")) return;
    chrome.storage.local.get(["peeRecords"], (data) => {
      const records = data.peeRecords || {};
      if (records[currentEditDate]) {
        records[currentEditDate].splice(idx, 1);
        if (records[currentEditDate].length === 0) { delete records[currentEditDate]; hideEditModal(); }
        chrome.storage.local.set({ peeRecords: records }, () => {
          showToast("已删除");
          renderPeeCalendar();
          updatePeeTodayStatus();
          updatePeeStats();
          if (records[currentEditDate]) { showPeeEditModal(currentEditDate, records[currentEditDate]); }
        });
      }
    });
  }
});

// ==================== 监听来自后台脚本的消息 ====================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DRINK_RECORDED") {
    updateDrinkStats();
  }
});

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
  if (document.getElementById(moduleMap[currentTab].page)?.classList.contains("hidden-module")) {
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
      showToast(document.getElementById(moduleMap[key].switch).checked ? `${{eat:"饮食",drink:"喝水",poop:"排便",pee:"排尿"}[key]}已显示` : `${{eat:"饮食",drink:"喝水",poop:"排便",pee:"排尿"}[key]}已隐藏`);
    });
  });
});

// ==================== 初始化 ====================
document.getElementById("navEat").addEventListener("click", () => switchTab("eat"));
document.getElementById("navDrink").addEventListener("click", () => switchTab("drink"));
document.getElementById("navPoop").addEventListener("click", () => switchTab("poop"));
document.getElementById("navPee").addEventListener("click", () => switchTab("pee"));

switchTab("drink"); // 默认显示喝水提醒页面

initDrinkTimer();
updateDrinkStats();
loadModuleStates();
