const DEFAULT_MINUTES = 30;

// ==================== 角标：显示今日喝水次数（后台原生角标）====================
// 角标色直接从共享的 THEME_PRESETS 自动派生（消除手动双表，新增主题自动同步）
import { THEME_PRESETS } from './themes.js';
const THEME_BADGE_COLOR = Object.fromEntries(
  Object.entries(THEME_PRESETS).map(([k, p]) => [k, (p.vars && p.vars["--primary"]) || '#0b6bff'])
);

function updateBadge() {
  chrome.storage.local.get(
    ['drinkRecords', 'poopRecords', 'peeRecords', 'mealRecords', 'selectedTheme', 'badgeEnabled', 'badgeContentType'],
    (data) => {
      if (chrome.runtime.lastError) {
        logError('读取角标配置失败', { error: chrome.runtime.lastError.message });
        return;
      }
      const enabled = data.badgeEnabled !== false;
      if (!enabled) {
        chrome.action.setIcon({ path: { '16': 'icon16.png', '48': 'icon48.png', '128': 'icon128.png' } });
        chrome.action.setBadgeText({ text: '' });
        return;
      }
      const badgeType = data.badgeContentType || 'drink_today';
      const theme = data.selectedTheme || 'default';
      // 派生表已覆盖 themes.js 所有主题；themeColor 永不 undefined
      const themeColor = THEME_BADGE_COLOR[theme] || '#0b6bff';
      logInfo('[角标] updateBadge 计算结果', { theme, themeColor, badgeType });
      chrome.action.setIcon({ path: { '16': 'icon16.png', '48': 'icon48.png', '128': 'icon128.png' } });

      // 解析 badgeType: "drink_today" -> ["drink", "today"]
      const parts = badgeType.split('_');
      const recordType = parts[0];   // drink / poop / pee / meal
      const timeRange = parts[1];     // today / week / month

      // 选取对应记录
      let records = {};
      if (recordType === 'drink') records = data.drinkRecords || {};
      else if (recordType === 'poop') records = data.poopRecords || {};
      else if (recordType === 'pee') records = data.peeRecords || {};
      else if (recordType === 'meal') records = data.mealRecords || {};

      let count = 0;
      if (timeRange === 'today') {
        const today = getLocalDateStr();
        count = (records[today] || []).length;
      } else if (timeRange === 'week') {
        // 本周一 00:00 到今天
        const now = new Date();
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        const cur = new Date(monday);
        while (cur <= now) {
          const ds = formatDateStr(cur);
          count += (records[ds] || []).length;
          cur.setDate(cur.getDate() + 1);
        }
      } else if (timeRange === 'month') {
        // 本月1日 到今天
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const cur = new Date(first);
        while (cur <= now) {
          const ds = formatDateStr(cur);
          count += (records[ds] || []).length;
          cur.setDate(cur.getDate() + 1);
        }
      }

      const txt = count > 99 ? '99+' : String(count);
      chrome.action.setBadgeText({ text: txt });
      chrome.action.setBadgeBackgroundColor({ color: themeColor });
      if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ color: '#ffffff' });
      }
    }
  );
}

// 辅助：Date -> "YYYY-MM-DD"
function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ==================== 后台 i18n ====================
const BG_I18N = {
  zh: {
    notifTitle: "喝水提醒 💧",
    notifBody: "该喝水啦！记得保持水分，状态更好。",
    notifDrank: "我喝了 ✓",
    notifSkip: "没喝",
    testNotifTitle: "测试通知 🔔",
    testNotifBody: "这是一条测试通知，用于验证功能是否正常。",
    reminderNotifBody: "该{label}啦！",
    reminderButton: "知道了",
  },
  en: {
    notifTitle: "Drink Reminder 💧",
    notifBody: "Time to drink water! Stay hydrated for better health.",
    notifDrank: "I drank ✓",
    notifSkip: "Skip",
    testNotifTitle: "Test Notification 🔔",
    testNotifBody: "This is a test notification to verify everything works.",
    reminderNotifBody: "Time to {label}!",
    reminderButton: "Got it",
  }
};

function bgT(key) {
  const lang = (typeof currentBgLang !== 'undefined') ? currentBgLang : 'zh';
  return (BG_I18N[lang] && BG_I18N[lang][key]) || key;
}

function bgTpl(key, vars) {
  let s = bgT(key);
  if (vars) {
    for (const k in vars) {
      s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
    }
  }
  return s;
}

