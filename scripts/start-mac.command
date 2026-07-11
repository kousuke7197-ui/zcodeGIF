#!/bin/zsh
set -e

cd "$(dirname "$0")/.."

if ! command -v npm >/dev/null 2>&1; then
  echo "请先安装 Node.js：打开 https://nodejs.org/ 下载 LTS 版本。"
  read -k 1 "?按任意键退出..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次启动，正在安装桌面版依赖..."
  npm install
fi

echo "正在启动 GIF Mouse Follower..."
npm start
