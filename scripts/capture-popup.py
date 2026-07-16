#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capture REAL Daily Tracker popup screenshots by rendering the actual popup.html
(using its real CSS + popup.js) inside headless Chrome, with a chrome.* API mock
and seeded sample data. This guarantees the store screenshots match the real UI.

Outputs real popup PNGs to scripts/captured/:
  popup-drink-zh.png, popup-eat-zh.png, popup-poop-zh.png, popup-pee-zh.png,
  popup-period-zh.png, popup-settings-zh.png  (and -en variants)

The mock HTML files are written to the project root (so relative <script src> resolve)
and deleted after capture.
"""

import json
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_SRC = ROOT / "popup.html"
CAPTURED = ROOT / "scripts" / "captured"
CAPTURED.mkdir(parents=True, exist_ok=True)

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
POPUP_H = 700

# ---------------------------------------------------------------------------
# Sample data seeded into the chrome.storage.local mock (language-independent
# records; only the `language` key differs per locale).
# ---------------------------------------------------------------------------

def dstr(delta_days):
    return (date.today() - timedelta(days=delta_days)).isoformat()


def build_seed(lang):
    today = dstr(0)
    # Alarm started 10 minutes ago so the timer shows ~50 minutes remaining.
    alarm_start = int(time.time() * 1000) - 10 * 60 * 1000
    seed = {
        "language": lang,
        "defaultTab": "drink",
        "moduleStates": {"eat": True, "drink": True, "poop": True, "pee": True},
        "intervalMinutes": 60,
        "customMinutes": None,
        "alarmStartTime": alarm_start,
        "timerRunning": True,
        "notifEnabled": True,
        "mealDefaultTimes": {"breakfast": "07:30", "lunch": "12:00", "dinner": "18:30", "snack": "15:00"},
        "customMealTags": [
            {"name": "中式", "emoji": "🥢"},
            {"name": "西式", "emoji": "🍴"},
            {"name": "油腻", "emoji": "🍳"},
            {"name": "素食", "emoji": "🥗"},
        ],
        "drinkRecords": {},
        "drinkRecordsBackup": {},
        "mealRecords": {},
        "poopRecords": {},
        "peeRecords": {},
        "periodCycles": [
            {"startDate": "2026-04-14", "endDate": "2026-04-20", "days": {}},
            {"startDate": "2026-05-12", "endDate": "2026-05-18", "days": {}},
            {"startDate": "2026-06-10", "endDate": "2026-06-16", "days": {}},
            {"startDate": "2026-07-12", "endDate": None, "days": {}},
        ],
    }

    # Drink: today + a few past days
    drink = {}
    drink_times = ["08:10", "09:30", "10:45", "11:20", "13:05", "14:30", "16:00", "18:20", "20:10"]
    drink[today] = [{"time": t} for t in drink_times[:7]]
    for back in (1, 2, 3, 5, 8):
        d = dstr(back)
        n = 5 + (back % 3)
        drink[d] = [{"time": f"{9 + i}:{(i * 13) % 60:02d}"} for i in range(n)]
    seed["drinkRecords"] = drink
    seed["drinkRecordsBackup"] = drink

    # Meals: today
    seed["mealRecords"] = {
        today: [
            {"type": "breakfast", "name": "燕麦牛奶", "time": "07:40", "fullness": 3, "tags": ["西式"]},
            {"type": "lunch", "name": "牛肉面", "time": "12:30", "fullness": 4, "tags": ["中式", "油腻"]},
            {"type": "snack", "name": "苹果", "time": "15:30", "fullness": 3, "tags": ["素食"]},
            {"type": "dinner", "name": "番茄炒蛋盖饭", "time": "18:50", "fullness": 4, "tags": ["中式"]},
        ]
    }

    # Poop: today + scattered days
    poop = {}
    poop[today] = [{"time": "08:30", "bristolType": 4, "amount": 2, "color": 1, "note": ""}]
    for back in (1, 3, 4, 6, 9, 11):
        poop[dstr(back)] = [{"time": "09:1" + str(back % 10), "bristolType": (back % 7) + 1, "amount": (back % 4) + 1, "color": (back % 4) + 1, "note": ""}]
    seed["poopRecords"] = poop

    # Pee: today + scattered days
    pee = {}
    pee[today] = [
        {"time": "07:20", "amount": 2, "color": 1, "note": ""},
        {"time": "10:05", "amount": 3, "color": 2, "note": ""},
        {"time": "13:40", "amount": 2, "color": 1, "note": ""},
        {"time": "16:30", "amount": 3, "color": 2, "note": ""},
        {"time": "19:10", "amount": 2, "color": 1, "note": ""},
        {"time": "21:45", "amount": 1, "color": 1, "note": ""},
    ]
    for back in (1, 2, 3, 5, 7):
        pee[dstr(back)] = [{"time": f"{(back % 6) + 7}:30", "amount": (back % 4) + 1, "color": (back % 3) + 1, "note": ""} for _ in range(4 + back % 3)]
    seed["peeRecords"] = pee

    return seed


# ---------------------------------------------------------------------------
# chrome.* mock injected before i18n.js
# ---------------------------------------------------------------------------

MOCK_JS = """
window.__jsErrors = [];
window.onerror = function(msg, url, line, col, err) {
  window.__jsErrors.push({msg: msg, url: url, line: line, col: col, stack: err && err.stack ? err.stack : ''});
};
window.addEventListener('error', function(e) {
  window.__jsErrors.push({msg: e.message, url: e.filename, line: e.lineno, col: e.colno, stack: ''});
});
window.chrome = (function () {
  const store = __SEED__;
  function get(keys, cb) {
    if (typeof keys === 'string') keys = [keys];
    if (keys === null || keys === undefined) { cb(Object.assign({}, store)); return; }
    if (Array.isArray(keys)) {
      const r = {};
      keys.forEach(function (k) { if (k in store) r[k] = store[k]; });
      cb(r); return;
    }
    if (typeof keys === 'object') {
      const r = {};
      for (const k in keys) r[k] = (k in store) ? store[k] : keys[k];
      cb(r); return;
    }
    cb({});
  }
  function set(obj, cb) { Object.assign(store, obj); if (cb) cb(); }
  function remove(keys, cb) {
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { delete store[k]; });
    if (cb) cb();
  }
  const storage = { local: { get: get, set: set, remove: remove, onChanged: { addListener: function () {} } }, onChanged: { addListener: function () {} } };
  function sendMessage(msg, cb) { if (cb) cb({}); return Promise.resolve({}); }
  const notifications = { create: function (id, opts, cb) { if (cb) cb(); return Promise.resolve(); }, clear: function (id, cb) { if (cb) cb(); } };
  const action = {
    setIcon: function (o, cb) { if (cb) cb(); },
    setBadgeText: function (o, cb) { if (cb) cb(); },
    setBadgeTextColor: function (o, cb) { if (cb) cb(); },
    setBadgeBackgroundColor: function (o, cb) { if (cb) cb(); },
    openPopup: function () { return Promise.resolve(); }
  };
  return {
    storage: storage,
    runtime: {
      sendMessage: sendMessage,
      getManifest: function () { return { version: '1.0.0' }; },
      onMessage: { addListener: function () {} },
      onStartup: { addListener: function () {} },
      onInstalled: { addListener: function () {} },
      lastError: null
    },
    notifications: notifications,
    action: action,
    i18n: { getMessage: function (k) { return k; } }
  };
})();
"""

TARGET_JS = """
(function () {
  function run() {
    try {
      var t = "__TARGET__";
      if (t === "settings") {
        var sb = document.getElementById("sidebarPanel");
        if (sb) { sb.classList.add("open"); sb.style.right = "0px"; }
      } else if (t !== "drink") {
        if (typeof switchTab === "function") switchTab(t);
      }
    } catch (e) { console.error(e); }
  }
  if (document.readyState === "complete") setTimeout(run, 600);
  else window.addEventListener("load", function () { setTimeout(run, 600); });
})();
"""


def build_html(lang, target):
    html = HTML_SRC.read_text(encoding="utf-8")
    seed = build_seed(lang)
    mock = MOCK_JS.replace("__SEED__", json.dumps(seed, ensure_ascii=False))
    # inline i18n.js and popup.js so headless Chrome does not treat them as
    # anonymous file:// scripts and gives real line numbers on errors.
    i18n = (ROOT / "i18n.js").read_text(encoding="utf-8")
    popup = (ROOT / "popup.js").read_text(encoding="utf-8")
    html = html.replace(
        '<script src="i18n.js"></script>',
        '<script>' + mock + '</script>\n<script>' + i18n + '</script>', 1)
    html = html.replace(
        '<script src="popup.js"></script>',
        '<script>' + popup + '</script>\n<script>' + TARGET_JS.replace("__TARGET__", target) + '</script>', 1)
    return html


def capture(lang, target):
    html = build_html(lang, target)
    tmp = ROOT / f"__mock_{target}_{lang}.html"
    tmp.write_text(html, encoding="utf-8")
    out = CAPTURED / f"popup-{target}-{lang}.png"
    try:
        subprocess.run(
            [
                CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--force-device-scale-factor=1",
                "--window-size=320,700", "--virtual-time-budget=3500",
                f"--screenshot={out}", f"file://{tmp.resolve()}",
            ],
            check=True, capture_output=True, text=True,
        )
        print(f"[ok] {out.name}")
    finally:
        if tmp.exists():
            tmp.unlink()
    return out


def main():
    targets = ["drink", "eat", "poop", "pee", "period", "settings"]
    langs = ["zh", "en"]
    for lang in langs:
        for target in targets:
            capture(lang, target)
    print(f"Captured {len(targets) * len(langs)} popup screenshots in {CAPTURED}")


if __name__ == "__main__":
    main()
