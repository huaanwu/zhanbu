# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI 占卜大师 v3.0.5

Capacitor + Vite + 原生 JS 的多流派占卜 Android / PWA 应用。覆盖八字 / 六爻 / 奇门 / 紫微 / 面相 / 手相 / 风水 / 佛道等流派,65+ 知识库 JSON,DeepSeek/OpenAI/本地大模型 解读。

v3.0 主要升级:
- v1.4: AES-GCM 加密、历史/反馈加密、SSE 流式、ChatSession 追问、本地大模型 CORS 修复
- v2.0: 知识库 bundle、可选真 embedding、TypeScript 渐进迁移、app.js 从 index.html 拆出
- v3.0: PWA + Service Worker 离线、GitHub Actions CI、app.js 按域代码分割、IndexedDB embedding 向量缓存
- v3.0.5: Core 模块拆分(event-bus/toast/ai-service/stream/util/router/state)+ 统一 AI 入口 `Core.AI.interpret()`(缓存 + 流式 + 事件派发)

## 常用命令

```bash
# 依赖与构建
npm install                                            # 装 @capacitor/* + vite + esbuild + typescript
npm run dev                                            # Vite dev (端口 3002,root=www)
npm run build                                          # KB bundle + Vite build + 合并回 www/
npm run build:kb                                       # 仅合并 KB bundle
npm run build:web                                      # 仅把 dist 合并回 www/
npm run typecheck                                      # TypeScript 渐进类型检查
npm test                                               # 运行全部 Node 测试
npm run preview                                        # 预览构建产物

# 离线依赖(紫微/农历库) — 首次或 lunar/iztro 升级时执行
cd www/lib && ./build_libs.sh                          # 用 esbuild 把 lunar-javascript + iztro 打成 IIFE bundle 到 www/lib/*.bundle.js

# Android 构建(产物: android/app/build/outputs/apk/debug/app-debug.apk)
npm run build                                          # 生成 www/ 产物
npx cap sync android                                   # 把 www/ 同步到 android
cd android && ./gradlew assembleDebug

# 一键发布
npm run sync                                           # build + cap sync 一条龙

# 飞书推送 APK(DevOps)
node scripts/send-feishu.js <file_path>                # 默认推到武华安群
```

**重要:** v1.4 起 `npm run build` 已自动跑 Vite + `scripts/build-web.mjs` 把 dist 合并回 www/,直接 `cap sync` 即可。**不要单独 `vite build`**(产物会落到没人用的 www/dist/)。

**v1.4 本地大模型修复:** `androidScheme: http` (从 https 改回)。原因:本地大模型(LM Studio/Ollama)用 HTTP,WebView 在 `https://localhost/` 下 fetch `http://192.168.x.x:port` 会被 CORS 拒绝,导致"自动发现"扫不到。HTTP 协议下 CORS 限制大幅降低,且 app 本就是局域网应用,无外网暴露风险。

## 架构(一张图)

```
┌─────────────────────────────────────────────────────────────┐
│ index.html (SPA,所有页面)                                   │
│   ├─ Core 逻辑: www/app.js (页面切换/设置/历史/流式/AI调用) │
│   ├─ 按域脚本: www/app/{bazi,ziwei,liuyao,qimen,shouxiang,  │
│   │            xingshi,cross,fengshui,daofobuddhism}.js     │
│   ├─ 算盘层: liuyao.js / qimen.js / expert.js / xingshi.js  │
│   ├─ RAG 层: rag.js + vector-cache.js (BM25 + 向量/embedding│
│   │            缓存,KB bundle)                              │
│   ├─ 解读 → cache.js (LRU 50/7天) → history.js (加密)      │
│   └─ PWA: manifest.webmanifest + sw.js (离线缓存)           │
│                                                              │
│ 反馈闭环: feedback.js → feedback-loop.js → 校准注入        │
│ AB 测试: ab_test.js                                         │
│ CI: .github/workflows/ci.yml (test / typecheck / build)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
              Capacitor 8 (androidScheme=http)
                              ↓
                  android/ (原生工程, gradle build)
```