let currentBgLang = "zh";
chrome.storage.local.get(["language"], (data) => {
  currentBgLang = data.language || "zh";
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.language) {
    currentBgLang = changes.language.newValue;
  }
});

// ==================== 日志工具 ====================
const LOG_PREFIX = "[喝水提醒] ";

function logInfo(msg, data = {}) {
  console.log(`${LOG_PREFIX}${msg}`, data);
}

function logError(msg, error = {}) {
  console.error(`${LOG_PREFIX}错误: ${msg}`, error);
}

logInfo("后台脚本已加载", {
  timestamp: new Date().toISOString(),
  version: chrome.runtime.getManifest().version,
  hasNotificationsAPI: !!chrome.notifications,
  hasAlarmsAPI: !!chrome.alarms,
});

// ==================== 生命周期事件 ====================
chrome.runtime.onStartup.addListener(() => {
  logInfo("浏览器启动");
  restoreAlarm();
  updateBadge();
});

chrome.runtime.onInstalled.addListener((details) => {
  logInfo(`扩展安装/更新: ${details.reason}`);
  updateBadge();
});

// 主题/角标配置变化时主动刷新角标色（修复主题与角标色不同步的问题）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.selectedTheme || changes.badgeEnabled || changes.badgeContentType) {
    const which = [];
    if (changes.selectedTheme) which.push(`selectedTheme=${changes.selectedTheme.newValue}`);
    if (changes.badgeEnabled) which.push(`badgeEnabled=${changes.badgeEnabled.newValue}`);
    if (changes.badgeContentType) which.push(`badgeContentType=${changes.badgeContentType.newValue}`);
    logInfo("[角标] 配置变更，刷新角标", { which: which.join(",") });
    updateBadge();
  }
});

// ==================== 核心问题修复：保持 Service Worker 活跃 ====================
// Chrome MV3 中，Service Worker 空闲 30 秒后会自动终止
// 我们需要定期唤醒它以确保 alarm 监听器正常工作
let keepAliveTimer;
function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  // 每 20 秒记录一次日志，防止 SW 被完全休眠
  keepAliveTimer = setInterval(() => {
    logInfo("[心跳] Service Worker 保持活跃");
  }, 20000);
}
startKeepAlive();

// 定期检查闹钟状态（调试用）
setInterval(() => {
  chrome.alarms.getAll((alarms) => {
    if (alarms.length === 0) {
      logInfo("[检查] 无活跃闹钟");
      // 尝试恢复闹钟
      restoreAlarm();
      return;
    }

    alarms.forEach(a => {
      const remaining = Math.max(0, (a.scheduledTime - Date.now()) / 1000);
      logInfo("[检查] 闹钟状态", { name: a.name, 剩余秒: remaining.toFixed(1), 周期分钟: a.periodInMinutes });
    });
  });
}, 30000);

// ==================== 恢复闹钟 ====================
function restoreAlarm() {
  chrome.storage.local.get(["timerRunning", "intervalMinutes"], (data) => {
    if (!data.timerRunning) return;
    
    const minutes = data.intervalMinutes || DEFAULT_MINUTES;
    chrome.alarms.get("drinkWater", (alarm) => {
      if (!alarm) {
        logInfo("恢复闹钟", { minutes });
        createAlarm(minutes);
      }
    });
  });
}

// ==================== 创建闹钟（统一入口）====================
function createAlarm(minutes) {
  // 重要：确保 minutes 是有效数字
  const mins = Math.max(Number(minutes) || DEFAULT_MINUTES, 0.001); // 至少约 0.06 秒
  
  chrome.alarms.clear("drinkWater", () => {
    chrome.alarms.create("drinkWater", {
      delayInMinutes: mins,
      periodInMinutes: mins,
    }, () => {
      if (chrome.runtime.lastError) {
        logError("创建闹钟失败", { error: chrome.runtime.lastError.message });
      } else {
        logInfo("闹钟已创建", { minutes: mins });
        
        // 验证闹钟是否真的创建了
        chrome.alarms.get("drinkWater", (alarm) => {
          if (alarm) {
            logInfo("闹钟验证成功", {
              name: alarm.name,
              scheduledTime: new Date(alarm.scheduledTime).toLocaleString(),
              periodInMinutes: alarm.periodInMinutes
            });
          } else {
            logError("闹钟验证失败：闹钟未找到！");
          }
        });
      }
    });
  });
}

