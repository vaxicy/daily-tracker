#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Chrome Web Store screenshots and bilingual promo images for Daily Tracker.

Outputs:
  - Screenshots (per language): store-assets/screenshots/{zh,en}/screenshot-*.png (1280x800)
  - Bilingual promo tile: store-assets/promo/promo-tile-440x280.png
  - Bilingual marquee: store-assets/promo/marquee-1400x560.png

Layout pattern: the REAL rendered popup (captured by scripts/capture-popup.py into
scripts/captured/) pasted on the left, plus promotional feature cards on the right.
This guarantees the store screenshots match the actual extension UI 1:1.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets" / "screenshots"
PROMO_OUT = ROOT / "store-assets" / "promo"
CAPTURED = ROOT / "scripts" / "captured"
OUT.mkdir(parents=True, exist_ok=True)
PROMO_OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 800
POPUP_W, POPUP_H = 320, 480  # legacy; real captured popups are 320x700
REAL_W, REAL_H = 320, 700

COLORS = {
    "text": "#0c2a4d",
    "muted": "#6b7a8f",
    "white": "#ffffff",
    "panel": "#ffffff",
}

THEMES = {
    "default": {
        "bg_top": "#eaf5ff", "bg_bot": "#daeaff",
        "text": "#0c2a4d", "muted": "#6b7a8f",
        "primary": "#0b6bff", "primary2": "#20c6ff",
        "secondary": "#8B5CF6", "secondary2": "#A78BFA",
    },
    "pink": {
        "bg_top": "#fce7f3", "bg_bot": "#fbcfe8",
        "text": "#4a1a3d", "muted": "#9a6b8a",
        "primary": "#EC4899", "primary2": "#F472B6",
        "secondary": "#DB2777", "secondary2": "#F9A8D4",
    },
    "eat": {
        "bg_top": "#fffbeb", "bg_bot": "#fef3c7",
        "text": "#4a1a3d", "muted": "#9a8a6b",
        "primary": "#F59E0B", "primary2": "#FBBF24",
        "secondary": "#D97706", "secondary2": "#FDE68A",
    },
    "pee": {
        "bg_top": "#ecfdf5", "bg_bot": "#d1fae5",
        "text": "#0a2923", "muted": "#6b9a8a",
        "primary": "#10B981", "primary2": "#34D399",
        "secondary": "#059669", "secondary2": "#6EE7B7",
    },
    "poop": {
        "bg_top": "#f5f3ff", "bg_bot": "#ede9fe",
        "text": "#2a1a4a", "muted": "#7a6b9a",
        "primary": "#7c3aed", "primary2": "#8B5CF6",
        "secondary": "#6D28D9", "secondary2": "#C4B5FD",
    },
    "period": {
        "bg_top": "#fff0f5", "bg_bot": "#ffe4ed",
        "text": "#4a1a3d", "muted": "#9a6b8a",
        "primary": "#EC4899", "primary2": "#F472B6",
        "secondary": "#DB2777", "secondary2": "#F9A8D4",
    },
    "dark": {
        "bg_top": "#0f172a", "bg_bot": "#1e293b",
        "text": "#e2e8f0", "muted": "#94a3b8",
        "primary": "#3b82f6", "primary2": "#60a5fa",
        "secondary": "#8B5CF6", "secondary2": "#A78BFA",
    },
    "forest": {
        "bg_top": "#f0fdf4", "bg_bot": "#dcfce7",
        "text": "#0a2923", "muted": "#6b9a8a",
        "primary": "#059669", "primary2": "#34d399",
        "secondary": "#10B981", "secondary2": "#6EE7B7",
    },
}

FONT_CACHE = {}


