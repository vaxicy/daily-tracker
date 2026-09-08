#!/usr/bin/env python3
"""Regenerate ALL 5 store screenshots (zh + en) from scratch.

Composition per screenshot: theme-colored bg gradient + rounded banner +
popup capture(s) + 2x2 feature cards. No patching — everything drawn fresh.

Run with cwd = project root. Output: store-assets/screenshots/{lang}/*.png
"""
import os
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont

CAP_DIR = os.path.join("scripts", "captured")
OUT_DIR = os.path.join("store-assets", "screenshots")
W, H = 1280, 800


def font(size, bold=False, latin=False):
    if latin:
        cands = [r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
                 r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"]
    else:
        cands = [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
                 r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def save_retry(img, path, tries=8):
    last = None
    for _ in range(tries):
        try:
            img.save(path, "PNG")
            return
        except OSError as e:
            last = e
            time.sleep(0.6)
    raise last


def fit_font(draw, s, size, bold, max_w):
    while size > 12:
        f = font(size, bold)
        b = draw.textbbox((0, 0), s, font=f)
        if b[2] - b[0] <= max_w:
            return f
        size -= 1
    return font(size, bold)


# ---- theme colors per screenshot ----
THEMES = {
    "01-water":     {"banner": (11, 107, 255),  "bg_top": (233, 244, 255), "bg_bot": (218, 234, 255)},
    "02-diet":      {"banner": (245, 158, 11),  "bg_top": (254, 250, 234), "bg_bot": (254, 243, 199)},
    "03-bathroom":  {"banner": (124, 58, 237),  "bg_top": (244, 242, 254), "bg_bot": (237, 233, 254)},
    "04-period":    {"banner": (236, 72, 153),  "bg_top": (255, 239, 244), "bg_bot": (255, 228, 237)},
    "05-personalize": {"banner": (11, 107, 255), "bg_top": (232, 243, 255), "bg_bot": (218, 234, 255)},
}

# ---- copy per screenshot per language ----
COPY = {
    "zh": {
        "01-water": {
            "title": "喝水提醒", "subtitle": "定时提醒喝水，一键打卡，养成充足饮水习惯",
            "cards": [("自定义间隔", "15 / 30 / 45 / 60 分钟或自定义", "clock"),
                      ("弹窗通知", "到点弹通知提醒", "bell"),
                      ("饮水统计", "今日 / 本周 / 本月饮水次数", "chart"),
                      ("Enter 快捷打卡", "按 Enter 直接记录", "enter")],
        },
        "02-diet": {
            "title": "饮食记录", "subtitle": "记录三餐，评价美食，标注菜系，追踪饱腹感",
            "cards": [("快捷标签", "中式、西式、日式等", "tag"),
                      ("五档评分", "给食物打分", "star"),
                      ("饱腹感", "从饿到撑", "gauge"),
                      ("饮食统计", "每周月统计", "chart")],
        },
        "03-bathroom": {
            "title": "排便 & 排尿", "subtitle": "Bristol 分型、尿液颜色、健康统计",
            "cards": [("Bristol 量表", "7 型评估", "grid"),
                      ("尿液颜色", "透明到异常色", "drop"),
                      ("历史日历", "趋势与规律", "calendar"),
                      ("健康统计", "统计与间隔", "chart")],
        },
        "04-period": {
            "title": "经期记录", "subtitle": "日历视图、情绪症状、周期分析",
            "cards": [("日历视图", "经期分布与周期", "calendar"),
                      ("情绪症状", "记录每日情绪与身体状态", "smile"),
                      ("周期分析", "周期长度与规律柱状图", "chart"),
                      ("智能提醒", "经期、吃药、运动提醒", "bell")],
        },
        "05-personalize": {
            "title": "个性化 & 隐私", "subtitle": "30 款主题、六语界面、Enter 快捷、数据本地保存",
            "cards": [("多主题风格", "30 款主题一键切换", "apps"),
                      ("六语界面", "中 / 英 / 西 / 日 / 韩 / 法", "globe"),
                      ("Enter 快捷打卡", "任一模块按 Enter 直接记录", "enter"),
                      ("本地存储", "无感联网，隐私自己掌控", "lock")],
        },
    },
    "en": {
        "01-water": {
            "title": "Water Reminder", "subtitle": "Timed reminders, one-tap check-in, stay hydrated",
            "cards": [("Custom Interval", "15 / 30 / 45 / 60 min or custom", "clock"),
                      ("Popup Notification", "Get notified when it's time", "bell"),
                      ("Drink Stats", "Today / week / month counts", "chart"),
                      ("Enter to Check In", "Press Enter to log quickly", "enter")],
        },
        "02-diet": {
            "title": "Diet Tracker", "subtitle": "Log meals, rate food, tag cuisine, track fullness",
            "cards": [("Quick Tags", "Chinese, Western, Japanese, etc.", "tag"),
                      ("5-Star Rating", "Rate how good the food was", "star"),
                      ("Fullness Scale", "From starving to very full", "gauge"),
                      ("Diet Stats", "Weekly and monthly stats", "chart")],
        },
        "03-bathroom": {
            "title": "Bowel & Bladder", "subtitle": "Bristol scale, urine color, health insights",
            "cards": [("Bristol Scale", "7-type assessment", "grid"),
                      ("Urine Color", "Clear to abnormal colors", "drop"),
                      ("History Calendar", "Trends and patterns", "calendar"),
                      ("Health Stats", "Stats and intervals", "chart")],
        },
        "04-period": {
            "title": "Period Tracker", "subtitle": "Calendar view, mood, symptoms, cycle analysis",
            "cards": [("Calendar View", "Visual period distribution and cycle", "calendar"),
                      ("Mood & Symptoms", "Log daily mood and physical state", "smile"),
                      ("Cycle Analysis", "Bar charts for cycle length & patterns", "chart"),
                      ("Smart Reminders", "Period, meds, exercise reminders", "bell")],
        },
        "05-personalize": {
            "title": "Personalize & Privacy", "subtitle": "30 themes, six languages, Enter shortcut, all data stays local",
            "cards": [("Many Themes", "30 themes, one tap away", "apps"),
                      ("Six Languages", "ZH / EN / ES / JA / KO / FR", "globe"),
                      ("Enter Shortcut", "Log in any module with Enter", "enter"),
                      ("Local Storage", "No internet, data stays local", "lock")],
        },
    },
}

# layout constants
BANNER = (45, 40, 1035, 152)
SINGLE_POPUP = (70, 200, 232)          # x, y, w
DUAL_POPUP_LEFT = (55, 200, 228)
DUAL_POPUP_RIGHT = (300, 200, 228)
CARD_COLS_SINGLE = (360, 735)          # for single-popup layouts
CARD_COLS_DUAL = (570, 925)            # for dual-popup layout (03)
CARD_Y = (192, 300)
CARD_W, CARD_H = 355, 94


# ---- white Material-ish icons ----
def icon_clock(d, cx, cy):
    r = 10
    d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(255,255,255), width=2)
    d.line([cx, cy-6, cx, cy], fill=(255,255,255), width=2)
    d.line([cx, cy, cx+4, cy+3], fill=(255,255,255), width=2)

def icon_bell(d, cx, cy):
    d.arc([cx-8, cy-10, cx+8, cy+4], start=180, end=360, fill=(255,255,255), width=2)
    d.line([cx-8, cy-3, cx+8, cy-3], fill=(255,255,255), width=2)
    d.rounded_rectangle([cx-4, cy-3, cx+4, cy+4], radius=2, fill=(255,255,255))
    d.ellipse([cx-2, cy+5, cx+2, cy+8], fill=(255,255,255))

def icon_chart(d, cx, cy):
    for i, h in enumerate([7, 12, 9]):
        x = cx - 9 + i * 7
        d.rounded_rectangle([x, cy+8-h, x+5, cy+8], radius=1, fill=(255,255,255))

def icon_enter(d, cx, cy):
    d.line([cx+10, cy-6, cx+10, cy+2], fill=(255,255,255), width=2)
    d.line([cx+10, cy+2, cx-8, cy+2], fill=(255,255,255), width=2)
    d.line([cx-4, cy-3, cx-9, cy+2], fill=(255,255,255), width=2)
    d.line([cx-4, cy+7, cx-9, cy+2], fill=(255,255,255), width=2)

def icon_tag(d, cx, cy):
    d.rounded_rectangle([cx-9, cy-7, cx+9, cy+7], radius=3, outline=(255,255,255), width=2)
    d.ellipse([cx-4, cy-3, cx, cy+1], fill=(255,255,255))

def icon_star(d, cx, cy):
    import math
    pts = []
    for i in range(10):
        angle = math.pi/2 + i * math.pi/5
        r = 11 if i % 2 == 0 else 5
        pts.append((cx + r*math.cos(angle), cy - r*math.sin(angle)))
    d.polygon(pts, fill=(255,255,255))

def icon_gauge(d, cx, cy):
    d.arc([cx-10, cy-8, cx+10, cy+8], start=180, end=360, fill=(255,255,255), width=2)
    d.line([cx, cy, cx+6, cy-5], fill=(255,255,255), width=2)

def icon_grid(d, cx, cy):
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            x0 = cx + dx*7 - 2.5; y0 = cy + dy*7 - 2.5
            d.rounded_rectangle([x0, y0, x0+5, y0+5], radius=1, fill=(255,255,255))

def icon_drop(d, cx, cy):
    d.polygon([(cx, cy-11), (cx+7, cy+2), (cx-7, cy+2)], fill=(255,255,255))
    d.ellipse([cx-7, cy-2, cx+7, cy+11], fill=(255,255,255))

def icon_calendar(d, cx, cy):
    d.rounded_rectangle([cx-9, cy-8, cx+9, cy+9], radius=2, outline=(255,255,255), width=2)
    d.line([cx-9, cy-3, cx+9, cy-3], fill=(255,255,255), width=2)
    d.line([cx-3, cy-10, cx-3, cy-5], fill=(255,255,255), width=2)
    d.line([cx+3, cy-10, cx+3, cy-5], fill=(255,255,255), width=2)

def icon_smile(d, cx, cy):
    d.ellipse([cx-10, cy-10, cx+10, cy+10], outline=(255,255,255), width=2)
    d.arc([cx-5, cy-2, cx+5, cy+6], start=20, end=160, fill=(255,255,255), width=2)
    d.ellipse([cx-5, cy-5, cx-2, cy-2], fill=(255,255,255))
    d.ellipse([cx+2, cy-5, cx+5, cy-2], fill=(255,255,255))

def icon_apps(d, cx, cy):
    for dx in (-1, 1):
        for dy in (-1, 1):
            x0 = cx + dx*5 - 3; y0 = cy + dy*5 - 3
            d.rounded_rectangle([x0, y0, x0+6, y0+6], radius=1.5, fill=(255,255,255))

def icon_globe(d, cx, cy):
    d.ellipse([cx-10, cy-10, cx+10, cy+10], outline=(255,255,255), width=2)
    d.line([cx-10, cy, cx+10, cy], fill=(255,255,255), width=2)
    d.ellipse([cx-4.5, cy-10, cx+4.5, cy+10], outline=(255,255,255), width=2)

def icon_lock(d, cx, cy):
    d.arc([cx-7, cy-10, cx+7, cy+2], start=180, end=360, fill=(255,255,255), width=2)
    d.rounded_rectangle([cx-9, cy-2, cx+9, cy+11], radius=3, fill=(255,255,255))

ICONS = {k: v for k, v in list(globals().items()) if k.startswith("icon_")}


def paste_rounded(base, img, xy, radius=14, shadow_alpha=70):
    w, h = img.size
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [xy[0], xy[1], xy[0]+w, xy[1]+h], radius=radius, fill=(20, 40, 80, shadow_alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(12))
    base.alpha_composite(sh)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=255)
    base.paste(img, xy, mask)


