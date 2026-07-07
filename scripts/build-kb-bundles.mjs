#!/usr/bin/env node
/**
 * v2.0.2 知识库打包: 把 65 个 KB JSON 合并为 3 个 bundle
 *
 * 目的:
 *   - 首屏启动从 11 个并发 fetch (RAG) → 3 个 fetch
 *   - 单个 bundle 内每个 KB 仍保留独立性(后续可按 key 懒加载)
 *   - 不破坏 RAG 标签(每个 doc 的 source 仍是原 key)
 *
 * 三个 bundle:
 *   1. core: RAG 11 个 + 八字主/紫微主/六爻主/奇门主/手相/姓名/倪海厦/万历/...
 *      (启动时加载, ~280KB)
 *   2. extended: 各类扩展 (八字格局/紫微四化/六爻进退/奇门格局/...)
 *      (按需加载, ~380KB)
 *   3. specialty: 民俗/杂项/梅花/手相纹理 (按需加载, ~540KB)
 *
 * 用法: node scripts/build-kb-bundles.mjs
 * 集成: package.json `npm run build` 会自动跑
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const KB_DIR = path.join(ROOT, 'www', 'kb_data');
const BUNDLE_DIR = path.join(KB_DIR, '_bundles');

// === 三个 bundle 的 KB key 配置 ===
const BUNDLE_KEYS = {
  'kb_core.json': [
    // 八字核心
    'bazi', 'bazi_ext', 'bazi_shensha', 'bazi_shishen', 'bazi_geju',
    // 紫微核心
    'ziwei', 'ziwei_ext', 'ziwei_gongwei', 'ziwei_sihua', 'ziwei_geju',
    // 六爻核心
    'gua', 'liuyao_ext', 'liuyao_liushen', 'liuyao_xunkong', 'liuyao_najia', 'liuyao_liuqin', 'liuyao_jintui',
    // 奇门核心
    'qimen', 'qimen_ext', 'qimen_xingmen', 'qimen_geju',
    // 梅花易数（新增入 core）
    'meihua_ext', 'meihua_lei_xiang',
    // 姓名/手相/倪海厦 核心
    'xingshi', 'xingshi_ext', 'shouxiang', 'nihai_xia', 'nihai_xia_ext',
    // 基础工具
    'wannianli'
  ],
  'kb_extended.json': [
    // 八字扩展
    'bazi_tiaohou', 'bazi_dayun', 'bazi_shensha2', 'bazi_hehun', 'bazi_ziwei_hecan',
    // 紫微扩展
    'ziwei_ext2', 'ziwei_daxian', 'ziwei_daxian2', 'ziwei_fuxing', 'ziwei_zuhe',
    // 六爻扩展
    'liuyao_cases', 'liuyao_meihua_hucan',
    // 奇门扩展
    'qimen_zhanji', 'qimen_paipan', 'qimen_yongshen', 'qimen_fengshui_jiehe',
    // 姓名扩展
    'xingshi_cases',
    // 风水
    'fengshui_base', 'fengshui_ext', 'fengshui_luopan',
    // 择日
    'zeri_ext', 'zeri_jixiong'
  ],
  'kb_specialty.json': [
    // 道佛（按需加载）
    'daoism_fuzhou', 'daoism_zhoushu', 'daoism_shoujue', 'daoism_zhaijiao', 'daoism_jiuhuo',
    'buddhism_mantra', 'buddhism_divine',
    // 面相（按需加载）
    'mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2',
    // 手相纹理/杂项
    'shouxiang_wenli', 'shengxiang', 'qise', 'guxiang'
  ]
};

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

// 从 KB JSON 文件名提取 key: bazi_kb.json -> bazi, bazi_ext_kb.json -> bazi_ext
function keyFromFile(filename) {
  return filename.replace(/_kb\.json$/, '').replace(/\.json$/, '');
}

async function loadAllKBFiles() {
  const all = {};
  const entries = await fs.readdir(KB_DIR);
  for (const f of entries) {
    if (!f.endsWith('.json') || f.startsWith('_') || f.endsWith('.bak-')) continue;
    const key = keyFromFile(f);
    const content = await fs.readFile(path.join(KB_DIR, f), 'utf-8');
    try {
      all[key] = JSON.parse(content);
    } catch (e) {
      console.warn(`  ⚠ 跳过 ${f}: JSON 解析失败`, e.message);
    }
  }
  return all;
}

async function main() {
  console.log('▶ build-kb-bundles: 合并 65 个 KB 文件为 3 个 bundle');

  const allKB = await loadAllKBFiles();
  const allKeys = new Set(Object.keys(allKB));
  console.log(`  找到 ${allKeys.size} 个 KB 文件`);

  await fs.mkdir(BUNDLE_DIR, { recursive: true });
  const usedKeys = new Set();
  let totalSize = 0;

  for (const [bundleName, keys] of Object.entries(BUNDLE_KEYS)) {
    const bundle = {};
    let missingCount = 0;
    for (const k of keys) {
      if (allKB[k] !== undefined) {
        bundle[k] = allKB[k];
        usedKeys.add(k);
      } else {
        missingCount++;
      }
    }
    const out = path.join(BUNDLE_DIR, bundleName);
    const json = JSON.stringify(bundle);
    await fs.writeFile(out, json);
    const sizeKB = (json.length / 1024).toFixed(1);
    totalSize += json.length;
    console.log(`  ✓ ${bundleName}: ${keys.length - missingCount} 个 KB (${sizeKB} KB) ${missingCount > 0 ? `[缺 ${missingCount}]` : ''}`);
  }

  // 检查未分配的 KB
  const orphans = [...allKeys].filter(k => !usedKeys.has(k));
  if (orphans.length > 0) {
    console.warn(`  ⚠ ${orphans.length} 个 KB 未分配到任何 bundle:`);
    orphans.forEach(k => console.warn(`    - ${k}`));
    console.warn('  (这些 KB 当前未被运行时引用,无需合并;若要加,在 BUNDLE_KEYS 里加)');
  }

  // 同时生成 bundle index (运行时快速查 key → bundle 名)
  const keyToBundle = {};
  for (const [bundleName, keys] of Object.entries(BUNDLE_KEYS)) {
    for (const k of keys) {
      if (allKB[k] !== undefined) keyToBundle[k] = bundleName;
    }
  }
  await fs.writeFile(
    path.join(BUNDLE_DIR, '_index.json'),
    JSON.stringify(keyToBundle, null, 0)
  );
  console.log(`  ✓ _index.json: ${Object.keys(keyToBundle).length} 个 KB → bundle 映射`);

  console.log(`\n✅ 完成: 3 个 bundle,总 ${(totalSize / 1024).toFixed(1)} KB`);
  console.log('   替代原 11 个并发 fetch → 3 个并发 fetch');
}

main().catch(e => { console.error(e); process.exit(1); });
