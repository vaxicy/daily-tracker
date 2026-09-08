#!/usr/bin/env python3
"""Re-capture the 12 real popup screenshots (6 views x zh/en) by loading the
actual extension in Playwright Chromium.

Fixes the store-capture defect: the old captures had the floating nav dots
overlapping the calendar and shifted right (crop artifact). Capturing the
extension page at viewport 320x700 with full_page=False keeps the fixed
bottom-nav centered, and the .page padding-bottom fix keeps content clear.

Run with cwd = project root. Writes scripts/captured/popup-<view>-<lang>.png
(relative ASCII paths only).
"""
import os
import sys
import tempfile
from playwright.sync_api import sync_playwright

OUT_DIR = os.path.join("scripts", "captured")
W, H = 320, 810  # content ~777px tall (+44px nav clearance); dots pin to viewport bottom

MODULES = ["eat", "drink", "poop", "pee", "period"]
LANGS = ["zh", "en"]


def main():
    ext_path = os.getcwd()  # project root = extension root
    user_data = tempfile.mkdtemp(prefix="dt_capture_profile_")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data,
            headless=False,  # extensions require headed chromium
            args=[
                f"--disable-extensions-except={ext_path}",
                f"--load-extension={ext_path}",
                "--window-position=2000,0",  # move window off to the side
                "--window-size=340,760",
            ],
        )
        # MV3 service worker carries the extension id
        if ctx.service_workers:
            sw = ctx.service_workers[0]
        else:
            sw = ctx.wait_for_event("serviceworker", timeout=15000)
        ext_id = sw.url.split("/")[2]
        print("extension id:", ext_id)

        page = ctx.new_page()
        page.set_viewport_size({"width": W, "height": H})

        for lang in LANGS:
            url = f"chrome-extension://{ext_id}/popup.html"
            page.goto(url, wait_until="load")
            # persist language then reload so I18N applies
            page.evaluate(f"chrome.storage.local.set({{language: '{lang}'}})")
            page.reload(wait_until="load")
            page.wait_for_timeout(600)
            sw_id = page.evaluate("document.documentElement.scrollWidth")
            sh_id = page.evaluate("document.documentElement.scrollHeight")
            print(f"[{lang}] document scroll {sw_id}x{sh_id} (viewport {W}x{H})")
            page.evaluate("window.scrollTo(0, 0)")

            for module in MODULES:
                page.click(f"#nav{module.capitalize()}")
                page.wait_for_timeout(500)  # page transition + theme transitions
                png = page.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
                out = os.path.join(OUT_DIR, f"popup-{module}-{lang}.png")
                with open(out, "wb") as f:
                    f.write(png)
                print("wrote", out)

            # settings: open the sidebar
            page.click("#sidebarToggleBtn")
            page.wait_for_timeout(600)  # slide-in transition
            png = page.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
            out = os.path.join(OUT_DIR, f"popup-settings-{lang}.png")
            with open(out, "wb") as f:
                f.write(png)
            print("wrote", out)
            page.click("#sidebarCloseBtn")
            page.wait_for_timeout(300)

        ctx.close()
    print("ALL DONE")


if __name__ == "__main__":
    sys.exit(main())