// ==================== 发送通知 ====================
let activeNotificationIds = new Set(); // 追踪当前活跃的喝水通知ID

function sendDrinkReminder() {
  logInfo("准备发送喝水提醒...");

  chrome.storage.local.get(["notifEnabled"], (data) => {
    logInfo("通知开关状态:", { notifEnabled: data.notifEnabled });

    if (!data.notifEnabled) {
      logInfo("通知未开启，跳过");
      return;
    }

    if (!chrome.notifications) {
      logError("chrome.notifications API 不可用!");
      return;
    }

    const notificationId = "drinkReminder-" + Date.now();

    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "icon128.png",
      title: bgT("notifTitle"),
      message: bgT("notifBody"),
      priority: 2,
      requireInteraction: true, // 保持通知直到用户操作
      buttons: [
        { title: bgT("notifDrank") },
        { title: bgT("notifSkip") }
      ]
    }, (createdId) => {
      if (chrome.runtime.lastError) {
        logError("通知创建失败!", { error: chrome.runtime.lastError.message });
      } else {
        logInfo("通知创建成功!", { notificationId: createdId });
        activeNotificationIds.add(createdId || notificationId);
        // 启动 keep-alive，防止 SW 在通知期间终止
        startNotificationKeepAlive();
      }
    });
  });
}

// 通知 keep-alive：确保 SW 在通知未被处理前保持活跃
let notifKeepAliveAlarm = null;
function startNotificationKeepAlive() {
  chrome.alarms.create("notificationKeepAlive", { delayInMinutes: 0.4 });
}

// ==================== 消息处理 ====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  logInfo(`收到消息: ${msg.type}`);

  if (msg.type === "SET_ALARM") {
    const minutes = Number(msg.minutes) || DEFAULT_MINUTES;
    logInfo(`设置闹钟请求`, { minutes });
    
    createAlarm(minutes);
    
    chrome.storage.local.set({
      intervalMinutes: minutes,
      timerRunning: true,
    });
    
    sendResponse({ ok: true });
    return false; // 同步响应
  }

  if (msg.type === "CANCEL_ALARM") {
    logInfo("取消闹钟");
    chrome.alarms.clear("drinkWater");
    chrome.storage.local.set({ timerRunning: false });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "GET_STATE") {
    chrome.storage.local.get(["intervalMinutes", "notifEnabled"], sendResponse);
    return true;
  }

  if (msg.type === "TEST_NOTIFICATION") {
    logInfo("测试通知请求");
    
    if (!chrome.notifications) {
      sendResponse({ success: false, error: "API不可用" });
      return false;
    }
    
    chrome.notifications.create("test-" + Date.now(), {
      type: "basic",
      iconUrl: "icon128.png",
      title: bgT("testNotifTitle"),
      message: bgT("testNotifBody"),
      priority: 2,
    }, (id) => {
      sendResponse({
        success: !chrome.runtime.lastError,
        id,
        error: chrome.runtime.lastError?.message
      });
    });
    return true; // 异步响应
  }

  if (msg.type === "TRIGGER_TEST_ALARM") {
    logInfo("手动触发喝水提醒");
    sendDrinkReminder();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "GET_ALARM_STATUS") {
    chrome.alarms.getAll(sendResponse);
    return true;
  }

  if (msg.type === "REFRESH_REMINDERS") {
    loadBgReminders();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// ==================== 闹钟触发（核心）====================
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "notificationKeepAlive") {
    // 检查是否还有待处理的喝水通知
    if (activeNotificationIds.size > 0) {
      logInfo("[KeepAlive] 还有未处理的喝水通知，继续保持活跃", { count: activeNotificationIds.size });
      chrome.alarms.create("notificationKeepAlive", { delayInMinutes: 0.4 });
    } else {
      logInfo("[KeepAlive] 所有通知已处理，停止 keep-alive");
    }
    return;
  }

  if (alarm.name === "dailyBadgeReset") {
    logInfo("[角标] 跨日清零");
    updateBadge();
    return;
  }

  logInfo("========== 闹钟触发! ==========", {
    name: alarm.name,
    scheduledTime: new Date(alarm.scheduledTime).toLocaleString(),
    currentTime: new Date().toISOString()
  });

  if (alarm.name !== "drinkWater") {
    logInfo("非喝水闹钟，忽略");
    return;
  }

  // 发送喝水提醒通知
  sendDrinkReminder();

  logInfo("========== 闹钟处理完成 ==========");
});

