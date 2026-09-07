#!/usr/bin/env node
/**
 * v1.4 build 脚本:把 Vite 产物 (www/dist/) 合并回 www/ 根目录
 *
 * 原因:
 *   - vite.config.js root=www, outDir=dist → 产物在 www/dist/
 *   - capacitor.config.json webDir=www → cap sync 复制 www/ (源码) 而非 www/dist/
 *   - 结果: Vite 提取的 CSS 进了 dist/ 但从未被使用,index.html 还是源版本
 *
 * 修复:
 *   - Vite 仍输出到 www/dist/
 *   - 本脚本把 dist/index.html 拷回 www/ 覆盖原文件
 *   - dist/assets/ 拷回 www/assets/
 *   - 删除 www/dist/
 *   - 现在 cap sync 复制的 www/ 就是 Vite 处理后的产物
 *
 * 用法: node scripts/build-web.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const DIST = path.join(WWW, 'dist');
const ASSETS = path.join(WWW, 'assets');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function rimraf(p) {
  if (!(await exists(p))) return;
  await fs.rm(p, { recursive: true, force: true });
  console.log(`  [rm] ${path.relative(ROOT, p)}`);
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function main() {
  if (!(await exists(DIST))) {
    console.error('❌ www/dist/ 不存在,请先 npm run build');
    process.exit(1);
  }

  console.log('▶ build-web: 把 Vite 产物合并回 www/');

  // 1) 拷贝 dist/index.html → www/index.html (覆盖,但保留 styles.css link)
  const distIndex = path.join(DIST, 'index.html');
  const wwwIndex = path.join(WWW, 'index.html');
  if (await exists(distIndex)) {
    let distContent = await fs.readFile(distIndex, 'utf-8');
    // 把 dist 里的 hashed CSS 引用替换成静态 /styles.css(开发友好,不依赖 build hash)
    distContent = distContent.replace(
      /<link\s+rel="stylesheet"\s+crossorigin\s+href="\/assets\/(?:index|style)-[A-Za-z0-9_-]+\.css"\s*\/?>/g,
      '<link rel="stylesheet" crossorigin href="/styles.css">'
    );
    await fs.writeFile(wwwIndex, distContent);
    console.log('  [cp] dist/index.html → www/index.html (styles.css link 替换)');
  } else {
    console.warn('  ⚠ dist/index.html 缺失,跳过');
  }

  // 2) 合并 dist/assets/ → www/assets/(但跳过 hashed CSS,Vite 会重新生成)
  const distAssets = path.join(DIST, 'assets');
  if (await exists(distAssets)) {
    await rimraf(ASSETS);
    await copyDir(distAssets, ASSETS);
    console.log('  [cp] dist/assets/* → www/assets/');
  }

  // 3) 拷贝 dist/ 下其余 public 文件
  const distEntries = await fs.readdir(DIST, { withFileTypes: true });
  for (const e of distEntries) {
    if (e.name === 'index.html' || e.name === 'assets') continue;
    const src = path.join(DIST, e.name);
    const dst = path.join(WWW, e.name);
    if (e.isDirectory()) {
      await rimraf(dst);
      await copyDir(src, dst);
    } else {
      await fs.copyFile(src, dst);
    }
    console.log(`  [cp] dist/${e.name} → www/${e.name}`);
  }

  // 4) 清理 dist/
  await rimraf(DIST);

  console.log('✅ build-web 完成, www/ 现在包含 Vite 处理后的产物');
  console.log('   下一步: npx cap sync android');
}

main().catch(e => { console.error(e); process.exit(1); });
