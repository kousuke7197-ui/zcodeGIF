#!/bin/zsh
# 编译鼠标点击监听为通用二进制（arm64 + x86_64），输出到 desktop/mouse-click-monitor。
# 打包前运行一次即可；electron-builder 的 files 配置已包含 desktop/**。
set -e

cd "$(dirname "$0")/.."

SRC="desktop/mouse-click-monitor.swift"
OUT="desktop/mouse-click-monitor"
BUILD_DIR="/tmp/mouse-click-monitor-build"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "未找到 swiftc，请先安装 Xcode Command Line Tools：xcode-select --install"
  exit 1
fi

mkdir -p "$BUILD_DIR"

echo "编译 arm64 版本..."
swiftc -O -target arm64-apple-macosx12.0 "$SRC" -o "$BUILD_DIR/monitor-arm64"

echo "编译 x86_64 版本..."
if swiftc -O -target x86_64-apple-macosx12.0 "$SRC" -o "$BUILD_DIR/monitor-x64" 2>/dev/null; then
  echo "合并为通用二进制..."
  lipo -create "$BUILD_DIR/monitor-arm64" "$BUILD_DIR/monitor-x64" -output "$OUT"
else
  echo "（当前工具链不支持 x86_64 交叉编译，仅输出 arm64 版本）"
  cp "$BUILD_DIR/monitor-arm64" "$OUT"
fi

chmod +x "$OUT"
rm -rf "$BUILD_DIR"
echo "完成：$OUT"