def font(size, bold=False, pixel=False):
    key = (size, bold, pixel)
    if key in FONT_CACHE:
        return FONT_CACHE[key]

    candidates = []
    if pixel:
        candidates.append(ROOT / "fonts" / "PressStart2P-Regular.ttf")
    if bold:
        candidates += [
            Path("C:/Windows/Fonts/msyhbd.ttc"),
            Path("C:/Windows/Fonts/simhei.ttf"),
        ]
    candidates += [
        Path("C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/simsun.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            f = ImageFont.truetype(str(candidate), size)
            FONT_CACHE[key] = f
            return f

    f = ImageFont.load_default()
    FONT_CACHE[key] = f
    return f


def emoji_font(size):
    key = ("emoji", size)
    if key in FONT_CACHE:
        return FONT_CACHE[key]
    candidates = [
        Path("C:/Windows/Fonts/seguiemj.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                f = ImageFont.truetype(str(candidate), size)
                FONT_CACHE[key] = f
                return f
            except Exception:
                pass
    f = font(size, bold=False)
    FONT_CACHE[key] = f
    return f


def hex_to_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def gradient_bg(W, H, top, bot):
    img = Image.new("RGB", (W, H), top)
    draw = ImageDraw.Draw(img)
    top_rgb = hex_to_rgb(top)
    bot_rgb = hex_to_rgb(bot)
    for y in range(H):
        ratio = y / H
        r = int(top_rgb[0] * (1 - ratio) + bot_rgb[0] * ratio)
        g = int(top_rgb[1] * (1 - ratio) + bot_rgb[1] * ratio)
        b = int(top_rgb[2] * (1 - ratio) + bot_rgb[2] * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img, draw


def base_bg(W, H, theme="default"):
    t = THEMES[theme]
    return gradient_bg(W, H, t["bg_top"], t["bg_bot"])


def rounded_rect(draw, xy, fill, radius=16, outline=None, width=0):
    draw.rounded_rectangle(xy, radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fill="#0c2a4d", f=None, anchor=None):
    draw.text(xy, value, fill=fill, font=f or font(16), anchor=anchor)


def text_size(draw, value, f):
    return draw.textlength(value, font=f)


def wrap(draw, value, max_width, f):
    lines = []
    current = ""
    for char in value:
        test = current + char
        if draw.textlength(test, font=f) <= max_width or not current:
            current = test
        else:
            lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def paragraph(draw, xy, value, max_width, f=None, fill="#6b7a8f", leading=6):
    f = f or font(13)
    x, y = xy
    for line in wrap(draw, value, max_width, f):
        text(draw, (x, y), line, fill=fill, f=f)
        y += f.size + leading
    return y


def card_bg(draw, x, y, w, h, theme, radius=14, border=True, shadow=True):
    """Draw a glassmorphism white card matching the extension UI."""
    t = THEMES[theme]
    if shadow:
        shadow_color = (210, 215, 225)
        draw.rounded_rectangle(
            (x + 6, y + 8, x + w + 6, y + h + 8),
            radius,
            fill=shadow_color,
            outline=None,
            width=0,
        )
    rounded_rect(draw, (x, y, x + w, y + h), COLORS["white"], radius=radius)
    if border:
        draw.rounded_rectangle(
            (x, y, x + w, y + h),
            radius,
            outline="#e0e0e0",
            width=1,
        )


def paste_real_popup(img, x, y, page, lang, scale=0.8, radius=20):
    """Paste a REAL captured popup screenshot (scripts/captured/popup-{page}-{lang}.png)
    onto the canvas at (x, y), scaled, with a soft shadow and rounded corners."""
    src = CAPTURED / f"popup-{page}-{lang}.png"
    if not src.exists():
        raise FileNotFoundError(f"Missing captured popup: {src}")
    popup = Image.open(src).convert("RGB")
    w = round(REAL_W * scale)
    h = round(REAL_H * scale)
    popup = popup.resize((w, h), Image.LANCZOS)

    # soft drop shadow on a transparent overlay, composited onto the RGB canvas
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(layer)
    for i in range(6, 0, -1):
        a = 8 + (6 - i) * 5
        sd.rounded_rectangle(
            (x + i, y + i + 4, x + w + i, y + h + i + 4),
            radius, fill=(70, 90, 120, a),
        )
    img.paste(layer, (0, 0), layer)

    # rounded-corner mask so the popup reads as a card, not a raw rectangle
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius, fill=255)
    img.paste(popup, (x, y), mask)

    # thin white border to separate the popup from the gradient background
    ImageDraw.Draw(img).rounded_rectangle(
        (x, y, x + w, y + h), radius, outline="#ffffff", width=2,
    )


def feature_card(draw, x, y, w, h, emoji, title, desc, theme, lang="zh"):
    """Promotional feature card matching the extension glass card style.
    Icon circle is vertically centered and the emoji is centered inside it."""
    t = THEMES[theme]
    card_bg(draw, x, y, w, h, theme, radius=16, border=True, shadow=True)
    ic = 40
    ix, iy = x + 20, y + (h - ic) // 2
    draw.ellipse((ix, iy, ix + ic, iy + ic), fill=t["primary"])
    text(draw, (ix + ic // 2, iy + ic // 2), emoji,
         f=emoji_font(20), fill="white", anchor="mm")
    tx = ix + ic + 16
    avail = w - (tx - x) - 16
    text(draw, (tx, y + 20), title, f=font(18, bold=True), fill=t["text"])
    paragraph(draw, (tx, y + 46), desc, avail, f=font(13), fill=t["muted"], leading=5)


def hero_title(draw, title, subtitle, theme="default"):
    """Top banner for store screenshots."""
    t = THEMES[theme]
    rounded_rect(draw, (56, 48, 1224, 180), t["primary"], radius=24, outline=t["text"], width=5)
    text(draw, (88, 70), title, fill="white", f=font(54, bold=True))
    text(draw, (90, 136), subtitle, fill="white", f=font(22))


def screenshot_1(lang="zh", theme="pink"):
    """Water reminder - drink page mock."""
    img, draw = base_bg(W, H, theme)
    if lang == "zh":
        hero_title(draw, "喝水提醒", "定时提醒喝水，一键打卡，养成充足饮水习惯", theme=theme)
    else:
        hero_title(draw, "Water Reminder", "Timed reminders, one-tap check-in, stay hydrated", theme=theme)

    paste_real_popup(img, 70, 200, "drink", lang, scale=0.8)

    if lang == "zh":
        cards = [
            ("⏰", "自定义间隔", "15/30/45/60 分钟或自定义提醒间隔"),
            ("🔔", "弹窗通知", "到点自动弹出通知，提醒喝水"),
            ("📊", "饮水统计", "今日/本周/本月饮水次数一目了然"),
            ("⌨️", "Enter 打卡", "按 Enter 键快速记录喝水"),
        ]
    else:
        cards = [
            ("⏰", "Custom Interval", "15/30/45/60 min or custom"),
            ("🔔", "Popup Notification", "Get notified when it's time"),
            ("📊", "Drink Stats", "Today / week / month counts"),
            ("⌨️", "Enter to Check In", "Press Enter to log quickly"),
        ]
    for i, (emoji, title, desc) in enumerate(cards):
        row, col = i // 2, i % 2
        fx = 524 + col * 380
        fy = 226 + row * 130
        feature_card(draw, fx, fy, 350, 110, emoji, title, desc, theme, lang=lang)

    img.save(OUT / lang / "screenshot-01-water.png")


def screenshot_2(lang="zh", theme="eat"):
    """Diet tracking - eat page mock."""
    img, draw = base_bg(W, H, theme)
    if lang == "zh":
        hero_title(draw, "饮食记录", "记录三餐与加餐，评分、标签、饱腹感全记录", theme=theme)
    else:
        hero_title(draw, "Diet Tracker", "Log meals, rate food, tag cuisine, track fullness", theme=theme)

    paste_real_popup(img, 70, 200, "eat", lang, scale=0.8)

    if lang == "zh":
        cards = [
            ("🏷️", "快捷标签", "中式、西式、日式、油腻、素食等"),
            ("⭐", "五档评分", "菜品好吃程度 1-5 星记录"),
            ("🍽️", "饱腹感", "很饿到很撑五档记录"),
            ("📈", "饮食统计", "本周/本月评分与餐次分布"),
        ]
    else:
        cards = [
            ("🏷️", "Quick Tags", "Chinese, Western, Japanese, etc."),
            ("⭐", "5-Star Rating", "Rate how good the food was"),
            ("🍽️", "Fullness Scale", "From starving to very full"),
            ("📈", "Diet Stats", "Weekly and monthly stats"),
        ]
    for i, (emoji, title, desc) in enumerate(cards):
        row, col = i // 2, i % 2
        fx = 524 + col * 380
        fy = 226 + row * 130
        feature_card(draw, fx, fy, 350, 110, emoji, title, desc, theme, lang=lang)

    img.save(OUT / lang / "screenshot-02-diet.png")


def screenshot_3(lang="zh", theme="poop"):
    """Bathroom tracker - poop and pee."""
    img, draw = base_bg(W, H, theme)
    if lang == "zh":
        hero_title(draw, "排便 & 排尿", "Bristol 分型、尿量颜色、健康评估", theme=theme)
    else:
        hero_title(draw, "Bowel & Bladder", "Bristol scale, urine color, health insights", theme=theme)

    paste_real_popup(img, 50, 200, "poop", lang, scale=0.78)
    paste_real_popup(img, 320, 200, "pee", lang, scale=0.78)

    if lang == "zh":
        cards = [
            ("💩", "Bristol 量表", "7 级分型评估"),
            ("💧", "尿液颜色", "透明到异常色"),
            ("📅", "历史日历", "趋势与规律"),
            ("📊", "健康统计", "理想型与间隔"),
        ]
    else:
        cards = [
            ("💩", "Bristol Scale", "7-type assessment"),
            ("💧", "Urine Color", "Clear to abnormal colors"),
            ("📅", "History Calendar", "Trends and patterns"),
            ("📊", "Health Stats", "Stats and intervals"),
        ]
    for i, (emoji, title, desc) in enumerate(cards):
        fx = 706 + (i % 2) * 284
        fy = 220 + (i // 2) * 140
        feature_card(draw, fx, fy, 270, 120, emoji, title, desc, theme, lang=lang)

    img.save(OUT / lang / "screenshot-03-bathroom.png")


def screenshot_4(lang="zh", theme="period"):
    """Period tracking - calendar and mood."""
    img, draw = base_bg(W, H, theme)
    if lang == "zh":
        hero_title(draw, "经期记录", "日历视图、情绪症状、周期规律分析", theme=theme)
    else:
        hero_title(draw, "Period Tracker", "Calendar view, mood, symptoms, cycle analysis", theme=theme)

    paste_real_popup(img, 70, 200, "period", lang, scale=0.8)

    if lang == "zh":
        cards = [
            ("📅", "日历视图", "直观展示经期分布与周期"),
            ("😊", "情绪症状", "记录每日情绪与身体状态"),
            ("📊", "周期分析", "柱状图分析周期长度与规律"),
            ("🔔", "智能提醒", "经期、吃药、运动自定义提醒"),
        ]
    else:
        cards = [
            ("📅", "Calendar View", "Visual period distribution and cycle"),
            ("😊", "Mood & Symptoms", "Log daily mood and physical state"),
            ("📊", "Cycle Analysis", "Bar charts for cycle length & patterns"),
            ("🔔", "Smart Reminders", "Period, meds, exercise reminders"),
        ]
    for i, (emoji, title, desc) in enumerate(cards):
        row, col = i // 2, i % 2
        fx = 524 + col * 380
        fy = 226 + row * 130
        feature_card(draw, fx, fy, 350, 110, emoji, title, desc, theme, lang=lang)

    img.save(OUT / lang / "screenshot-04-period.png")


def screenshot_5(lang="zh", theme="default"):
    """Themes, languages, shortcuts, and privacy."""
    img, draw = base_bg(W, H, theme)
    if lang == "zh":
        hero_title(draw, "个性化 & 隐私", "多主题、中英双语、Enter 快捷、数据本地保存", theme=theme)
    else:
        hero_title(draw, "Personalize & Privacy", "Themes, bilingual, Enter shortcut, local-only data", theme=theme)

    paste_real_popup(img, 70, 200, "settings", lang, scale=0.8)

    if lang == "zh":
        cards = [
            ("🎨", "多主题风格", "默认蓝调、少女粉、暗色、森林绿"),
            ("🌐", "中英双语", "一键切换简体中文/English"),
            ("⌨️", "Enter 快捷打卡", "任意模块按 Enter 快速记录"),
            ("🔒", "本地存储", "无需联网、无需注册、保护隐私"),
        ]
    else:
        cards = [
            ("🎨", "Multiple Themes", "Default blue, pink, dark, forest green"),
            ("🌐", "Bilingual", "Switch 简体中文 / English"),
            ("⌨️", "Enter Shortcut", "Press Enter to check in from any module"),
            ("🔒", "Local Storage", "No internet, no sign-up, fully private"),
        ]
    for i, (emoji, title, desc) in enumerate(cards):
        row, col = i // 2, i % 2
        fx = 524 + col * 380
        fy = 226 + row * 130
        feature_card(draw, fx, fy, 350, 110, emoji, title, desc, theme, lang=lang)

    img.save(OUT / lang / "screenshot-05-personalize.png")


def promo_tile_440x280():
    """Small bilingual promotional tile (440x280) with a real popup on the left."""
    w, h = 440, 280
    theme = "default"
    t = THEMES[theme]
    img, draw = base_bg(w, h, theme)

    cx, cy, cw, ch = 24, 24, 392, 232
    card_bg(draw, cx, cy, cw, ch, theme, radius=20, border=True, shadow=True)

    # real popup (drink / zh) scaled to fit the card height on the left
    paste_real_popup(img, cx + 18, cy + 18, "drink", "zh", scale=196 / REAL_H, radius=14)

    # bilingual title block on the right
    tx = cx + 18 + 90 + 18
    text(draw, (tx, cy + 58), "Daily Tracker", f=font(24, bold=True), fill=t["text"])
    text(draw, (tx, cy + 90), "每日记录", f=font(16, bold=True), fill=t["muted"])
    text(draw, (tx, cy + 122), "喝水·饮食·排便·排尿·经期", f=font(12), fill=t["text"])
    text(draw, (tx, cy + 144), "Water·Diet·Bowel·Bladder·Period", f=font(10), fill=t["muted"])

    img.save(PROMO_OUT / "promo-tile-440x280.png")


def marquee_1400x560():
    """Top bilingual promotional banner (1400x560) with a real popup on the left."""
    w, h = 1400, 560
    theme = "default"
    t = THEMES[theme]
    img, draw = base_bg(w, h, theme)

    # realistic popup mock on the left
    paste_real_popup(img, 70, 70, "drink", "zh", scale=0.66)

    # bilingual title block on the right
    text(draw, (520, 90), "Daily Tracker", f=font(54, bold=True), fill=t["text"])
    text(draw, (520, 152), "每日记录", f=font(28, bold=True), fill=t["muted"])

    subtitle_en = "Simple daily health tracking: water, diet, bowel, bladder, period"
    subtitle_zh = "简单记录每日健康：喝水、饮食、排便、排尿、经期"
    text(draw, (520, 200), subtitle_en, f=font(20), fill=t["muted"])
    text(draw, (520, 230), subtitle_zh, f=font(18), fill=t["muted"])

    # 2x2 bilingual feature cards
    cards = [
        ("⏰", "Timed Reminders / 定时提醒", "Custom interval popups / 自定义间隔弹窗"),
        ("⌨️", "Enter Shortcut / 快捷打卡", "One-tap quick log / 一键快速记录"),
        ("🌐", "Bilingual / 中英双语", "简体中文 / English"),
        ("🔒", "Local Privacy / 本地隐私", "Data stays on device / 数据不上传"),
    ]
    for i, (emoji, title, desc) in enumerate(cards):
        row, col = i // 2, i % 2
        fx = 520 + col * 430
        fy = 280 + row * 130
        feature_card(draw, fx, fy, 410, 110, emoji, title, desc, theme, lang="zh")

    img.save(PROMO_OUT / "marquee-1400x560.png")


def main():
    for lang in ["zh", "en"]:
        (OUT / lang).mkdir(parents=True, exist_ok=True)

    for lang in ["zh", "en"]:
        screenshot_1(lang=lang)
        screenshot_2(lang=lang)
        screenshot_3(lang=lang)
        screenshot_4(lang=lang)
        screenshot_5(lang=lang)

    promo_tile_440x280()
    marquee_1400x560()

    print(f"Generated screenshots in {OUT}")
    print(f"Generated bilingual promo images in {PROMO_OUT}")


if __name__ == "__main__":
    main()
