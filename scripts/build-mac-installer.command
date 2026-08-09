#!/bin/zsh
set -e

cd "$(dirname "$0")/.."

if ! command -v npm >/dev/null 2>&1; then
  echo "请先安装 Node.js：打开 https://nodejs.org/ 下载 LTS 版本。"
  read -k 1 "?按任意键退出..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "正在安装打包依赖..."
  npm install
fi

# 预编译鼠标点击监听二进制（避免用户机器依赖 swift 工具链、加快启动）
if [ -f "scripts/compile-click-monitor.sh" ]; then
  echo "正在编译鼠标点击监听..."
  zsh scripts/compile-click-monitor.sh || echo "（点击监听编译失败，将回退到运行时 swift 编译）"
fi

echo "正在生成 macOS 安装包，请稍等..."
npm run dist:mac

echo "完成。安装包在 dist 文件夹中。"
open dist