// ==================== 通知事件 ====================
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  logInfo("通知按钮点击", { notificationId, buttonIndex });

  if (notificationId.startsWith("drinkReminder")) {
    activeNotificationIds.delete(notificationId);
    if (buttonIndex === 0) {
      // 我喝了 ✓ — 记录喝水数据
      recordDrink();
    } else if (buttonIndex === 1) {
      // 没喝 — 不记录，仅关闭通知
      logInfo("用户选择「没喝」，不记录");
    }
    chrome.notifications.clear(notificationId);
  }
});

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  logInfo("通知关闭", { notificationId, byUser });
  activeNotificationIds.delete(notificationId);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  logInfo("通知被点击", { notificationId });

  // Windows 兜底：如果按钮点击事件未触发，点击通知主体也记录喝水
  if (notificationId.startsWith("drinkReminder")) {
    activeNotificationIds.delete(notificationId);
    recordDrink();
    chrome.notifications.clear(notificationId);
  }

  // 打开 popup
  chrome.action.openPopup?.().catch(() => {});
});

// ==================== 记录喝水 ====================
function getLocalDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function recordDrink() {
  const today = getLocalDateStr();
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  chrome.storage.local.get(["drinkRecords"], (data) => {
    if (chrome.runtime.lastError) {
      logError("读取喝水记录失败", { error: chrome.runtime.lastError.message });
      return;
    }

    const records = data.drinkRecords || {};
    if (!records[today]) records[today] = [];
    records[today].push({ time, timestamp: Date.now() });

    // 保存主数据，并在回调中验证保存是否成功
    chrome.storage.local.set({ drinkRecords: records }, () => {
      if (chrome.runtime.lastError) {
        logError("保存喝水记录失败", { error: chrome.runtime.lastError.message });
        // 尝试再次保存
        setTimeout(() => {
          chrome.storage.local.set({ drinkRecords: records }, () => {
            if (chrome.runtime.lastError) {
              logError("重试保存喝水记录失败", { error: chrome.runtime.lastError.message });
            } else {
              logInfo("重试保存喝水记录成功", { today, time });
              // 保存成功后，同时保存一个备份
              saveDrinkBackup(records);
              updateBadge();
            }
          });
        }, 500);
      } else {
        logInfo("喝水已记录", { today, time, total: records[today].length });
        // 保存成功后，同时保存一个备份
        saveDrinkBackup(records);
        updateBadge();
      }
    });

    // 通知 popup 刷新统计数据（popup 可能未打开，忽略发送失败）
    chrome.runtime.sendMessage({ type: "DRINK_RECORDED" }).catch(() => {});
  });
}

// 保存喝水记录的备份（防止主数据丢失）
function saveDrinkBackup(records) {
  chrome.storage.local.set({ drinkRecordsBackup: records }, () => {
    if (chrome.runtime.lastError) {
      logError("保存喝水记录备份失败", { error: chrome.runtime.lastError.message });
    } else {
      logInfo("喝水记录备份已保存");
    }
  });
}

// ==================== 自定义提醒 ====================
let bgCustomReminders = [];

function loadBgReminders() {
  chrome.storage.local.get(["customReminders"], (data) => {
    bgCustomReminders = data.customReminders || [];
    logInfo("后台提醒已加载", { count: bgCustomReminders.length });
    scheduleReminderAlarms();
  });
}

// 监听提醒数据变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customReminders) {
    bgCustomReminders = changes.customReminders.newValue || [];
    logInfo("提醒数据已更新", { count: bgCustomReminders.length });
    scheduleReminderAlarms();
  }
});

