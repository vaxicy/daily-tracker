#!/usr/bin/env python3
"""Patch screenshot-03-bathroom: two side-by-side popups (poop + pee)
on a tall banner. Different composition than 01/02/04 (no 2x2 cards).
"""
import os
import time
from PIL import Image, ImageDraw, ImageFilter

CAP_DIR = os.path.join("scripts", "captured")
OUT_DIR = os.path.join("store-assets", "screenshots")
BG_TOP = (233, 244, 255)
BG_BOT = (218, 234, 255)

# Measured from original 03 grid crop
LEFT_X, LEFT_Y, LEFT_W, POPUP_H = 60, 200, 240, 560
RIGHT_X = 315
PAD = 24


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


def paste_capture(base, lang, module, x, y, w, h):
    cap = Image.open(os.path.join(CAP_DIR, f"popup-{module}-{lang}.png")).convert("RGB")
    scale = w / cap.width
    new_h = round(cap.height * scale)
    if new_h > h:
        cap = cap.crop((0, 0, w, round(h / scale)))
        new_h = h
    cap = cap.resize((w, new_h), Image.LANCZOS)

    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y, x + w, y + new_h], radius=14, fill=(20, 40, 80, 75))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    base_rgba = base.convert("RGBA")
    base_rgba.alpha_composite(sh)
    base = base_rgba.convert("RGB")

    mask = Image.new("L", (w, new_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, new_h - 1], radius=14, fill=255)
    base.paste(cap, (x, y), mask)
    return base


def main():
    for lang in ("zh", "en"):
        out = os.path.join(OUT_DIR, lang, "screenshot-03-bathroom.png")
        base = Image.open(out).convert("RGB")
        # clear both popup regions + halo
        paint_bg_strip(base, (LEFT_X - PAD, LEFT_Y - PAD, RIGHT_X + 260 + PAD, LEFT_Y + POPUP_H + PAD))
        # left: poop, right: pee
        base = paste_capture(base, lang, "poop", LEFT_X, LEFT_Y, LEFT_W, POPUP_H)
        base = paste_capture(base, lang, "pee", RIGHT_X, LEFT_Y, 250, POPUP_H)
        save_retry(base, out)
        print("patched", out)
    print("ALL DONE")


if __name__ == "__main__":
    main()
