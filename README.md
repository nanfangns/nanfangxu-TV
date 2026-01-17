# 南方许TV - 免费在线视频搜索与观看平台

<div align="center">
  <img src="image/logo.png" alt="南方许TV Logo" width="120">
  <br>
  <p><strong>自由观影，畅享精彩</strong></p>
</div>

## 📺 项目简介

南方许TV 是一个轻量级、免费的在线视频搜索与观看平台，提供来自多个视频源的内容搜索与播放服务。项目基于最新的**南方许账号系统**，支持多端数据同步、收藏夹管理及观看历史记录，为用户带来无缝的追剧体验。

**项目门户**： [nanfangxu.is-an.org](https://nanfangxu.is-an.org)

本项目基于 [bestK/tv](https://github.com/bestK/tv) 进行重构与增强。

<details>
  <summary>点击查看项目截图</summary>
  <img src="https://github.com/user-attachments/assets/df485345-e83b-4564-adf7-0680be92d3c7" alt="项目截图" style="max-width:600px">
</details>

## 🚀 快速部署

选择以下任一平台，点击一键部署按钮，即可快速创建自己的 南方许TV 实例：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnanfangns%2Fnanfangxu-TV)  
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nanfangns/nanfangxu-TV)  
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nanfangns/nanfangxu-TV)

## � 账号系统 (全新升级)

项目已从原有的环境变量密码保护升级为标准的**南方许账号系统**：

- **用户注册与登录**：支持创建个人账号，确保数据安全。
- **多端同步**：您的收藏记录和观看历史将跟随账号同步，不再丢失。
- **个人中心**：便捷管理您的个人设置和播放偏好。
- **无需环境变量**：部署时不再需要设置繁琐的 `PASSWORD` 变量。

## � 部署指南

### Cloudflare Pages (推荐)

1. Fork 本仓库到您的 GitHub 账户
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 Pages 服务
3. 点击"创建项目"，连接您的 GitHub 仓库 `nanfangxu-TV`
4. 使用以下设置：
   - 构建命令：留空
   - 输出目录：留空
5. 点击"保存并部署"

### Vercel / Netlify / Render

直接导入仓库并使用默认设置部署即可，无需配置任何环境变量。

## 🔧 自定义配置

### API 兼容性

南方许TV 支持标准的苹果 CMS V10 API 格式。添加自定义 API 时需遵循以下格式：
- 搜索接口: `https://example.com/api.php/provide/vod/?ac=videolist&wd=关键词`
- 详情接口: `https://example.com/api.php/provide/vod/?ac=detail&ids=视频ID`

## ⌨️ 键盘快捷键

播放器支持以下键盘快捷键：

- **空格键**: 播放/暂停
- **左右箭头**: 快退/快进
- **上下箭头**: 音量增加/减小
- **M 键**: 静音/取消静音
- **F 键**: 全屏/退出全屏
- **Esc 键**: 退出全屏

## 🛠️ 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- Tailwind CSS
- 南方许 Auth 服务 (JWT 鉴权)
- HLS.js 用于 HLS 流处理
- ArtPlayer 视频播放器核心
- Cloudflare Pages Functions
- localStorage 本地缓存优化

## ⚠️ 免责声明

南方许TV 仅作为视频搜索工具，不存储、上传或分发任何视频内容。所有视频均来自第三方 API 接口提供的搜索结果。如有侵权内容，请联系相应的内容提供方。

本项目开发者不对使用本项目产生的任何后果负责。使用本项目时，您必须遵守当地的法律法规。

## 🤝 衍生项目

- **[MoonTV](https://github.com/senshinya/MoonTV)**  
- **[OrionTV](https://github.com/zimplexing/OrionTV)**  

## 🥇 感谢支持

- **[Sharon](https://sharon.io)**
- **[ZMTO](https://zmto.com)**
- **[YXVM](https://yxvm.com)**