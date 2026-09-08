#!/usr/bin/env python3
"""Compose screenshot-05-personalize.png (zh + en) matching the style of the
other 4 store screenshots: real popup capture on the left + rounded banner +
2x2 feature cards on the right.

Layout parameters were measured from screenshot-01-water.png (grid overlay):
- banner: (45,40)-(1035,152), fill #0B6BFF, radius ~22
- popup capture: x=48, y=173, width=214 (real capture 320x700 scaled)
- cards: 355x94, cols x=305/680, rows y=192/300, radius 16
"""
import os
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def save_retry(img, path, tries=8):
    """Windows intermittently raises OSError 22 on write (file briefly locked)."""
    last = None
    for _ in range(tries):
        try:
            img.save(path, "PNG")
            return
        except OSError as e:
            last = e
            time.sleep(0.6)
    raise last

# Relative paths only: the runner sets cwd to the project root, so every
# path handed to open() is pure ASCII (Windows non-ASCII absolute paths
# intermittently fail with OSError 22 in save()).
OUT_DIR = os.path.join("store-assets", "screenshots")
CAP_DIR = os.path.join("scripts", "captured")

W, H = 1280, 800
ACCENT = (11, 107, 255)
TITLE_C = (24, 50, 90)
SUB_C = (100, 118, 145)
BG_TOP = (233, 244, 255)
BG_BOT = (218, 234, 255)

BANNER = (45, 40, 1035, 152)
# popup region matches screenshots 01-04 (measured from screenshot-01 grid)
POPUP_X, POPUP_Y, POPUP_W = 70, 200, 232
CARD_W, CARD_H = 355, 94
CARD_COLS = (305, 680)
CARD_ROWS = (192, 300)


def font(size, bold=False):
    cands = [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
             r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
    for c in cands:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def fit_font(draw, s, size, bold, max_w):
    """shrink font until text fits max_w"""
    while size > 12:
        f = font(size, bold)
        b = draw.textbbox((0, 0), s, font=f)
        if b[2] - b[0] <= max_w:
            return f
        size -= 1
    return font(size, bold)


def rounded_shadow(base, box, radius, blur, alpha, offset=(0, 8)):
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]],
                        radius=radius, fill=(20, 40, 80, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(overlay)


def paste_rounded(base, img, xy, radius):
    """paste img (RGB) with rounded-corner mask + soft shadow"""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    rounded_shadow(base, (xy[0], xy[1], xy[0] + w, xy[1] + h), radius, 14, 70)
    base.paste(img, xy, mask)


# ---- simple white Material-ish icons drawn with PIL primitives ----
def icon_apps(d, cx, cy):
    r, g = 5, 4
    for dx in (-1, 1):
        for dy in (-1, 1):
            x0 = cx + dx * g - r
            y0 = cy + dy * g - r
            d.rounded_rectangle([x0, y0, x0 + 2 * r, y0 + 2 * r], radius=2, fill=(255, 255, 255))


def icon_globe(d, cx, cy):
    r = 11
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255), width=2)
    d.line([cx - r, cy, cx + r, cy], fill=(255, 255, 255), width=2)
    d.ellipse([cx - 4.5, cy - r, cx + 4.5, cy + r], outline=(255, 255, 255), width=2)


def icon_enter(d, cx, cy):
    # keyboard_return style: horizontal line with left arrow + top-right stub
    d.line([cx + 10, cy - 6, cx + 10, cy + 2], fill=(255, 255, 255), width=2)
    d.line([cx + 10, cy + 2, cx - 8, cy + 2], fill=(255, 255, 255), width=2)
    d.line([cx - 4, cy - 3, cx - 9, cy + 2], fill=(255, 255, 255), width=2)
    d.line([cx - 4, cy + 7, cx - 9, cy + 2], fill=(255, 255, 255), width=2)


def icon_lock(d, cx, cy):
    d.arc([cx - 7, cy - 10, cx + 7, cy + 2], start=180, end=360, fill=(255, 255, 255), width=2)
    d.rounded_rectangle([cx - 9, cy - 2, cx + 9, cy + 11], radius=3, fill=(255, 255, 255))


ICONS = {"apps": icon_apps, "globe": icon_globe, "enter": icon_enter, "lock": icon_lock}

CONTENT = {
    "zh": {
        "title": "个性化 & 隐私",
        "subtitle": "30 款主题、六语界面、Enter 快捷、数据本地保存",
        "cards": [
            ("多主题风格", "30 款主题一键切换", "apps"),
            ("六语界面", "中 / 英 / 西 / 日 / 韩 / 法", "globe"),
            ("Enter 快捷打卡", "任一模块按 Enter 直接记录", "enter"),
            ("本地存储", "无感联网，隐私自己掌控", "lock"),
        ],
    },
    "en": {
        "title": "Personalize & Privacy",
        "subtitle": "30 themes, six languages, Enter shortcut, all data stays local",
        "cards": [
            ("Many Themes", "30 themes, one tap away", "apps"),
            ("Six Languages", "ZH / EN / ES / JA / KO / FR", "globe"),
            ("Enter Shortcut", "Log in any module with Enter", "enter"),
            ("Local Storage", "No internet, data stays local", "lock"),
        ],
    },
}


def compose(lang):
    c = CONTENT[lang]
    img = Image.new("RGBA", (W, H), BG_TOP + (255,))
    d = ImageDraw.Draw(img)
    # vertical gradient bg
    for y in range(H):
        t = y / H
        col = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=col + (255,))

    # banner
    d.rounded_rectangle(BANNER, radius=22, fill=ACCENT)
    bx, by = BANNER[0] + 32, BANNER[1]
    ft = fit_font(d, c["title"], 42, True, 640)
    d.text((bx, by + 18), c["title"], font=ft, fill=(255, 255, 255))
    fs = fit_font(d, c["subtitle"], 19, False, 700)
    d.text((bx, by + 76), c["subtitle"], font=fs, fill=(225, 236, 255))

    # popup capture (real UI) on the left, rounded + shadow
    cap_path = os.path.join(CAP_DIR, f"popup-drink-{lang}.png")
    cap = Image.open(cap_path).convert("RGB")
    scale = POPUP_W / cap.width
    cap = cap.resize((POPUP_W, int(cap.height * scale)), Image.LANCZOS)
    paste_rounded(img, cap, (POPUP_X, POPUP_Y), radius=14)

    # 4 feature cards
    for i, (t, s, ic) in enumerate(c["cards"]):
        row, col = divmod(i, 2)
        x = CARD_COLS[col]
        y = CARD_ROWS[row]
        box = (x, y, x + CARD_W, y + CARD_H)
        rounded_shadow(img, box, 16, 10, 45, offset=(0, 6))
        dd = ImageDraw.Draw(img)
        dd.rounded_rectangle(box, radius=16, fill=(255, 255, 255, 255))
        # icon circle
        ccx, ccy = x + 38, y + CARD_H // 2
        dd.ellipse([ccx - 19, ccy - 19, ccx + 19, ccy + 19], fill=ACCENT)
        ICONS[ic](dd, ccx, ccy)
        # texts
        dd.text((x + 68, y + 20), t, font=font(19, True), fill=TITLE_C)
        dd.text((x + 68, y + 52), s, font=font(14), fill=SUB_C)
    img = img.convert("RGB")

    out = os.path.join(OUT_DIR, lang, "screenshot-05-personalize.png")
    save_retry(img, out)
    print("wrote", out, img.size, img.mode)


def main():
    for lang in ("zh", "en"):
        compose(lang)
    print("ALL DONE")


if __name__ == "__main__":
    main()
