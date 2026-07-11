# macOS 本地桌面版使用说明

这个版本可以满足两个桌面需求：

- 启动后 GIF 会跟随系统鼠标，即使你切换到浏览器、Finder、设计软件、聊天软件或其他任意界面，也会一直存在。
- GIF 悬浮层始终置顶，并且鼠标穿透，不会挡住点击。

## 本地启动

1. 先在 Mac 上安装 Node.js LTS 版本：https://nodejs.org/
2. 双击 `scripts/start-mac.command`。
3. 第一次启动会自动安装依赖，之后会打开控制面板并显示全局 GIF 跟随效果。

如果 macOS 提示脚本无法打开，可以在项目根目录打开终端执行：

```bash
chmod +x scripts/start-mac.command scripts/build-mac-installer.command
```

然后再次双击脚本。

## 生成安装包分享给别人

1. 在 Mac 上双击 `scripts/build-mac-installer.command`。
2. 等待打包完成，系统会自动打开 `dist` 文件夹。
3. 把里面的 `.dmg` 或 `.zip` 发给别人即可。

## 注意

- `.dmg` 安装包必须在 macOS 上生成，不能在 Linux 或 Windows 上可靠生成。
- 如果接收方第一次打开应用时看到 macOS 安全提示，可以右键点击应用，选择“打开”。
- 如果对方的系统开启了更严格的安全策略，未签名应用可能需要在“系统设置 → 隐私与安全性”里允许打开。