def compose(suffix, lang):
    theme = THEMES[suffix]
    copy = COPY[lang][suffix]
    img = Image.new("RGBA", (W, H), theme["bg_top"] + (255,))
    d = ImageDraw.Draw(img)
    # bg gradient
    for y in range(H):
        t = y / (H - 1)
        c = tuple(int(theme["bg_top"][i] + (theme["bg_bot"][i] - theme["bg_top"][i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c + (255,))

    # banner
    d.rounded_rectangle(BANNER, radius=22, fill=theme["banner"])
    ft = fit_font(d, copy["title"], 42, True, 640)
    d.text((BANNER[0]+32, BANNER[1]+16), copy["title"], font=ft, fill=(255,255,255,255))
    fs = fit_font(d, copy["subtitle"], 19, False, 700)
    d.text((BANNER[0]+32, BANNER[1]+76), copy["subtitle"], font=fs, fill=(255,255,255,220))

    # popup(s)
    is_dual = suffix == "03-bathroom"
    if is_dual:
        for (px, py, pw), module in [
            (DUAL_POPUP_LEFT, "poop"), (DUAL_POPUP_RIGHT, "pee")]:
            cap = Image.open(os.path.join(CAP_DIR, f"popup-{module}-{lang}.png")).convert("RGB")
            scale = pw / cap.width
            ph = round(cap.height * scale)
            cap = cap.resize((pw, ph), Image.LANCZOS)
            paste_rounded(img, cap, (px, py))
        card_cols = CARD_COLS_DUAL
    else:
        module = {"01-water": "drink", "02-diet": "eat", "04-period": "period", "05-personalize": "drink"}[suffix]
        px, py, pw = SINGLE_POPUP
        cap = Image.open(os.path.join(CAP_DIR, f"popup-{module}-{lang}.png")).convert("RGB")
        scale = pw / cap.width
        ph = round(cap.height * scale)
        cap = cap.resize((pw, ph), Image.LANCZOS)
        paste_rounded(img, cap, (px, py))
        card_cols = CARD_COLS_SINGLE

    # 2x2 cards
    for i, (t, s, ic) in enumerate(copy["cards"]):
        row, col = divmod(i, 2)
        x = card_cols[col]
        y = CARD_Y[row]
        # shadow
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            [x, y, x+CARD_W, y+CARD_H], radius=16, fill=(20, 40, 80, 40))
        sh = sh.filter(ImageFilter.GaussianBlur(8))
        img.alpha_composite(sh)
        dd = ImageDraw.Draw(img)
        dd.rounded_rectangle([x, y, x+CARD_W, y+CARD_H], radius=16, fill=(255,255,255,255))
        ccx, ccy = x + 34, y + CARD_H // 2
        dd.ellipse([ccx-17, ccy-17, ccx+17, ccy+17], fill=theme["banner"])
        fn = ICONS.get(f"icon_{ic}")
        if fn:
            fn(dd, ccx, ccy)
        dd.text((x + 62, y + 18), t, font=font(18, True), fill=(24, 50, 90, 255))
        dd.text((x + 62, y + 50), s, font=font(13.5 if not latin_check(s) else 13), fill=(100, 118, 145, 255))
    return img.convert("RGB")


def latin_check(s):
    return all(ord(ch) < 0x2E80 for ch in s)


def main():
    for lang in ("zh", "en"):
        for suffix in THEMES:
            img = compose(suffix, lang)
            out = os.path.join(OUT_DIR, lang, f"screenshot-{suffix}.png")
            save_retry(img, out)
            print("wrote", out, img.size)
    print("ALL DONE")


if __name__ == "__main__":
    main()
