#!/usr/bin/env python3
"""Package the Daily Habit Tracker extension into a Chrome Web Store zip.

Rules followed:
- manifest.json must live at the zip root (arcname = relative path).
- Only runtime files go in; store listing assets (screenshots/promo),
  scripts, working memory and unused fonts are excluded.
- The script self-validates before reporting success.
"""
import json
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Default folder is derived from the project location (portable, no hardcoded Chinese path).
DEFAULT_OUT = os.path.abspath(os.path.join(ROOT, os.pardir, os.pardir))

INCLUDE_FILES = [
    "manifest.json",
    "popup.html",
    "popup.js",
    "background.js",
    "i18n.js",
    "themes.js",
    "icon16.png",
    "icon48.png",
    "icon128.png",
    "donate-qr.png",
    "LICENSE",
    "README.md",
]
INCLUDE_DIRS = ["_locales"]

EXCLUDE_DIR_NAMES = {".git", ".codebuddy", "node_modules", "__pycache__"}
EXCLUDE_FILE_SUFFIX = (".zip", ".bak", ".pyc")


def build_zip(zip_path, version):
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in INCLUDE_FILES:
            src = os.path.join(ROOT, rel)
            if not os.path.exists(src):
                raise SystemExit("missing required file: " + rel)
            z.write(src, rel)  # arcname=rel -> root level
        for d in INCLUDE_DIRS:
            base = os.path.join(ROOT, d)
            for dirpath, dirnames, filenames in os.walk(base):
                dirnames[:] = [x for x in dirnames if x not in EXCLUDE_DIR_NAMES]
                for fn in sorted(filenames):
                    if fn.endswith(EXCLUDE_FILE_SUFFIX):
                        continue
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                    z.write(full, rel)
    return zip_path


def main():
    manifest_path = os.path.join(ROOT, "manifest.json")
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    # 1. manifest sanity
    assert manifest["manifest_version"] == 3, "manifest_version must be 3"
    version = manifest["version"]
    print("manifest version:", version)

    # 2. every file referenced by the manifest must exist
    refs = []
    refs += list(manifest.get("icons", {}).values())
    action = manifest.get("action", {})
    refs += list(action.get("default_icon", {}).values())
    if action.get("default_popup"):
        refs.append(action["default_popup"])
    if manifest.get("background", {}).get("service_worker"):
        refs.append(manifest["background"]["service_worker"])
    missing = [r for r in refs if not os.path.exists(os.path.join(ROOT, r))]
    assert not missing, "referenced files missing: %s" % missing

    # 3. build
    dist_dir = os.path.join(ROOT, "dist")
    os.makedirs(dist_dir, exist_ok=True)
    zip_name = "daily-tracker-%s.zip" % version
    zip_path = os.path.join(dist_dir, zip_name)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    build_zip(zip_path, version)

    # 4. validate the zip we just wrote
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        assert "manifest.json" in names, "manifest.json not at zip root"
        inside = json.loads(z.read("manifest.json").decode("utf-8"))
        assert inside["version"] == version, "zip manifest version mismatch"
        assert inside["name"] == manifest["name"], "zip manifest name mismatch"
    print("zip entries:", len(names))
    assert "store-assets/" not in " ".join(names), "store assets leaked into zip"
    assert ".codebuddy" not in " ".join(names), "working memory leaked into zip"

    # 5. copy to the default folder (packaging artifacts only)
    dst = os.path.join(DEFAULT_OUT, zip_name)
    shutil.copy(zip_path, dst)
    with open(zip_path, "rb") as a, open(dst, "rb") as b:
        assert a.read() == b.read(), "copied zip differs from source"
    print("zip:", zip_path)
    print("copied to:", dst)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
