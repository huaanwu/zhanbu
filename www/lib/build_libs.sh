#!/usr/bin/env bash
# 重新打包 lunar-javascript 和 iztro 为浏览器可用的 IIFE bundle
# 离线依赖构建脚本

set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  离线依赖构建脚本"
echo "=========================================="
echo ""

if [ ! -d node_modules/lunar-javascript ] || [ ! -d node_modules/iztro ]; then
  echo "[1/3] 安装依赖..."
  npm install --silent
else
  echo "[1/3] 依赖已安装，跳过"
fi

echo ""
echo "[2/3] 打包 lunar-javascript..."
npx esbuild node_modules/lunar-javascript/index.js \
  --bundle --format=iife --global-name=LunarLib \
  --outfile=lunar.bundle.js --target=es2017 --minify

echo ""
echo "[3/3] 打包 iztro..."
npx esbuild node_modules/iztro/lib/index.js \
  --bundle --format=iife --global-name=IztroLib \
  --outfile=iztro.bundle.js --target=es2017 --minify

echo ""
echo "=========================================="
echo "  构建完成！"
ls -lh lunar.bundle.js iztro.bundle.js
echo "=========================================="
echo ""
echo "使用方式（已自动注入 index.html）："
echo "  <script src=\"lib/lunar.bundle.js\"></script>"
echo "  <script src=\"lib/iztro.bundle.js\"></script>"
echo "  <script>"
echo "    window.Solar = window.LunarLib.Solar;"
echo "    window.Lunar = window.LunarLib.Lunar;"
echo "    window.iztroAstro = window.IztroLib.astro;"
echo "  </script>"
