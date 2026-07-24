# 🍽️ 吃喝拉撒 - Daily Habit Tracker 健康习惯追踪

> 记录饮食、饮水、排便、排尿、经期，全方位健康习惯追踪器。Track diet, water, bowel, bladder & period daily.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-已上架-4285F4)](https://chromewebstore.google.com/detail/%E5%90%83%E5%96%9D%E6%8B%89%E6%92%92-daily-habit-tracker/nokpjbnbcbcmhjmhdhoooncbpdhclknn?authuser=0&hl=zh-CN)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-3.2.5-blue)](https://github.com/vaxicy/daily-tracker)
[![License](https://img.shields.io/badge/License-NonCommercial-blue.svg)](LICENSE)

一个功能丰富的 Chrome 浏览器扩展，帮助你全方位记录和管理日常生活中的饮食、饮水、排便、排尿和经期情况，培养健康的生活习惯。

---

## ✨ 功能特性

### 🍜 饮食记录
- **多功能记录**：支持早餐、午餐、晚餐、加餐分类记录
- **智能标签**：内置 16 种快捷标签（中式、西式、日式、清淡、油腻等），支持自定义标签（含 emoji 选择器）
- **关键词自动识别**：根据备注内容自动匹配标签（如含"米饭"自动打"中式"标签）
- **评价系统**：5 星半星评分（极差→完美，共 10 档）
- **饱腹感追踪**：5 级记录（很饿/有点饿/刚好/有点撑/很撑）
- **日历视图**：按餐次着色，悬浮查看详情，支持点击日期补录或编辑
- **统计分析**：平均评分、连续记录天数、餐次分布等
- **默认时间设置**：可为每个餐次设置默认记录时间

### 💧 喝水提醒
- **智能提醒**：自定义提醒间隔（15/30/45/60 分钟或自定义）
- **实时倒计时**：直观显示距离下次喝水的时间，带进度条
- **浏览器通知**：到时弹出通知（支持"我喝了/没喝"按钮交互）
- **扩展角标**：在工具栏图标上显示今日/本周/本月喝水次数（支持切换显示内容）
- **数据统计**：今日/本周/本月喝水次数统计，日历热力图
- **灵活调整**：支持增加或减少今日喝水记录，支持撤销最近一次打卡

### 💩 排便打卡
- **一键打卡**：快速记录排便时间和备注
- **Bristol 量表**：7 级分类（从硬块到水样），科学评估排便状态
- **排便量记录**：5 档（少/中/多/很多/非常多）
- **大便颜色**：7 种颜色分类
- **日历视图**：标记打卡日期，支持历史补录
- **健康统计**：Bristol 分型分布（理想型/偏硬型/偏软型）、连续理想天数、周/月合计等

### 💦 排尿打卡
- **快速记录**：一键记录排尿情况
- **多维度记录**：尿量（5 档）、尿液颜色（透明/淡黄/黄色/深黄/茶色/异常色）
- **间隔分析**：日均次数、最大/最小间隔统计
- **日历视图**：直观展示排尿频率
- **饮食数据同步**：自动将当天饮食备注同步到排尿备注

### 🩸 经期记录
- **开关控制**：一键开始/结束经期
- **日历标记**：直观标记经期日期，支持补签
- **每日记录**：心情（5 档）、痛感（6 档滑块）、症状（6 种复选框）、流量（6 档滑块）、经血颜色（5 种）
- **周期预测**：基于历史周期长度智能预测下次经期
- **统计面板**：累计周期数、平均周期长度、平均经期天数、异常次数
- **趋势图**：柱状图展示周期长度和持续天数趋势
- **历史记录表**：序号、开始日期、周期长度、持续天数

### ⏰ 自定义提醒（侧边栏）
- **多功能提醒**：支持添加自定义提醒事项（如：吃降压药、喝水、运动）
- **灵活配置**：自定义提醒名称、图标（15 种可选）、时间
- **多时间提醒**：支持为同一事项设置多个提醒时间
- **开关控制**：可随时启用/禁用提醒

### 🎨 个性化设置
- **多主题**：默认蓝调、少女粉、暗色模式、森林绿四种主题风格
- **主题切换动画**：平滑的过渡动画
- **双语支持**：中文/English 一键切换（200+ 翻译键值对）
- **默认首页**：可设置喜欢的页面作为默认打开页
- **角标定制**：自定义显示内容（喝水/排便/排尿/饮食 × 今日/本周/本月）
- **数据备份**：导出 JSON 备份 / 从 JSON 恢复
- **CSV 导出**：按模块导出数据（饮食/饮水/排便/排尿/经期）

---

## 📦 安装方法

### 方法一：Chrome 应用商店（推荐）

<a href="https://chromewebstore.google.com/detail/%E5%90%83%E5%96%9D%E6%8B%89%E6%92%92-daily-habit-tracker/nokpjbnbcbcmhjmhdhoooncbpdhclknn?authuser=0&hl=zh-CN">
  <img src="https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/iNEddTyWiMfLSwFD6qGq.png" alt="Chrome Web Store" width="200">
</a>

点击上方按钮或直接访问 Chrome 应用商店安装。

### 方法二：本地加载（开发版）

1. 下载/克隆本仓库代码到本地
   ```bash
   git clone https://github.com/vaxicy/daily-tracker.git
   ```
2. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车
3. 开启右上角的 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择项目所在的 `daily-tracker` 文件夹即可完成安装
6. 安装成功后，点击浏览器工具栏的扩展图标即可使用

---

## 🚀 使用指南

1. 点击浏览器工具栏的扩展图标打开主界面
2. 使用底部导航切换不同功能页面：
   - 🍽️ **吃** - 饮食记录（标签、星级评价、饱腹感）
   - 🥤 **喝** - 喝水提醒（倒计时、通知、角标统计）
   - 💩 **拉** - 排便打卡（Bristol 量表、健康统计）
   - 💧 **撒** - 排尿打卡（尿量、颜色、间隔分析）
   - 🩸 **经期** - 经期记录（周期预测、痛感/流量追踪）
3. 点击日历日期可查看或编辑历史记录
4. 点击右上角 **⚙️ 设置** 可自定义主题、语言、角标、数据备份等
5. 点击侧边栏 **📋 提醒** 可管理自定义提醒事项
6. 所有数据保存在本地，保护隐私安全

---

## 🛠️ 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖，轻量高效（主文件 ~6200 行）
- **Chrome Storage API** - 本地数据持久化
- **Chrome Alarms API** - 定时提醒功能
- **Chrome Notifications API** - 浏览器通知（带按钮交互）
- **Chrome Badge API** - 工具栏角标显示
- **CSS3** - 毛玻璃效果、渐变、主题切换动画
- **Service Worker** - 后台持久化运行

---

## 📁 项目结构

```
daily-tracker/
├── manifest.json      # 扩展配置文件 (Manifest V3)
├── popup.html         # 主界面 HTML
├── popup.js           # 主界面逻辑 (~6200 行)
├── background.js      # 后台服务脚本 (Service Worker)
├── i18n.js           # 国际语言包 (中/英 200+ 翻译键)
├── _locales/         # Chrome 商店国际化名称
│   ├── en/           # 英文名称描述
│   └── zh_CN/        # 中文名称描述
├── icon16.png        # 扩展图标 (16x16)
├── icon48.png        # 扩展图标 (48x48)
├── icon128.png       # 扩展图标 (128x128)
└── plate-new.svg     # SVG 图标资源
```

---

## 🔄 版本历史

### v3.2.5 (最新)
- 🩸 增加经期记录功能（心情、痛感、流量、颜色、症状追踪）
- 🔄 周期预测引擎，趋势图表
- 🌟 饮食评价升级为 5 星半星系统（10 档评分）
- 🍽️ 饱腹感从 3 档扩展为 5 档
- 💩 排便量和尿量升级为 5 档
- 🏷️ 饮食标签关键词自动识别
- ⏰ 角标支持自定义显示内容
- 📊 CSV 导出功能
- 💾 数据备份与恢复（JSON 导入/导出）
- 🔄 旧数据自动迁移

### v3.0
- ✨ 侧边栏增加自定义提醒功能（15 种图标、多时间提醒）
- 🎨 优化饮食记录布局和交互
- 🏷️ 增加饮食记录快捷标签，支持自定义标签（含 emoji）
- 🐛 修复暗色主题下显示问题
- 📊 调整统计布局

### v2.x
- 🌙 增加暗色主题和森林绿主题
- 🌐 增加中英双语切换功能
- ⚙️ 增加设置默认首页功能
- 📝 饮食记录增加备注和评价功能
- 💧 优化喝水提醒，增加调整今日喝水数量功能
- 📅 增加日历可补签、可追加记录功能
- 💩 升级排便记录（Bristol 量表、排便状态）
- 💦 优化排尿记录功能

### v1.x
- 🎉 初始版本发布，基础饮食/喝水/排便/排尿功能

查看完整提交历史：[GitHub Commits](https://github.com/vaxicy/daily-tracker/commits/main)

---

## 🔒 隐私说明

- ✅ 所有数据仅存储在本地浏览器中（`chrome.storage.local`）
- ✅ 不会上传任何数据到服务器
- ✅ 无需注册账号即可使用
- ✅ 无需联网即可正常使用
- ✅ 尊重用户隐私，数据完全由用户掌控

---

## 📄 开源协议

本项目采用 **非商业使用许可协议**（Non-Commercial License）。  
允许个人非商业用途的自由使用、修改和分发，**禁止任何形式的商业用途**。  
详见 [LICENSE](LICENSE) 文件。

---

## 💖 支持项目

如果这个项目对你有帮助，欢迎给个 Star ⭐️  
也欢迎在 Chrome 应用商店给个好评！

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-%E2%AD%90%E8%AF%84%E5%88%86-4285F4)](https://chromewebstore.google.com/detail/%E5%90%83%E5%96%9D%E6%8B%89%E6%92%92-daily-habit-tracker/nokpjbnbcbcmhjmhdhoooncbpdhclknn?authuser=0&hl=zh-CN)

---

## 📧 联系作者

- GitHub: [@vaxicy](https://github.com/vaxicy)
- 欢迎通过 [Issue](https://github.com/vaxicy/daily-tracker/issues) 反馈问题或提出建议

---

<p align="center">Made with ❤️ by <a href="https://github.com/vaxicy">vaxicy</a></p>
