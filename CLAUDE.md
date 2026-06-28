# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI 占卜大师 v1.3.0

Capacitor + Vite + 原生 JS 的多流派占卜 Android 应用，从 APK 反编译恢复。覆盖八字 / 六爻 / 奇门 / 紫微 / 面相 / 手相 / 风水 / 佛道等流派,65+ 知识库 JSON,DeepSeek/OpenAI 兼容 API 解读。

## 常用命令

```bash
# 依赖与构建
npm install                                            # 装 @capacitor/* + vite
npm run dev                                            # Vite dev (端口 3002,root=www)
npm run build                                          # Vite build → www/dist/
npm run preview                                        # 预览构建产物

# 离线依赖(紫微/农历库) — 首次或 lunar/iztro 升级时执行
cd www/lib && ./build_libs.sh                          # 用 esbuild 把 lunar-javascript + iztro 打成 IIFE bundle 到 www/lib/*.bundle.js

# Android 构建(产物: android/app/build/outputs/apk/debug/app-debug.apk)
npx cap sync android                                   # 把 www/ 同步到 android,先 npm run build
cd android && ./gradlew assembleDebug

# 飞书推送 APK(DevOps)
node scripts/send-feishu.js <file_path>                # 默认推到武华安群
```

**重要:** 不要单独 `vite build` 后直接 `cap sync`,Vite 产物在 `www/dist/`,`cap sync` 会把 `webDir`(默认 `www`)同步到 Android assets,所以 Capacitor 配置的 `webDir` 实际指向 **dist 后的 www**;Capacitor 8 的 `cap sync` 会自动处理 www→android 同步,但需要先有 `npm run build`。

## 架构(一张图)

```
┌─────────────────────────────────────────────────────────────┐
│ index.html (SPA,所有页面)                                   │
│   ├─ 表单输入 → 命盘计算层 (liuyao.js / qimen.js / expert.js)
│   ├─ 命盘/卦象 → RAG 检索层 (rag.js,BM25 + 一/二/三元组)
│   ├─ 检索结果 + 命盘事实 → 提示词组装 → DeepSeek/OpenAI (expert.js)
│   └─ 解读结果 → 缓存 (cache.js,LRU 50/7天) → 历史 (history.js)
│                                                              │
│ 反馈闭环: feedback.js 评分 → feedback-loop.js 分析 → 校准   │
│          注入下轮提示词 (准确度<65% 触发)                    │
│                                                              │
│ AB 测试: ab_test.js (prompt_v1/v2 / rag_v1/v2 分组)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Capacitor 8 (androidScheme=https)
                              ↓
                  android/ (原生工程, gradle build)
```

**核心分层:**
- **算盘层** (`expert.js` 72KB + `liuyao.js` 19KB + `qimen.js` 17KB + `xingshi.js`/`visual.js`):100% 准确的命理事实(64卦世应、纳甲、旬空、五行生克、紫微排盘、姓名五格)。**原则:确定的事实由代码给出,AI 不允许"创作"推算结果。**
- **RAG 层** (`rag.js`):BM25 + 中文一/二/三元组(去停用词) + 标签加权;`flattenKB` 递归遍历知识库 JSON 切分成 doc,按源文件名(`bazi_*`/`gua_*`/`qimen_*`/`ziwei_*`/`buddhism_*`/`daoism_*`)自动打标签。
- **AI 层** (`expert.js` 出口):提示词组装 → 调 DeepSeek/OpenAI 兼容 API;API Key 在 UI 运行时输入,**禁止硬编码**。
- **持久化层** (`history.js` / `feedback.js` / `cache.js`):全部走 `localStorage`,key 前缀分别是 `divination_history_*` / `divination_feedback_*` / `divination_cache_v1` / `divination_ab_test_v1`;**升级 APP 版本时 cache 会自动清空**(通过 `window.APP_VERSION` 触发)。

## 关键约束(v1.3.0 强制)

