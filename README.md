# gif-mouse-follower

一个 GIF 鼠标跟随自定义工具，同时包含两个版本：

- 网页版：纯 `HTML + CSS + 原生 JavaScript`，无框架、无依赖、无后端，可直接部署到 GitHub Pages。
- macOS 桌面版：基于 Electron，启动后 GIF 会在系统桌面全局跟随鼠标，切换到任意软件也会一直存在。

## 功能

### 基础功能
- GIF 平滑缓动跟随鼠标移动。
- GIF 永远显示在页面最上层，并通过 `pointer-events: none` 避免阻挡点击。
- 鼠标离开页面时自动隐藏，回到页面后恢复。
- 支持上传本地 GIF 或图片并实时预览。
- 支持调整 GIF 大小、X/Y 偏移、透明度。
- 支持开启或关闭跟随功能。
- 内置 5 个可爱预设：线条小狗、Hello Kitty、玉桂狗、美乐蒂、库洛米。
- 所有设置自动保存（网页版存 `localStorage`，桌面版存本地文件），刷新/重启后自动恢复。
- 控制面板支持折叠和展开，移动端友好。

### 桌面版增强功能
- **系统托盘**：关闭窗口后应用在后台运行，托盘菜单可开关跟随/显示面板/开机自启/退出。
- **全局快捷键**：`⌘ + Shift + G` 随时开关跟随，无需切换回控制面板。
- **开机自启**：一键设置登录时自动启动。
- **水平/垂直翻转**：支持 GIF 水平或垂直镜像。
- **播放速度**：0.25x ~ 4.0x 调速，慢动作或快进皆可。
- **深色模式**：控制面板暗色主题，护眼舒适。
- **智能白底处理**：智能抠背景 / 保留白色 / 手动取色三种模式。
- **非 GIF 支持**：PNG / JPG / WebP 图片也能作为跟随素材。
- **崩溃恢复**：渲染进程崩溃后自动重建窗口，不影响使用。
- **多屏幕跟随**：多显示器环境下每个屏幕都有悬浮 GIF。
- **本地 GIF 库**：选择的 GIF 会复制到应用数据目录，原文件删除也不影响使用。

## 文件结构

```text
gif-mouse-follower/
├── index.html
├── style.css
├── app.js
├── package.json
├── .eslintrc.cjs
├── .eslintignore
├── desktop/
│   ├── main.js
│   ├── preload.js
│   ├── logger.js
│   ├── overlay.html
│   ├── overlay.css
│   ├── overlay.js
│   ├── control.html
│   ├── control.css
│   └── control.js
├── scripts/
│   ├── start-mac.command
│   └── build-mac-installer.command
├── assets/
│   ├── line-dog.gif
│   ├── hello-kitty.gif
│   ├── cinnamoroll.gif
│   ├── melody.gif
│   ├── kuromi.gif
│   ├── tray-icon.png
│   ├── app-icon.png
│   └── app-icon.icns
├── .github/workflows/
│   ├── static.yml
│   └── ci.yml
├── MAC_DESKTOP_GUIDE.md
├── LICENSE
└── README.md
```

## 网页版本地运行

直接双击打开 `index.html` 即可使用。也可以用任意静态服务器运行，例如 VS Code 的 Live Server。

## macOS 桌面版本地运行

1. 在 Mac 上安装 Node.js LTS 版本：https://nodejs.org/
2. 双击 `scripts/start-mac.command`。
3. 第一次启动会自动安装依赖，之后会打开控制面板，并在任意软件界面显示全局 GIF 跟随效果。

## 生成 macOS 安装包

1. 在 Mac 上双击 `scripts/build-mac-installer.command`。
2. 等待打包完成，系统会自动打开 `dist` 文件夹。
3. 把 `dist` 里的 `.dmg` 或 `.zip` 发给别人即可。

## 部署到 GitHub Pages

1. 在 GitHub 创建仓库，把 `gif-mouse-follower` 文件夹内的全部文件上传到仓库根目录。
2. 进入仓库 `Settings` → `Pages`，在 `Build and deployment` 中选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/root`。
3. 保存后等待 GitHub 生成网址，打开该网址即可在线使用。

## 说明

上传的本地 GIF 会以 Data URL 的形式尽量保存到浏览器 `localStorage`。如果文件过大导致浏览器存储空间不足，当前页面仍可预览使用，但刷新后可能无法恢复该上传图片。建议使用体积较小的 GIF。

macOS 桌面版选择本地 GIF 后，会复制到应用数据目录并保存配置。`.dmg` 安装包必须在 Mac 上生成；如果别人打开未签名应用时看到安全提示，可以右键点击应用并选择“打开”。