**核心分层:**
- **算盘层** (`expert.js` + `liuyao.js` + `qimen.js` + `xingshi.js`/`visual.js`):100% 准确的命理事实。**原则:确定的事实由代码给出,AI 不允许"创作"推算结果。**
- **RAG 层** (`rag.js` + `vector-cache.js`):BM25 + 中文一/二/三元组 + 标签加权;可选真 embedding API,文档/查询向量缓存在 IndexedDB。
- **AI 层** (`expert.js` / `app.js`):提示词组装 → SSE 流式调用 DeepSeek/OpenAI/本地大模型;API Key 运行时 UI 输入,**禁止硬编码**。
- **隐私层** (`crypto.js` + `chat.js`):敏感 birth/历史/反馈/对话 AES-GCM 加密,设备绑定 key。
- **持久化层** (`history.js` / `feedback.js` / `cache.js` / `chat.js`):localStorage + IndexedDB;**升级 APP 版本时 cache 自动清空**(通过 `window.APP_VERSION` 触发,见 `www/app.js`)。

## 关键约束(v3.0.5 强制)

| 项 | 规则 |
|----|------|
| **API Key** | 运行时 UI 输入,**禁止任何形式的硬编码** |
| **innerHTML** | 所有用户/AI 输出走 `escapeHtml()` 转义,**新代码必须遵循**(XSS 防护) |
| **eval** | **禁止** `eval()`;动态加载改用 ES Module `import()` |
| **catch 空块** | 空 `catch {}` 必须加 `console.warn('[模块] 错误:', e)`,便于线上排查 |
| **缓存 Key** | `Cache.makeKey(domain, params)` 按模块分别构造,新增模块需扩展 `makeKey` switch |
| **六爻算法** | 互卦=上下卦切片反转;改时核对 |
| **版本号** | `window.APP_VERSION` 在 `www/app.js` 维护,升级触发本地缓存清空 |
| **PWA 资源** | manifest / icons 放在 `www/public/`,由 `build-web.mjs` 复制到 `www/` 根目录 |
| **域脚本** | 新增页面逻辑优先放到 `www/app/<domain>.js`,保持 `app.js` 为 Core |
| **Embedding 缓存** | 向量通过 `vector-cache.js` 读写,按文本哈希 + API key 哈希前缀作 key |

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
- **`www/all_inline.js`** (162KB) 是早期内联打包产物,生产路径用 `www/assets/*.css`,`all_inline.js` 已废弃
- **`www/lib/node_modules/`** 含 lunar-javascript + iztro 源码,仅供 `build_libs.sh` 打包使用,运行时只用生成的 `*.bundle.js`
- **`www/dist/`** / **`www/assets/`** 是 Vite 构建产物,gitignore 已忽略
- **PWA 资源**: `www/public/manifest.webmanifest` + `www/public/icons/` 是源文件;构建后出现在 `www/` 根目录
- **Service Worker**: `www/sw.js` 缓存静态资源/KB bundle/API 请求跳过;修改 SW 后浏览器会自动检测并更新
- **`scripts/send-feishu.js`** 含飞书 APP_SECRET,提交前**确认**是否需要轮换
- **`window.APP_VERSION`** 在 `www/app.js` 声明(用于 cache 失效判断)
- **升级 lunar-javascript / iztro**:改 `www/lib/package.json` → `cd www/lib && npm install` → `./build_libs.sh` → 重新 `npm run build`
- **Capacitor 配置**: `capacitor.config.json` 在根目录,`appId=com.divination.master`,`androidScheme=http`(本地大模型 HTTP 访问必需)
- **离线知识库**: 没有数据库,所有"知识"都是 `www/kb_data/*.json`;新增知识点直接在对应 `*_kb.json` 加 JSON,RAG 会自动重新索引
- **CI**: GitHub Actions 在 `.github/workflows/ci.yml`,每次 push/PR 跑 `npm test` / `npm run typecheck` / `npm run build`

## 相关项目

`mbti-test/`、`yeyemusic/` 也是同模式(Capacitor + Vite + 原生 JS)的反编译恢复项目。
