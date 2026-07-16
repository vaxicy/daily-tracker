#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Programmatic QA for store assets: blank-check captured popups + boundary overflow."""
from PIL import Image
import glob, os

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

print("== captured popup variety (unique colors, expect >2000) ==")
for p in sorted(glob.glob("scripts/captured/*.png")):
    im = Image.open(p).convert("RGB")
    n = len(im.getcolors(maxcolors=1000000) or [])
    flag = "OK" if n > 2000 else "BLANK?"
    print(f"{os.path.basename(p):28s} colors={n} {flag}")

print("\n== boundary overflow scan (dark pixels in bottom/right 12px) ==")
def scan(path, W, H):
    im = Image.open(path).convert("RGB")
    px = im.load()
    bad = 0
    for y in range(H - 12, H):
        for x in range(W):
            if lum(px[x, y]) < 90:
                bad += 1
    for x in range(W - 12, W):
        for y in range(H):
            if lum(px[x, y]) < 90:
                bad += 1
    return bad

outs = [(p, 1280, 800) for p in glob.glob("store-assets/screenshots/**/*.png", recursive=True)]
outs += [("store-assets/promo/marquee-1400x560.png", 1400, 560),
         ("store-assets/promo/promo-tile-440x280.png", 440, 280)]
allok = True
for p, W, H in outs:
    c = scan(p, W, H)
    ok = c == 0
    allok = allok and ok
    print(f"{p:55s} dark_edge_px={c} {'OK' if ok else 'CHECK'}")
print("\nALL_OK" if allok else "\nSOME_CHECK")
