#!/usr/bin/env python3
"""Regenerate store-assets screenshot-05-personalize.png (zh + en) using PIL.

The original was a one-off HTML→PNG mockup. The copy inside was outdated
(mentioned 4 themes and bilingual); this script re-renders a similar
composition with the current state: 30 themes, 6 languages, Enter shortcut,
local-only privacy.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "store-assets", "screenshots")

W, H = 1280, 800
NAVY = (24, 50, 90)
BANNER = (29, 78, 216)         # primary blue
BG = (224, 234, 252)           # light blue canvas
CARD = (255, 255, 255)
ICON_BG = (29, 78, 216)
TEXT = (24, 50, 90)
SUB = (90, 110, 140)
ACCENT = (11, 107, 255)


def find_font(size, bold=False, latin=False):
    """Return a font path. latin=True prefers Arial for English/digit clarity."""
    if latin:
        cands = [r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
                 r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
                 r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"]
    else:
        cands = [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
                 r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


def text_w(draw, s, font):
    b = draw.textbbox((0, 0), s, font=font)
    return b[2] - b[0], b[3] - b[1]


def draw_text(draw, xy, s, font, fill):
    draw.text(xy, s, font=font, fill=fill)


def center_x(draw, s, font, cx, fill):
    w, _ = text_w(draw, s, font)
    draw.text((cx - w // 2, _[0] if False else xy[1]), s, font=font, fill=fill)


# ---- per-language content ----
CONTENT = {
    "zh": {
        "title": "个性化 & 隐私",
        "subtitle": "30 款主题、六语界面、Enter 快捷、数据本地保存",
        "cards": [
            ("多主题风格", "default 蓝调、少女粉、森林绿…", "彩"),
            ("六语界面", "中 / 英 / 西 / 日 / 韩 / 法", "语"),
            ("Enter 快捷打卡", "任一模块按 Enter 直接记录", "E"),
            ("本地存储", "无感联网，隐私自己掌控", "隐"),
        ],
    },
    "en": {
        "title": "Personalize & Privacy",
        "subtitle": "30 themes, six languages, Enter shortcut, all data stays local",
        "cards": [
            ("Many Themes", "30 themes incl. dark & xmas", "T"),
            ("Six Languages", "ZH / EN / ES / JA / KO / FR", "L"),
            ("Enter Shortcut", "Press Enter to log in any module", "E"),
            ("Local Storage", "No internet, your data stays put", "P"),
        ],
    },
}


def render(lang):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    f_title = find_font(54, bold=True)
    f_sub = find_font(24)
    f_card_t = find_font(28, bold=True)
    f_card_s = find_font(20)
    f_latin = find_font(48, bold=True, latin=True)

    # Top navy strip
    d.rectangle([0, 0, W, 14], fill=NAVY)

    # Banner (blue rounded)
    bx, by, bw, bh = 80, 60, W - 160, 110
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=18, fill=BANNER)
    draw_text(d, (bx + 32, by + 18), CONTENT[lang]["title"], f_title, (255, 255, 255))
    draw_text(d, (bx + 32, by + 78), CONTENT[lang]["subtitle"], f_sub, (220, 230, 255))

    # 2x2 cards
    cw, ch = 460, 120
    gx, gy = 80, 200
    gap_x, gap_y = 40, 24
    for i, (t, s, icon) in enumerate(CONTENT[lang]["cards"]):
        row, col = divmod(i, 2)
        x = gx + col * (cw + gap_x)
        y = gy + row * (ch + gap_y)
        d.rounded_rectangle([x, y, x + cw, y + ch], radius=14, fill=CARD)
        d.ellipse([x + 22, y + 22, x + 22 + 76, y + 22 + 76], fill=ICON_BG)
        # centered letter inside the circle (icon may be Chinese or Latin)
        icon_font = f_card_t if any('\u4e00' <= ch <= '\u9fff' for ch in icon) else f_latin
        iw, ih = text_w(d, icon, icon_font)
        draw_text(d, (x + 22 + 38 - iw // 2, y + 22 + 38 - ih // 2 - 6), icon, icon_font, (255, 255, 255))
        draw_text(d, (x + 120, y + 28), t, f_card_t, TEXT)
        draw_text(d, (x + 120, y + 70), s, f_card_s, SUB)

    # Drink page preview (left) — simple geometric mockup
    px, py, pw, ph = 80, 500, 320, 280
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=18, fill=(255, 255, 255))
    # header strip
    d.rounded_rectangle([px + 14, py + 14, px + pw - 14, py + 62], radius=10, fill=(240, 246, 255))
    draw_text(d, (px + 28, py + 26), "喝水提醒" if lang == "zh" else "Drink Reminder", f_card_t, TEXT)
    # timer card
    d.rounded_rectangle([px + 14, py + 72, px + pw - 14, py + 146], radius=10, fill=(240, 246, 255))
    f_big = find_font(40, bold=True, latin=True)
    draw_text(d, (px + 28, py + 84), "47:23", f_big, ACCENT)
    # toggle row
    d.rounded_rectangle([px + 14, py + 156, px + pw - 14, py + 196], radius=10, fill=(240, 246, 255))
    draw_text(d, (px + 28, py + 170), "开始提醒 / Running" if lang == "zh" else "Timer / Running", f_card_s, TEXT)
    # CTA + reset
    d.rounded_rectangle([px + 14, py + 206, px + 160, py + 250], radius=22, fill=ACCENT)
    draw_text(d, (px + 50, py + 216), "我喝了!" if lang == "zh" else "I drank!", f_card_t, (255, 255, 255))
    d.rounded_rectangle([px + 170, py + 206, px + pw - 14, py + 250], radius=22, fill=(228, 233, 245))
    draw_text(d, (px + 200, py + 216), "重置" if lang == "zh" else "Reset", f_card_t, SUB)
    # mini calendar header
    draw_text(d, (px + 28, py + 262), "2026 / 7" if lang == "zh" else "Jul 2026", f_card_s, ACCENT)
    return img


def main():
    for lang in ("zh", "en"):
        out = os.path.join(OUT_DIR, lang, "screenshot-05-personalize.png")
        img = render(lang)
        img.save(out, "PNG")
        # ensure RGB / 1280x800
        print("wrote", out, img.size, img.mode)
    print("ALL DONE")


if __name__ == "__main__":
    main()
