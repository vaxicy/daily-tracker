# Daily Tracker 商店素材任务交接

> 最新更新时间：2026-07-16 晚间
> 状态：**已按真实 UI 风格重新生成，等待最终目测批改**

---

## 项目内文件夹结构

```
store-assets/
├── screenshots/
│   ├── zh/          # 5 张中文截图
│   └── en/          # 5 张英文截图
└── promo/           # 2 张中英双语宣传图
    ├── promo-tile-440x280.png
    └── marquee-1400x560.png
```

> 规则：所有素材放项目内 `store-assets/`；只有打包 zip 才额外复制到 `D:\迅雷下载\vibe coding\`。

---

## 已生成文件

### 商店截图（按语言分）
| 中文 | 英文 |
|---|---|
| `screenshots/zh/screenshot-01-water.png` | `screenshots/en/screenshot-01-water.png` |
| `screenshots/zh/screenshot-02-diet.png` | `screenshots/en/screenshot-02-diet.png` |
| `screenshots/zh/screenshot-03-bathroom.png` | `screenshots/en/screenshot-03-bathroom.png` |
| `screenshots/zh/screenshot-04-period.png` | `screenshots/en/screenshot-04-period.png` |
| `screenshots/zh/screenshot-05-personalize.png` | `screenshots/en/screenshot-05-personalize.png` |

### 宣传图块（中英双语）
- `promo/promo-tile-440x280.png`
- `promo/marquee-1400x560.png`

---

## 本次改动要点

1. **重写 `scripts/generate-store-screenshots.py`**
   - 读取真实 `popup.html` / `popup.js` 的配色、字体、卡片、按钮、切换开关、日历热力图等样式。
   - 左侧绘制与真实扩展界面一致的 popup mock；右侧为功能宣传卡片。
   - 截图按语言分目录（`zh`/`en`），宣传图为中英双语同图。

2. **重新生成 12 张素材**
   - 10 张 1280×800 商店截图（5 中文 + 5 英文）
   - 1 张 440×280 小型双语宣传图
   - 1 张 1400×560 顶部双语宣传图

3. **整理目录**
   - 删除项目根目录重复副本 `daily-tracker-store-screenshots/`。
   - 删除旧 promo `zh`/`en` 子目录，改为 `promo/` 扁平双语目录。

4. **写入全局 User Rules**
   - `C:\Users\16704\.codebuddy\rules\asset-output-location-RULE.md`
   - 明确：素材放项目内；打包产物才放默认文件夹；截图分语言、promo 双语。

---

## 程序化 QA 结果

- 全部 12 张 PNG 尺寸正确：
  - 截图 1280×800
  - 小图 440×280
  - 大图 1400×560
- 全部通过底部 12px / 右侧 12px 深色描边溢出检查（`ALL_OK`）。

---

## 待用户终检（目测）

当前模型无法直接预览图片，请打开以下目录检查：

```
D:\迅雷下载\vibe coding\daily-tracker\store-assets\
```

重点检查：
1. 喝水截图是否贴近你提供的真实 UI 风格（粉色主题、倒计时、进度条、开关、按钮、日历热力图）。
2. 左侧 popup 与右侧宣传卡片是否对齐、无重叠。
3. 小图/大图的文字是否清晰、中英文双语是否平衡。
4. 各主题色（蓝/粉/橙/紫/绿）是否协调。

---

## 快速恢复命令

```powershell
cd "D:\迅雷下载\vibe coding\daily-tracker"
python scripts/generate-store-screenshots.py
```

---

## 待执行：Git 提交

用户确认无问题后执行：

```powershell
cd "D:\迅雷下载\vibe coding\daily-tracker"
git add fonts scripts store-assets handoff.md
git commit -m "feat: add Chrome Web Store screenshots and bilingual promo images"
```

> 注意：包含 PNG 文件，提交体积较大；如希望只提交脚本，可排除 `store-assets`。

---

# 历史记录（供参考）

## 2026-07-16 初版
- 创建首版生成脚本，生成 10 张 1280×800 中英截图。
- 修复 emoji 渲染、英文卡片溢出、浴室截图布局。
- 程序化 QA 通过尺寸与边界检查。

## 2026-07-16 晚间第二版
- 按用户反馈读取真实 UI 风格，重写脚本。
- 改为截图分语言、promo 双语。
- 整理目录并写入全局 User Rules。
