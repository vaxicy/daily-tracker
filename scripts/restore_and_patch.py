#!/usr/bin/env python3
"""Restore screenshots 01-04 to their pre-today state (theme-colored bgs,
original compositions), then replace only the popup region with the freshly
captured popup (properly centered dots, no overlap).

The new capture is 320x810 (dots clear of content); it is scaled to fit the
original popup bbox. Run with cwd = project root.
"""
import os
import subprocess
import time
from PIL import Image, ImageDraw, ImageFilter

CAP_DIR = os.path.join("scripts", "captured")
OUT_DIR = os.path.join("store-assets", "screenshots")
REF_COMMIT = "c675ce7"  # last commit before today's screenshot patches

# Original popup bbox in the composed screenshots (measured from git originals)
# New captures are 320x810 (taller aspect 0.395 vs old 0.457); scale to fit
# height 540 so the popup bottom stays ~60px above the canvas edge.
POPUP_X, POPUP_Y, POPUP_W, POPUP_H = 81, 200, 213, 540

MAP = [
    ("01-water", "drink"),
    ("02-diet", "eat"),
    ("03-bathroom", "poop"),
    ("04-period", "period"),
]


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


def git_restore(path):
    r = subprocess.run(["git", "show", f"{REF_COMMIT}:{path}"],
                       capture_output=True, cwd=".")
    if r.returncode != 0:
        raise RuntimeError(f"git show failed for {path}: {r.stderr.decode()}")
    return r.stdout  # PNG bytes


def paste_popup(base, lang, module):
    cap = Image.open(os.path.join(CAP_DIR, f"popup-{module}-{lang}.png")).convert("RGB")
    # fit height, derive width (new capture is taller aspect)
    scale = POPUP_H / cap.height
    new_w = round(cap.width * scale)
    cap = cap.resize((new_w, POPUP_H), Image.LANCZOS)

    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [POPUP_X, POPUP_Y, POPUP_X + new_w, POPUP_Y + POPUP_H], radius=14, fill=(20, 40, 80, 75))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    base_rgba = base.convert("RGBA")
    base_rgba.alpha_composite(sh)
    base = base_rgba.convert("RGB")

    mask = Image.new("L", (new_w, POPUP_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, new_w - 1, POPUP_H - 1], radius=14, fill=255)
    base.paste(cap, (POPUP_X, POPUP_Y), mask)
    return base


def main():
    for lang in ("zh", "en"):
        for suffix, module in MAP:
            rel = f"store-assets/screenshots/{lang}/screenshot-{suffix}.png"
            # restore original from git
            png_bytes = git_restore(rel)
            import io
            base = Image.open(io.BytesIO(png_bytes)).convert("RGB")
            # replace popup region with new capture
            base = paste_popup(base, lang, module)
            save_retry(base, rel)
            print("restored+patched", rel)
    print("ALL DONE")


if __name__ == "__main__":
    main()
