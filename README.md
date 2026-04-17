# 🍽️ 吃喝拉撒

> 全方位记录生活起居：吃、喝、拉、撒，养成健康好习惯。

|[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](https://developer.chrome.com/docs/extensions/mv3/intro/)
|[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个简洁实用的 Chrome 浏览器扩展，帮助你记录和管理日常生活中的饮食、饮水、排便和排尿情况，培养健康的生活习惯。

> **当前仅支持本地安装使用，未上架 Chrome 应用商店。**

---

## ✨ 功能特性

### 🍜 饮食记录
- 记录每日三餐及加餐内容
- 支持早餐、午餐、晚餐、加餐分类
- 日历视图查看历史饮食记录
- 点击日期可补录或编辑记录

### 💧 喝水提醒
- 自定义喝水提醒间隔（15/30/45/60分钟或自定义）
- 倒计时显示下次喝水时间
- 浏览器通知提醒
- 统计今日/本周喝水次数

### 💩 排便打卡
- 一键记录排便时间和备注
- 日历视图标记打卡日期
- 本周/本月统计数据
- 支持历史记录补录和编辑

### 💦 排尿打卡
- 快速记录排尿情况
- 日历视图直观展示
- 数据统计分析
- 完整的增删改查功能

---

## 📦 安装方法（本地加载）

1. 下载/克隆本仓库代码
2. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/` 并回车
3. 开启右上角的 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择项目所在的文件夹即可完成安装
6. 安装成功后，点击浏览器工具栏的扩展图标即可使用

---

## 🚀 使用指南

1. 点击浏览器工具栏的扩展图标打开主界面
2. 使用底部导航切换不同功能页面：
   - 🍽️ **吃** - 饮食记录
   - 🥤 **喝** - 喝水提醒
   - 💩 **拉** - 排便打卡
   - 💧 **撒** - 排尿打卡
3. 点击日历日期可查看或编辑历史记录
4. 所有数据保存在本地，保护隐私安全

---

## 🛠️ 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖，轻量高效
- **Chrome Storage API** - 本地数据持久化
- **Chrome Alarms API** - 定时提醒功能
- **CSS3** - 现代化 UI 设计

---

## 📁 项目结构

```
daily-tracker/
├── manifest.json      # 扩展配置文件
├── popup.html         # 主界面 HTML
├── popup.js           # 主界面逻辑
├── background.js      # 后台服务脚本
├── icon16.png         # 扩展图标
├── icon48.png
├── icon128.png
└── plate-new.svg      # 图标资源
```

---

## 🔒 隐私说明

- 所有数据仅存储在本地浏览器中
- 不会上传任何数据到服务器
- 无需注册账号即可使用
- 尊重用户隐私，数据完全由用户掌控

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

---

## 📄 开源协议

本项目基于 [MIT](LICENSE) 协议开源。

---

## 💖 支持项目

如果这个项目对你有帮助，欢迎给个 Star ⭐️

---

<p align="center">Made with ❤️ by <a href="https://github.com/vaxicy">vaxicy</a></p>