| 项 | 规则 |
|----|------|
| **API Key** | 运行时 UI 输入,**禁止任何形式的硬编码**(v1.3.0 已移除旧 `DEFAULT_API_KEY`) |
| **innerHTML** | 所有用户/AI 输出走 `escapeHtml()` 转义,**新代码必须遵循**(XSS 防护) |
| **eval** | **禁止** `eval()`;动态加载改用 ES Module `import()` |
| **catch 空块** | 空 `catch {}` 必须加 `console.warn('[模块] 错误:', e)`,便于线上排查 |
| **缓存 Key** | `Cache.makeKey(domain, params)` 按模块(bazi/ziwei/liuyao/qimen/xingshi/fengshui/shouxiang/cross)分别构造,新增模块需扩展 `makeKey` switch |
| **六爻算法** | 互卦=上下卦切片反转;**修复过 bug:索引错位**,改时核对 |

## 知识库结构 (`www/kb_data/`)

按流派前缀组织,**RAG 按文件名自动打标签**:
- `bazi_*` (12 个):基础/大运/流年/格局/神煞/十神/调候/紫微合参/合婚/纳音/旬空
- `gua_kb.json` + `liuyao_*` (9 个):纳甲/六亲/六神/旬空/进退/梅花互参/案例
- `qimen_*` (9 个):排盘/用神/格局/星门/占吉/风水结合
- `ziwei_*` (8 个):基础/格局/宫位/四化/大限 v2/双星组合/辅星
- `buddhism_*` / `daoism_*` (7 个):佛教占卜/真言/道教符咒/救火/受戒/斋醮/咒术
- 杂项:`fengshui_*` (3) / `mianxiang_*` (3) / `shouxiang_*` (3) / `xingshi_*` (3) / `meihua_*` (2) / `nihai_xia_*` / `zeri_*` / `wannianli_*` / `qise_*` / `guxiang_*` / `shengxiang_*`

**注意 `*.bak-*` 备份文件**:`*.bak-20260525` / `*.bak-20260604` 是手动备份,删除前确认内容已合并;`.bak-20260604b` 表示同一天第二次备份。

## 调试入口

| 文件 | 用途 |
|------|------|
| `www/test_expert.html` | 单模块专家系统测试 |
| `www/test_expert3.html` | 完整流程(命盘+RAG+AI) |
| `www/test_comprehensive.html` | 综合压测页面 |
| `www/test_liuyao.js` / `test_qimen.js` / `test_xingshi.js` | 命令行 Node 测试(直接 `node www/test_xxx.js`) |
| `www/test_suite.js` | 整套测试入口 |

**测试单文件:** `node www/test_liuyao.js` (需 Node 环境,无打包器)

## 注意事项

- **`extracted/`** 是 APK 解压内容,仅作调试参考,不要修改
- **`www/all_inline.js`** (162KB) 是早期内联打包产物,生产路径用 `www/dist/assets/*.js`,`all_inline.js` 已废弃(详见 CHANGELOG)
- **`www/lib/node_modules/`** 含 lunar-javascript + iztro 源码,仅供 `build_libs.sh` 打包使用,运行时只用生成的 `*.bundle.js`
- **`www/dist/`** 是 Vite 构建产物,gitignore 已忽略
- **`scripts/send-feishu.js`** 含飞书 APP_SECRET,提交前**确认**是否需要轮换
- **`window.APP_VERSION`** 必须在 `index.html` 顶部声明(用于 cache 失效判断)
- **升级 lunar-javascript / iztro**:改 `www/lib/package.json` → `cd www/lib && npm install` → `./build_libs.sh` → 重新 `npm run build`
- **Capacitor 配置**: `capacitor.config.json` 在根目录,`appId=com.divination.master`,`androidScheme=https`(避免混合内容警告)
- **离线知识库**: 没有数据库,所有"知识"都是 `www/kb_data/*.json`;新增知识点直接在对应 `*_kb.json` 加 JSON 即可,RAG 会自动重新索引(浏览器内内存索引,重启 APP 后重建)

## 相关项目

`mbti-test/`、`yeyemusic/` 也是同模式(Capacitor + Vite + 原生 JS)的反编译恢复项目。