// 计算某个时间（如 "08:30"）的下一次触发时间戳
function getNextReminderTimestamp(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  // 如果今天已过，则排到明天
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

// 为每个启用的提醒时间创建独立闹钟
function scheduleReminderAlarms() {
  // 先清除所有旧的提醒闹钟
  chrome.alarms.getAll((alarms) => {
    alarms.forEach(a => {
      if (a.name.startsWith("reminder_")) {
        chrome.alarms.clear(a.name);
      }
    });

    // 为每个提醒时间创建新闹钟
    bgCustomReminders.forEach(r => {
      if (!r.enabled || !r.times) return;
      r.times.forEach(timeStr => {
        const alarmName = `reminder_${r.id}_${timeStr}`;
        const when = getNextReminderTimestamp(timeStr);
        chrome.alarms.create(alarmName, { when });
        logInfo("[提醒闹钟已创建]", { name: alarmName, time: timeStr, at: new Date(when).toLocaleString() });
      });
    });
  });
}

// 发送提醒通知
function sendReminderNotification(r, timeStr) {
  const today = getLocalDateStr();

  // 检查今天是否已触发
  const last = r.lastTriggered || {};
  if (last[timeStr] === today) {
    logInfo("[提醒跳过-已触发]", { label: r.label, time: timeStr });
    // 仍然要重新调度明天的闹钟
    rescheduleReminder(r, timeStr);
    return;
  }

  logInfo("[提醒触发]", { label: r.label, time: timeStr });

  const notificationId = `reminder_${r.id}_${timeStr}_${Date.now()}`;
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icon128.png",
    title: `${r.icon || "⏰"} ${r.label}`,
    message: (bgT("reminderNotifBody") || "该{label}啦！").replace("{label}", r.label),
    priority: 2,
    requireInteraction: true,
    buttons: [
      { title: bgT("reminderButton") || "知道了" }
    ]
  }, () => {
    if (chrome.runtime.lastError) {
      logError("提醒通知创建失败", { error: chrome.runtime.lastError.message });
    } else {
      // 更新 lastTriggered
      if (!r.lastTriggered) r.lastTriggered = {};
      r.lastTriggered[timeStr] = today;
      // 清理旧数据（只保留今天和昨天）
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      Object.keys(r.lastTriggered).forEach(key => {
        if (key !== today && key !== yesterdayStr) {
          delete r.lastTriggered[key];
        }
      });
      // 更新 storage
      chrome.storage.local.get(["customReminders"], (data) => {
        const all = data.customReminders || [];
        const idx = all.findIndex(x => x.id === r.id);
        if (idx >= 0) {
          all[idx] = r;
          chrome.storage.local.set({ customReminders: all });
        }
      });
      logInfo("[提醒已记录]", { label: r.label, time: timeStr });
    }
    // 重新调度明天的闹钟
    rescheduleReminder(r, timeStr);
  });
}

// 重新调度明天的闹钟
function rescheduleReminder(r, timeStr) {
  const alarmName = `reminder_${r.id}_${timeStr}`;
  const when = getNextReminderTimestamp(timeStr);
  chrome.alarms.create(alarmName, { when });
  logInfo("[提醒闹钟已重新调度]", { name: alarmName, at: new Date(when).toLocaleString() });
}

// 监听闹钟触发
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("reminder_")) {
    // 解析 alarm name: reminder_{id}_{time}
    const parts = alarm.name.split("_");
    // parts[0]="reminder", parts[1]=id, parts[2]=time (may contain ":"), parts[3..]=可能有多余部分
    // id 可能是 "rem_1234567890"，time 是 "08:00"
    // 格式: reminder_rem_1234567890_08:00
    const idWithRem = alarm.name.substring("reminder_".length);
    // 找到最后一个 "_" 的位置，后面是 time
    const lastUnderscore = idWithRem.lastIndexOf("_");
    const id = idWithRem.substring(0, lastUnderscore);
    const timeStr = idWithRem.substring(lastUnderscore + 1);

    const r = bgCustomReminders.find(x => x.id === id);
    if (r && r.enabled) {
      sendReminderNotification(r, timeStr);
    } else {
      // 提醒已被删除或禁用，清除此闹钟
      chrome.alarms.clear(alarm.name);
    }
  }
});

// 启动时加载提醒
loadBgReminders();

// ==================== 每日角标跨日清零 ====================
function scheduleDailyBadgeReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);
  chrome.alarms.create("dailyBadgeReset", {
    when: tomorrow.getTime(),
    periodInMinutes: 1440
  });
  logInfo("[角标] 每日跨日清零闹钟已创建", { nextFire: tomorrow.toLocaleString() });
}
scheduleDailyBadgeReset();

// SW 每次唤醒（首次安装/浏览器启动/alarm 或 storage 唤醒）顶层代码重新执行，
// 主动重写角标色，修复"过一段时间角标自己变蓝回退默认色"的问题。
updateBadge();

logInfo("后台脚本初始化完成 ✓");


