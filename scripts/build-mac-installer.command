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

echo "正在生成 macOS 安装包，请稍等..."
npm run dist:mac

echo "完成。安装包在 dist 文件夹中。"
open dist
