#!/usr/bin/env python3
"""Generate the 5th store screenshot (zh + en) using Playwright headless.

Renders a full HTML mockup in real Chromium so the output uses actual
fonts, shadows, and rounded corners (not synthetic PIL). All resources
(images, icons) are inlined as data URIs to keep file:// rendering self-
contained.
"""
import os
import sys
import tempfile
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "store-assets", "screenshots")

W, H = 1280, 800

# SVG icons inlined as data URIs (4 feature cards)
ICON_THEME = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMTIgM3YxOE0zIDEuaDE4TTUuNiA1LjZsMTIuOCAxMi44TTE4LjQgNS42TDUuNiAxOC40Ii8+PC9zdmc+"
ICON_GLOBE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMyAxMmgxOE0xMiAzYTE0IDE0IDAgMDExIDE4TTEyIDNhMTQgMTQgMCAwMC0xIDE4Ii8+PC9zdmc+"
ICON_ENTER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VubmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMCA0djhhNCA0IDAgMDEtNCA0SDRNOCAxMmw0IDRNOCAxMmw0LTQiLz48L3N2Zz4="
ICON_LOCK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjQiIHk9IjEwIiB3aWR0aD0iMTYiIGhlaWdodD0iMTEiIHJ4PSIyIi8+PHBhdGggZD0iTTggMTBWN2E0IDQgMCAwMTggMHYzIi8+PC9zdmc+"
CUP_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjIyIiBoZWlnaHQ9IjIyIj48cGF0aCBmaWxsPSIjRkY2QjZCIiBkPSJNNSAzaDExbC0xIDRINkw1IDN6bTAgNWgxMWwtLjUgMTFhMyAzIDAgMDEtMyAzaC00YTMgMyAwIDAxLTMtM0w1IDh6Ii8+PHBhdGggZmlsbD0iI0ZGQjNCMyIgZD0iTTE2IDZoMmEyIDIgMCAwMTIgMnYzYTIgMiAwIDAxLTIgMmgtMi41bC41LTd6Ii8+PC9zdmc+"

