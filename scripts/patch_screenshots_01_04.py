#!/usr/bin/env python3
"""Patch store screenshots 01-04: replace the popup region with the fresh
capture (properly centered dots, padded bottom). Preserves banner + cards.

Run with cwd = project root.
"""
import os
import time
from PIL import Image, ImageDraw, ImageFilter


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

CAP_DIR = os.path.join("scripts", "captured")
OUT_DIR = os.path.join("store-assets", "screenshots")

POPUP_X, POPUP_Y, POPUP_W = 70, 200, 232
POPUP_H_MAX = 587  # canvas y-limit
PAD = 24
BG_TOP = (233, 244, 255)
BG_BOT = (218, 234, 255)

# mapping: screenshot filename suffix -> capture module
MAP = [
    ("01-water", "drink"),
    ("02-diet", "eat"),
    ("03-bathroom", "poop"),
    ("04-period", "period"),
]


def paint_bg_strip(base, box):
    x0, y0, x1, y1 = box
    overlay = Image.new("RGB", (x1 - x0, y1 - y0), BG_TOP)
    d = ImageDraw.Draw(overlay)
    h = y1 - y0
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (x1 - x0, y)], fill=c)
    base.paste(overlay, (x0, y0))


def paste_popup(base, lang, module):
    cap = Image.open(os.path.join(CAP_DIR, f"popup-{module}-{lang}.png")).convert("RGB")
    scale = POPUP_W / cap.width
    new_h = round(cap.height * scale)
    if new_h > POPUP_H_MAX:
        cap = cap.crop((0, 0, POPUP_W, round(POPUP_H_MAX / scale)))
        new_h = POPUP_H_MAX
    cap = cap.resize((POPUP_W, new_h), Image.LANCZOS)

    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [POPUP_X, POPUP_Y, POPUP_X + POPUP_W, POPUP_Y + new_h], radius=14, fill=(20, 40, 80, 75))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    base_rgba = base.convert("RGBA")
    base_rgba.alpha_composite(sh)
    base = base_rgba.convert("RGB")

    mask = Image.new("L", (POPUP_W, new_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, POPUP_W - 1, new_h - 1], radius=14, fill=255)
    base.paste(cap, (POPUP_X, POPUP_Y), mask)
    return base  # convert() rebound the local name; caller must take the result


def main():
    for lang in ("zh", "en"):
        for suffix, module in MAP:
            out = os.path.join(OUT_DIR, lang, f"screenshot-{suffix}.png")
            base = Image.open(out).convert("RGB")
            paint_bg_strip(base, (POPUP_X - PAD, POPUP_Y - PAD,
                                    POPUP_X + POPUP_W + PAD, POPUP_Y + POPUP_H_MAX + PAD))
            base = paste_popup(base, lang, module)
            save_retry(base, out)
            print("patched", out)
    print("ALL DONE")


if __name__ == "__main__":
    main()
