#!/usr/bin/env python3
"""Unify all 5 store screenshots' canvas bg to the same light-blue vertical
gradient (BG_TOP 233,244,255 -> BG_BOT 218,234,255), preserving banner, cards,
and popup regions by NOT repainting non-bg pixels (theme-tinted bg, banner,
card-white, popup) — only the canvas bg tint is replaced.

Run with cwd = project root. Saves store-assets/screenshots/<lang>/<file>.
"""
import os
import time
from PIL import Image, ImageDraw

BG_TOP = (233, 244, 255)
BG_BOT = (218, 234, 255)
# tolerance: pixel is "bg tint" if within this distance of a corner sample
TOL = 16


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


def near_bg(c, refs, tol):
    for r in refs:
        if all(abs(c[i] - r[i]) <= tol for i in range(3)):
            return True
    return False


def repaint_bg(im, refs):
    """In-place: replace pixels near any of `refs` with blue gradient at row."""
    w, h = im.size
    # build a gradient LUT: per-row blue color
    rows = [tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * (y / max(1, h - 1))) for i in range(3)) for y in range(h)]
    px = im.load()
    for y in range(h):
        c = rows[y]
        for x in range(w):
            if near_bg(px[x, y], refs, TOL):
                px[x, y] = c


def main():
    files = ["screenshot-01-water.png", "screenshot-02-diet.png",
             "screenshot-03-bathroom.png", "screenshot-04-period.png",
             "screenshot-05-personalize.png"]
    for lang in ("zh", "en"):
        for fn in files:
            path = os.path.join("store-assets", "screenshots", lang, fn)
            im = Image.open(path).convert("RGB")
            # sample 3 corner regions to capture the bg color(s) for this image
            w, h = im.size
            refs = []
            for (x, y) in [(8, h - 8), (w - 8, h - 8), (w - 8, 200), (8, h // 2)]:
                refs.append(im.getpixel((x, y)))
            repaint_bg(im, refs)
            save_retry(im, path)
            print("unified", path, "refs=", refs)
    print("ALL DONE")


if __name__ == "__main__":
    main()
