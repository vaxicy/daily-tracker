const DEFAULT_MINUTES = 30;

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
});

chrome.runtime.onInstalled.addListener((details) => {
  logInfo(`扩展安装/更新: ${details.reason}`);
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
    } else {
      alarms.forEach(a => {
        const remaining = Math.max(0, (a.scheduledTime - Date.now()) / 1000);
        logInfo("[检查] 闹钟状态", { name: a.name, 剩余秒: remaining.toFixed(1), 周期分钟: a.periodInMinutes });
      });
    }
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
  
  chrome.alarms.clearAll(() => {
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
      title: "喝水提醒 💧",
      message: "该喝水啦！记得保持水分，状态更好。",
      priority: 2,
      requireInteraction: true, // 保持通知直到用户操作
      buttons: [
        { title: "我喝了 ✓" },
        { title: "没喝" }
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
    chrome.alarms.clearAll();
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
      title: "测试通知 🔔",
      message: "这是一条测试通知，用于验证功能是否正常。",
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

    chrome.storage.local.set({ drinkRecords: records }, () => {
      if (chrome.runtime.lastError) {
        logError("保存喝水记录失败", { error: chrome.runtime.lastError.message });
      } else {
        logInfo("喝水已记录", { today, time, total: records[today].length });
      }
    });

    // 通知 popup 刷新统计数据（popup 可能未打开，忽略发送失败）
    chrome.runtime.sendMessage({ type: "DRINK_RECORDED" }).catch(() => {});
  });
}

logInfo("后台脚本初始化完成 ✓");
