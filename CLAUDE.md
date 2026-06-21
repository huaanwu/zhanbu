# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AI 占卜大师 v1.3.0

Capacitor + Vite + 原生 JS 的多流派占卜 Android 应用。从 APK 反编译恢复，含 65+ 知识库文件，覆盖八字/六爻/奇门/紫微/面相/佛道等多个流派。

## 启动与开发

```bash
npm install
npm run dev                # Vite dev server
npm run build              # Vite build
npm run preview            # 预览构建产物
```

**Android 构建：**
```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 技术栈

- **前端：** Vite 5 + 原生 HTML/CSS/JavaScript（无框架）
- **移动壳：** Capacitor 5
- **知识库：** 本地 JSON 文件（`www/kb_data/*.json`，约 65 个，覆盖多个流派）
- **RAG：** `www/rag.js` 检索增强生成
- **AI：** 通过 DeepSeek/OpenAI 兼容 API（`www/expert.js`，API Key 运行时输入）
- **命理库：** `www/lib/iztro.bundle.js`（紫微斗数）、`www/lib/lunar.bundle.js`（农历）
- **AB 测试：** `www/ab_test.js` 内置实验框架
- **历史/反馈：** `www/history.js`、`www/feedback.js`、`www/feedback-loop.js`
- **缓存：** `www/cache.js`（LRU 优化）
- **服务器：** `www/server.js` 本地开发服务器

## 功能模块

| 模块 | 入口 | 说明 |
|------|------|------|
| 八字分析 | `www/lib/` + `www/kb_data/bazi_*.json` | 日干、大运、流年、格局、神煞、十神、调候 |
| 六爻占卜 | `www/liuyao.js` + `gua_kb.json` | 卦象、纳甲、六亲、六神、旬空、进退、梅花互参 |
| 奇门遁甲 | `www/qimen.js` + `qimen_kb.json` | 排盘解读 |
| 紫微斗数 | `www/lib/iztro.bundle.js` + `ziwei_kb.json` | 命盘分析 |
| 面相学 | `www/expert.js` | 面部特征分析 |
| 佛道模块 | `www/kb_data/buddhism_*.json` + `daoism_*.json` | 佛教、道教占卜/法术知识 |
| AI 解读 | `www/expert.js` | 大模型生成解读报告 |

## 项目结构

```
zhanbu/
├── www/
│   ├── index.html               # 入口 HTML
│   ├── styles.css               # 全局样式
│   ├── expert.js                # AI 解读主逻辑
│   ├── rag.js                   # RAG 检索
│   ├── cache.js                 # LRU 缓存
│   ├── history.js               # 历史记录
│   ├── feedback.js              # 用户反馈
│   ├── feedback-loop.js         # 反馈闭环
│   ├── ab_test.js               # AB 测试框架
│   ├── server.js                # 本地开发服务器
│   ├── liuyao.js                # 六爻算法
│   ├── qimen.js                 # 奇门算法
│   ├── all_inline.js            # 内联打包（如果存在）
│   ├── capacitor.config.json    # Capacitor 配置（打包到 www）
│   ├── cordova.js / cordova_plugins.js
│   ├── kb_data/                 # 知识库（~65 个 JSON）
│   │   ├── bazi_*.json          # 八字类
│   │   ├── gua_kb.json          # 六爻
│   │   ├── qimen_kb.json        # 奇门
│   │   ├── ziwei_kb.json        # 紫微
│   │   ├── buddhism_*.json      # 佛教
│   │   ├── daoism_*.json        # 道教
│   │   └── ...                  # 其他流派
│   ├── lib/                     # 第三方库
│   │   ├── iztro.bundle.js      # 紫微计算
│   │   ├── lunar.bundle.js      # 农历转换
│   │   └── node_modules/        # 库依赖
│   ├── dist/                    # 构建产物
│   └── test_expert*.html        # 调试页面
├── android/                     # Capacitor 生成的 Android 工程
├── extracted/                   # APK 解压内容（调试参考）
├── scripts/
│   └── send-feishu.js           # 飞书推送脚本（DevOps 用）
├── capacitor.config.json
├── vite.config.js
├── CHANGELOG.md                 # 详细更新日志
└── package.json
```

## 关键注意事项

- **API Key 安全：** v1.3.0 起已移除硬编码 API Key（之前是 `DEFAULT_API_KEY`），用户需运行时输入
- **XSS 防护：** v1.3.0 起所有 `innerHTML` 输出用 `escapeHtml` 转义，新代码继续遵循
- **动态加载：** v1.3.0 起禁止 `eval()`，动态加载用 ES Module `import()`
- **缓存：** `cache.js` 实现 LRU，知识库文件多（~65 个）会占用大量内存
- **APK 来源：** `extracted/` 是 APK 解压内容，仅作调试参考
- **调试页面：** `www/test_expert*.html` 是开发期测试入口，可在浏览器打开
- **更新日志：** `CHANGELOG.md` 详细记录每个版本的修复和优化（v1.3.0 是当前版本）
- **从 APK 恢复：** 项目结构经过反编译，与典型 Capacitor 项目结构略有不同（如 `capacitor.config.json` 在 `www/` 内）

## 相关项目

- `mbti-test/`、`yeyemusic/` 也是同模式（Capacitor + Vite + 原生 JS）的反编译恢复项目