TEMPLATE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; background: #E8EEF7; font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; color: #1E2A4A; }}
.chrome {{ width: {w}px; height: {h}px; background: #E8EEF7; position: relative; overflow: hidden; }}
.titlebar {{ height: 38px; background: linear-gradient(#F8F8F8, #ECECEC); border-bottom: 1px solid #D0D0D0; display: flex; align-items: center; padding: 0 14px; }}
.lights {{ display: flex; gap: 8px; }}
.lights span {{ width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,.25); }}
.lights .r {{ background: #FF5F57; }}
.lights .y {{ background: #FEBC2E; }}
.lights .g {{ background: #28C840; }}
.tab {{ margin-left: 22px; height: 26px; line-height: 26px; padding: 0 14px; background: #FFFFFF; border: 1px solid #D0D0D0; border-bottom: 1px solid #FFFFFF; border-top-left-radius: 6px; border-top-right-radius: 6px; font-size: 12px; color: #333; display: flex; align-items: center; gap: 6px; max-width: 220px; }}
.tab .favicon {{ width: 14px; height: 14px; background: linear-gradient(135deg, #1D4ED8, #3B82F6); border-radius: 3px; }}
.tab .close {{ margin-left: 4px; color: #999; font-size: 13px; }}
.toolbar {{ height: 40px; background: #FFFFFF; border-bottom: 1px solid #D8D8D8; display: flex; align-items: center; padding: 0 14px; gap: 8px; }}
.urlbar {{ flex: 1; height: 26px; background: #F1F3F4; border-radius: 13px; display: flex; align-items: center; padding: 0 14px; font-size: 12px; color: #5F6368; }}
.urlbar .lock {{ margin-right: 6px; color: #188038; font-size: 11px; }}
.page {{ background: #E8EEF7; padding: 32px 36px; display: flex; justify-content: center; }}
.popup {{ width: 980px; background: #FFFFFF; border-radius: 18px; box-shadow: 0 16px 40px rgba(15,30,60,.14); overflow: hidden; }}
.banner {{ background: linear-gradient(120deg, #1D4ED8, #2563EB 60%, #3B82F6); color: #FFFFFF; padding: 28px 36px 32px; }}
.banner h1 {{ margin: 0; font-size: 30px; font-weight: 700; letter-spacing: 0.5px; }}
.banner p {{ margin: 8px 0 0; font-size: 14.5px; opacity: .9; }}
.body {{ padding: 28px 36px 36px; background: #F4F7FD; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 18px; height: 460px; }}
.card {{ background: #FFFFFF; border-radius: 14px; padding: 18px 20px; box-shadow: 0 4px 12px rgba(20,40,80,.06); display: flex; align-items: center; gap: 14px; min-height: 92px; }}
.card .ic {{ width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #1D4ED8, #3B82F6); display: flex; align-items: center; justify-content: center; flex: none; box-shadow: 0 4px 10px rgba(29,78,216,.25); }}
.card .ic img {{ width: 26px; height: 26px; }}
.card .t {{ font-size: 16.5px; font-weight: 700; color: #1E2A4A; line-height: 1.3; }}
.card .s {{ font-size: 13px; color: #6B7A99; margin-top: 4px; line-height: 1.3; }}
.preview {{ grid-column: 1 / 3; grid-row: 2; background: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 14px rgba(20,40,80,.07); padding: 20px 22px; min-height: 168px; }}
.preview .ph {{ display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #1E2A4A; }}
.preview .ph .ic {{ width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }}
.preview .timer {{ margin-top: 12px; font-size: 36px; font-weight: 800; color: #1D4ED8; letter-spacing: 1px; font-variant-numeric: tabular-nums; }}
.preview .row {{ margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #6B7A99; }}
.preview .row .pill {{ background: #EEF2FB; border-radius: 999px; padding: 4px 10px; }}
.preview .row .toggle {{ width: 34px; height: 18px; background: #1D4ED8; border-radius: 999px; position: relative; margin-left: auto; }}
.preview .row .toggle::after {{ content: ""; position: absolute; width: 14px; height: 14px; background: #FFFFFF; border-radius: 50%; top: 2px; left: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.2); }}
.preview .cta {{ margin-top: 14px; display: flex; gap: 8px; }}
.preview .cta .b1 {{ background: linear-gradient(135deg, #1D4ED8, #3B82F6); color: #FFFFFF; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(29,78,216,.3); }}
.preview .cta .b2 {{ background: #EEF2FB; color: #4B5B7A; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; }}
.lang-panel {{ grid-column: 3 / 5; grid-row: 2; background: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 14px rgba(20,40,80,.07); padding: 18px 20px; display: flex; flex-direction: column; min-height: 168px; }}
.lang-panel h3 {{ margin: 0 0 10px; font-size: 14px; color: #1E2A4A; font-weight: 700; display: flex; align-items: center; gap: 6px; }}
.lang-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
.lang-row {{ display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #F4F7FD; border-radius: 8px; font-size: 13px; color: #1E2A4A; }}
.lang-row .code {{ font-size: 11px; font-weight: 700; color: #1D4ED8; background: #DDE7FB; border-radius: 4px; padding: 1px 5px; }}
.lang-row .active {{ margin-left: auto; color: #1D4ED8; font-weight: 700; font-size: 12px; }}
</style></head>
<body><div class="chrome">
  <div class="titlebar">
    <div class="lights"><span class="r"></span><span class="y"></span><span class="g"></span></div>
    <div class="tab"><div class="favicon"></div>Daily Habit Tracker — {tab}<span class="close">×</span></div>
  </div>
  <div class="toolbar"><div class="urlbar"><span class="lock">🔒</span>chrome-extension://__MSG_@@extension_id__/popup.html</div></div>
  <div class="page"><div class="popup">
    <div class="banner">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
    <div class="body">
      <div class="card"><div class="ic"><img src="{icon_theme}" alt=""></div><div><div class="t">{card1_t}</div><div class="s">{card1_s}</div></div></div>
      <div class="card"><div class="ic"><img src="{icon_globe}" alt=""></div><div><div class="t">{card2_t}</div><div class="s">{card2_s}</div></div></div>
      <div class="card"><div class="ic"><img src="{icon_enter}" alt=""></div><div><div class="t">{card3_t}</div><div class="s">{card3_s}</div></div></div>
      <div class="card"><div class="ic"><img src="{icon_lock}" alt=""></div><div><div class="t">{card4_t}</div><div class="s">{card4_s}</div></div></div>
      <div class="preview">
        <div class="ph"><div class="ic"><img src="{cup}" alt=""></div>{ph}</div>
        <div class="timer">47:23</div>
        <div class="row"><span class="pill">{pill_running}</span><div class="toggle"></div></div>
        <div class="cta"><div class="b1">{b1}</div><div class="b2">{b2}</div></div>
      </div>
      <div class="lang-panel">
        <h3>{lang_h}</h3>
        <div class="lang-grid">
          <div class="lang-row"><span class="code">ZH</span>中文<span class="active">✓</span></div>
          <div class="lang-row"><span class="code">EN</span>English</div>
          <div class="lang-row"><span class="code">ES</span>Español</div>
          <div class="lang-row"><span class="code">JA</span>日本語</div>
          <div class="lang-row"><span class="code">KO</span>한국어</div>
          <div class="lang-row"><span class="code">FR</span>Français</div>
        </div>
      </div>
    </div>
  </div></div>
</div></body></html>"""

CONTENT = {
    "zh": {
        "title": "个性化 & 隐私",
        "subtitle": "30 款主题、六语界面、Enter 快捷、数据本地保存",
        "card1_t": "多主题风格",
        "card1_s": "default 蓝调、少女粉、森林绿…",
        "card2_t": "六语界面",
        "card2_s": "中 / 英 / 西 / 日 / 韩 / 法",
        "card3_t": "Enter 快捷打卡",
        "card3_s": "任一模块按 Enter 直接记录",
        "card4_t": "本地存储",
        "card4_s": "无感联网，隐私自己掌控",
        "ph": "喝水提醒",
        "pill_running": "运行中 / Running",
        "b1": "我喝了！",
        "b2": "重置倒计时",
        "tab": "主题设置",
        "lang_h": "🌐 当前语言：中文 (默认)",
    },
    "en": {
        "title": "Personalize & Privacy",
        "subtitle": "30 themes, six languages, Enter shortcut, all data stays local",
        "card1_t": "Many Themes",
        "card1_s": "30 themes incl. dark & xmas",
        "card2_t": "Six Languages",
        "card2_s": "ZH / EN / ES / JA / KO / FR",
        "card3_t": "Enter Shortcut",
        "card3_s": "Press Enter to log in any module",
        "card4_t": "Local Storage",
        "card4_s": "No internet, your data stays put",
        "ph": "Drink Reminder",
        "pill_running": "Timer / Running",
        "b1": "I drank!",
        "b2": "Reset Timer",
        "tab": "Settings",
        "lang_h": "🌐 Current language: English",
    },
}


def render(lang):
    c = CONTENT[lang]
    return TEMPLATE.format(
        w=W, h=H,
        title=c["title"], subtitle=c["subtitle"],
        card1_t=c["card1_t"], card1_s=c["card1_s"],
        card2_t=c["card2_t"], card2_s=c["card2_s"],
        card3_t=c["card3_t"], card3_s=c["card3_s"],
        card4_t=c["card4_t"], card4_s=c["card4_s"],
        ph=c["ph"], pill_running=c["pill_running"],
        b1=c["b1"], b2=c["b2"], tab=c["tab"], lang_h=c["lang_h"],
        icon_theme=ICON_THEME, icon_globe=ICON_GLOBE,
        icon_enter=ICON_ENTER, icon_lock=ICON_LOCK, cup=CUP_ICON,
    )


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for lang in ("zh", "en"):
            ctx = browser.new_context(
                viewport={"width": W, "height": H},
                device_scale_factor=1,  # avoid 2x = 2560x1600 (per Web Store size rule)
            )
            page = ctx.new_page()
            html = render(lang)
            page.set_content(html, wait_until="load")
            # screenshot to bytes (Playwright's Python writer fails on non-ASCII paths)
            png_bytes = page.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H}, omit_background=False)
            ctx.close()
            out = os.path.join(OUT_DIR, lang, "screenshot-05-personalize.png")
            with open(out, "wb") as f:
                f.write(png_bytes)
            print("wrote", out)
        browser.close()
    print("ALL DONE")


if __name__ == "__main__":
    main()
