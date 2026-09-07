# AI占卜大师 更新日志

## v3.1.4 (2026-09-07) — 古籍真符 + 奇门归位

- 道佛模块新增"📜 真符"展区：9 张《道藏》第30册影印本高清真符（百解符/治万病符/三魂符/断后鬼门符/北斗七星符/云篆天书三幅等），逐张标注用途与出处页码
- 奇门遁甲从命理组挪回占卦组（奇门是占法不是命理）
- 修复真符画廊 HTML 转义与 lightbox 变形问题


## v3.1.3 (2026-09-07) — 云端识图接入 DeepSeek 视觉模型

- 手相/面相云端识图：统一走 deepseek-v4-flash-vision-exp（DeepSeek 8月新出的视觉模型），此前云端识图拿 qwen 模型名打 DeepSeek 接口，两条路全断
- 设置页：删除阿里云百炼识图 Key 框（复用 DeepSeek Key），识图模型默认 DeepSeek 视觉版
- 本地识图链路不变（本地 llama-server 多模态优先）
- 修复专家模式六爻起卦报错（上轮只留铜钱误伤专家层）


## v3.1.2 (2026-09-07) — 奇门农历 + 解读截断修复

- 奇门遁甲：新增农历日期显示（此前只有四柱）
- 本地大模型：修复解读被截断只剩几个字（llama-server 上下文 4096 被双路平摊成 2048，已改 32k）
- 大六壬农历显示：代码实测正常，旧版用户请卸载重装（SW 缓存残留）


## v3.1.1 (2026-09-07) — 排盘精度修真

- 大六壬：修复每年冬至交节后~12月31日月将错误（寅将→丑将），该窗口内起课此前全盘皆错
- 奇门遁甲：四柱改用高精度农历引擎，修复年柱不按立春换年、月柱错位 1-2 个月
- 大六壬/六爻：结果页与 AI 解读新增农历日期显示
- 晚子时（23-24 点）四柱五鼠遁自洽
- 六爻：起卦只保留铜钱摇卦（正法），移除时间/数字/随机/大衍入口

## v3.1.0 (2026-07-26) — 风水大版本

风水模块从单流派(v3.0.7 之前的"八宅 + 罗盘")升级为多流派完整体系。

### 新增核心功能

#### 八宅算盘层(v3.0.10)
- 命卦确定性公式:男 11-年支序数 模9 / 女 4+年支序数 模9,0 视作 9
  (原 app/fengshui.js 把命卦推给 AI 推算,违反"确定事实由代码给出"原则,本轮纠正)
- 八宅吉凶表(坎震巽离/乾坤兑艮 8 卦 × 4吉4凶)
- 宅命相合判定(东四命+东四宅 / 西四命+西四宅)
- 主卧朝向吉凶(看主卧门当气口)
- 24 山向表(为 v3.0.19 三层罗盘预留)
- UI:加历法(阳/阴)+ 性别 toggle;断语只显示所选性别;错误提示框

#### 玄空飞星算盘层(v3.0.11)
- 三元九运:1864 起,每运 20 年,1→2→...→9→1 循环
- 当前 2026 = 第 9 运(下元,九紫右弼当旺,2024-2043)
- 运盘/山盘/向盘(洛书轨迹顺飞 9 宫)
- 旺山旺向判定 / 五黄二黑定位
- UI:八宅/玄空 tab 切换,玄空 pane 含 9 宫 SVG

#### SVG 可视化(v3.0.12)
- 罗盘 24 山向圆盘
- 户型方位图(大门/主卧 + 吉凶星位叠加)
- 玄空 9 宫格(五黄/二黑红底,吉星绿底)

#### 罗盘 24 山点击(v3.0.13)
- 每山可点 → 弹详情 modal(五行/纳音/阴阳/描述/应用)
- 9 宫每宫可点 → 弹九星详情(星名/五行/吉凶/应用/化解)
- 全屏遮罩 + 背景点击关闭

#### 流年/流月/流日/流时飞星(v3.0.14-18)
- v3.0.14:流年 + 流月(简化)
- v3.0.15:用 lunar-javascript 引擎精确化流月(干支纪月)
- v3.0.17:流日(60 干支循环)
- v3.0.18:流时(12 时辰 + lunar 引擎 getTimeInGanZhi)
- 全部都有"替卦"版本(主流派 沈氏玄空学 规则)
- 双五黄叠加警告

#### 替卦(v3.0.16)
- 主流派 沈氏玄空学 8 卦→替星表:
  坎1→7,坤2→2,震3→5,巽4→6,乾6→9,兑7→3,艮8→8,离9→4
- UI:toggle "元旦盘(基础)/ 替卦(标准)" 默认替卦
- 商业风水标准做法

#### 三层罗盘(v3.0.19)
- 地盘正针(主"立向",红色)
- 人盘中针(右旋 7.5°,主"消砂",蓝色)
- 天盘缝针(左旋 7.5°,主"纳水",金色)
- 24 山每字 3 份,不同颜色 + offset
- 简化:三层都用同一 24 山字(完整 72 龙 / 120 分金待后续)

### 工程/重构
- 风水算盘层独立:
  - www/fengshui.js(八宅/24 山向)
  - www/xuankong.js(玄空四柱飞星 + 替卦)
  - www/fengshui-visual.js(SVG 渲染 + 点击详情)
- app/fengshui.js 改调算盘层(去除本地 mingGua/GONG_8ZHAI 副本)
- state.js fengshui/xuankong 5+ 维度
- cache.js makeKey 加 fengshui/fengshui_xuankong case
- index.html:八宅/玄空 tab 切换 + 玄空页面历法/性别/坐向/替卦 UI
- script 加载顺序修复(v3.0.10/11 接入时漏了 fengshui.js/xuankong.js/fengshui-visual.js)

### 测试
新增/增强测试:
- test_fengshui.js: 24 case(命卦公式 + 边界 + 八宅吉凶 + 宅命相合 + 24 山 + UI 接线)
- test_xuankong.js: 68 case(三元九运 + 运盘/山盘/向盘 + 替卦 + 流年/流月/流日/流时 + lunar 集成)
- test_fengshui_visual.js: 26 case(罗盘 + 户型图 + 9 宫 + 三层 + 点击详情 + modal)

### 总计
- 全量测试 448/448 PASS(原 354 → v3.1.0 共 94 新 case)
- git commits:285d9d8 (v3.0.10) / be80690 (v3.0.11) / d4bc89a (v3.0.12) / d7550f7 (v3.0.13) /
  b0174fc (v3.0.14) / c94ea59 (v3.0.15) / c3dddd5 (v3.0.16) / b047442 (v3.0.17) /
  b098d25 (v3.0.18) / b0633ff (v3.0.19) 共 10 个

## v3.0.8 (2026-07-25)

### 新功能
- **面相页(图片 + AI 视觉)新流派**: 沿用 shouxiang 路线 — 上传正面/左 45°/右 45° 三张图 + 性别 + 年龄段,调本地 VL 或云端 DeepSeek 流式解读。AI 输出按十二宫/五官/三庭气色/痣相/面型五段式分析,支持与八字/紫微联动交叉印证
- **六爻加 "大衍筮法" 起卦按钮**: 与时间/数字/铜钱/随机并列,走 `panGua('yarrow')` 走四十九策三变归奇法

### 工程/重构
- **`callMultimodalVision` 从 `app/shouxiang.js` 提到 `core/ai-service.js`**: shouxiang 与 mianxiang 共享同一个 VL 封装(本地→云端 fallback + SSE 流式 + abort);新增 `targetEl` 参数让面相可写 `#mxResult`
- **shouxiang.js**: 删除 47 行私有 `callMultimodalVision` 副本,改调 `Core.AI.callMultimodalVision`;`compressImage` 挂到 window 供 mianxiang 复用
- **Cache.makeKey 新增 `case 'mianxiang'`**: 性别 + 3 张图指纹 + 年龄段 + linkPan + `mx-v1` 版本标签
- **Core 接线**: `kb.js` 加 `mianxiang` KB 组/primary/extended/PAGE_KB_GROUPS;`ai-service.js` CFG 加 `mianxiang` 条目(`isCustom+daoism:false+crossLink:bazi/ziwei+ragBudget:1200`);`router.js` PAGE_TO_NAV 加 `mianxiang:zhangua`
- **index.html**: 占卦分组加 "看面相" 卡;设置页 `historyFilterDomain` 加 "面相" 选项;加载 `app/mianxiang.js?v=311`

### 测试
- 新增 `test_mianxiang.js`(8 case):Core.AI 导出 / CFG 配置 / Cache.makeKey 唯一性 / get-set 往返 / Router / KB / app 符号 / index.html 接线
- 全套 **323/323** 通过

## v3.0.7 (2026-07-25)

### 新功能
- **大六壬(三式之首)新流派**: 月将加时(中气换将,含跨年边界)、十干寄宫、四课、**九宗门全实现**(贼克/比用/涉害/遥克/昴星/别责/八专/伏吟/返吟,取不出三传显式报错)、十二天将(昼夜贵人+顺逆布)、三传遁干、旬空;13 个公开课例回归验证(来源 URL 见测试注释)
- **称骨算命(袁天罡称骨)新流派**: 公历→农历(立春换年),60 甲子年重/12 月重/30 日重/12 时重四表求和 → 52 档称骨歌(男女命双断语);数据表双来源交叉核对
- **观音灵签入口**: 占卦分组页加跳转卡直达化解页签筒(100 签功能此前已存在)

### 工程/测试
- 新增 `test_daliuren.js`(30) + `test_chenggu.js`(13),全套 **313/313** 通过
- Android `versionCode 3` / `versionName 3.0.7`;SW 缓存版本 `3.0.7`

## v3.0.6 (2026-07-25)

### 新功能
- **小六壬(掐指一算)新流派**: 时间/农历/报数三种起课,三传落宫(月宫开端→日宫过程→时宫结果)+六宫口诀,五行六神方位确定性给出,AI 只做展开解读
- **梅花易数独立成流派**: 复用六爻起卦引擎,新增体用判定(动爻所在经卦为用)、五行生克吉凶(用生体/体克用/比和/体生用/用克体)、互卦(过程)变卦(结果)参断,AI 按万物类象取象
- **底部导航分组**: 新增 命理(八字/紫微/奇门)、占卦(六爻/小六壬/梅花) 两个分组页,导航 12 按钮 → 8;子页面切换时导航高亮落在所属分组

### 修复
- **奇门定局改拆补法**: 日干支符头定上中下元(子午卯酉上元/寅申巳亥中元/辰戌丑未下元),修复旧"节气天数/5"估元导致的局数错误(如 2026-07-15 旧判阴遁2局,实为5局);缓存 key 加 `chaibu-v1` 隔离旧结果

### 工程/测试
- 新增 `test_xiaoliuren.js`(11) + `test_meihua.js`(13) + 奇门定局回归(6),全套 **268/268** 通过
- 新增 `check-xiaoliuren.cjs` / `check-meihua.cjs` / `check-groups.cjs` Playwright 冒烟脚本
- Android `versionCode 2` / `versionName 3.0.6`;SW 缓存版本 `3.0.6`

## v1.4.0 (Unreleased)

### 新功能
- **SSE 流式 AI 输出 + 停止按钮**: `callDeepSeek` 走 SSE,5 个 AI 解读入口(bazi/ziwei/liuyao/qimen/cross)实时打字机效果;流式期间显示"正在生成..."指示器和⏹停止按钮
- **对话式追问 (ChatSession)**: 新增 `www/chat.js`,每个域独立累积多轮 Q&A(最多 20 轮 LRU);`a` 字段走 AES-GCM 加密
- **设置页"危险区"**: 一键清除所有数据(API Key/历史/反馈/缓存/加密密钥),二次确认后 reload
- **RAG 预热**: `RAG.prewarm()` 用 `requestIdleCallback` 在浏览器空闲时提前建索引;首次 AI 解读不再等 1-3s
- **本地大模型自动发现加固**: 区分 timeout vs network 错误,WebRTC 失败显式提示,多网段 fallback (192.168.0/1 + 10.0.0),错误信息更明确

### 安全/合规
- **`androidScheme: https` → `http`**: 修复本地大模型(LM Studio/Ollama)在 HTTPS WebView 下被 CORS 拒绝的 bug;App 是局域网应用无外网暴露风险
- **AES-GCM 敏感字段加密** (v1.4.3): `history.signal/output/panSnapshot` 和 `feedback.pan` 全部走 `Crypto.encrypt()`;Web Crypto API 256-bit,设备绑定密钥
- **版本升级清理**: v1.4 之前旧版本(明文存储)数据自动清空,重新加密
- **删除死文件**: `all_inline.js` (162KB) + `cordova.js` + `cordova_plugins.js`
- **P1 收尾**: `getXunKong` var 提升顺序、Cache 显式字段、`chainOfThought` 未知 domain 加 `console.warn`、`ABTest.getVariant` 兜底加 warn、`feedback.syncToServer` 注释

### 工程
- **新构建脚本** `scripts/build-web.mjs`: 自动把 Vite 产物合并回 www/ 根目录,解决 webDir 错配
- **`package.json` 新增 `npm run sync`**: build + cap sync 一条龙
- **测试运行器支持 async** (`test_comprehensive.js._runOne`): 用 `await` 等待 async 测试完成

### 测试
- 新增 `test_crypto.js` (6 用例) + `test_chat.js` (9 用例) + `test_liuyao.js` 4 个纳甲回归测试
- 基线: `node www/test_all.js` → **162/162 全过**(原 147 + 6 crypto + 9 chat)
- 测试运行器升级: 同步入口等异步完成再打印

## v1.3.1 (Unreleased)

### Bug 修复
- **P0 chainOfThought key 错位**:`Expert.chainOfThought` 的 domainRules 用英文 key(bazi/liuyao/qimen/ziwei),但 index.html 5 处调用传中文('八字'/'紫微'/'六爻'/'奇门'/'三术同参'),全部走 fallback。改为中英文双 key + 提取 7 个 `_CO_*` 模块级 const
- **P1 innerHTML XSS**:`index.html` 9 处 catch 路径 `${e.message}` 未转义(3105/3344/3661/3806/4264/4410/4512/4664/5147),改 `escapeHtml(e.message)`
- **P2 liuyao lunar 集成**:移除 `liuyao.js` 硬编码绝对路径 `D:/get/zhanbu/www/lib/node_modules/lunar-javascript/lunar.js`,改为相对路径 fallback + 5 处静默 catch 加 console.warn
- **P3 空 catch 加日志**:`index.html` 3 处空 catch(LocalServerDiscovery × 2, LocalModelTest × 1)补 console.warn

### 安全加固 (2026-07-06 综合审计后)
- **P0 六爻纳甲上下颠倒**:`liuyao.js:289` `lowerNJ.slice(0, 3), upperNJ.slice(3)` 颠倒,导致所有 64 卦的 纳甲/五行/六亲 错位。改为 `lowerNJ.slice(3), upperNJ.slice(0, 3)`,符合虞翻纳甲"上卦外三爻 / 下卦内三爻"规约
- **P0 硬编码 DeepSeek API Key**:`index.html:712` `DEFAULT_API_KEY = 'sk-...'` 是真实有效 key,已置空;2794 行 `||` fallback 改为抛错,强制用户走设置页配置
- **P0 历史记录 XSS**:`index.html:892` `item.question` 未转义直接 innerHTML(用户可注入脚本);902 行 `replace(/</g, ...)` 不完整。统一用 `escapeHtml()`
- **P0 知识库内容 XSS**:`index.html:4851-4868` `fuList` 渲染符咒,e.content / e.function / e.usage / e.target / e.title / e.category 全未转义;`5085-5106` `jueList` 同样。统一用 `escapeHtml()`
- **P1 移除 eval 双加载兜底**:`index.html:666-678` 的 `(0, eval)(code)` 违反 CLAUDE.md "禁止 eval" 约束,改为 `checkExpertRAG` 显式错误提示
- **P1 lunar-javascript 浏览器集成**:`liuyao.js:65-72` `_getSolar` 在浏览器中走 `require()` 永远失败,降级到粗算法。改为优先从 `window.Solar`(lunar.bundle.js 暴露)取,真正利用立春/节气精确计算

### 改进
- AI 解读入口统一接入 `getActiveABConfig()` + Cache + Fewshot/CoT 开关(bazi/ziwei/liuyao/qimen/cross 共 5 处)
- `liuyao.js` 暴露高精度排盘函数 `getYearGZEx` / `getMonthGZEx` / `getHourGZEx`(立春换年柱、节气月、早子时/晚子时分支)
- `expert.js` `liuYao.score` / `crossValidate` 用 `SHI_YING + GUA_FULL_TO_SHORT` 双 fallback 推导世应位置(替代不可靠的 `isShi`/`isYing` 标记)

### 测试
- 新增 `www/test_all.js`(master runner)+ 6 个模块单测 + Cache/ABTest/bug_fixes 接线测试
- **新增** `test_liuyao.js` 4 个纳甲回归测试(乾为天 / 天地否 / 水雷屯 + 16 卦抽样校验)
- 基线:`node www/test_all.js` → **147/147 全过**(原 143 + 4 纳甲回归)
- 准确度基线数据存档在 `www/tests/fixtures/accuracy_baseline*.{json,md}`

### 清理
- 删除临时调试文件:`_fix2.js` / `_fix_test.js` / `_original_test.js` / `test_simple.js` / `test_suite.js` / `test_rag.js`(共 6 个)

### Hotfix (2026-06-29)
- **紫微/三术同参 fewshot 占位修复**: 新增 `FEWSHOT_ZIWEI` / `FEWSHOT_QIMEN` / `FEWSHOT_CROSS` 三段专属样例,替换 expert.fewshot map 中六爻占位(此前 AI 跑紫微会拿到六爻样例,术语/格式错位)
- **紫微 crossValidate 增强**: 旧二值硬阈值 → 三方四正密度 + 命宫主星 + 四化加权打分(吉星 +2,煞星 -3,化禄权科 +2,化忌 -2)
- **cache cross key 修正**: 加 `ziwei.mingGong.ganzhi` 字段,防止业务规则变化时缓存错乱
- **send-feishu.js 增强**: 推完 APK 后自动读 `APP_VERSION` + `CHANGELOG.md` 最新段,发版本公告到飞书群(L3 自动同步)
- **杂项**: 删 expert.js 死代码(yearGan 永远 null);`.gitignore` 加 `/www/node_modules`(Vite dev 缓存)

## v1.3.0 (2026-06-22)

### 安全修复
- 修复XSS漏洞：所有innerHTML错误输出使用escapeHtml转义
- 移除硬编码API密钥 DEFAULT_API_KEY
- eval()动态执行改为ES Module import()
- 空catch块添加错误日志

### 核心Bug修复
- 互卦算法修复：正确计算上下卦切片索引
- RAG空结果防御：避免空值崩溃
- 缓存系统LRU优化：实现真正的最近最少使用淘汰

### 性能优化
- 删除kb_embedded.js：节省228KB无效传输
- 知识库加载进度提示：显示X/66实时进度
- Spinner CSS动画：加载状态可视化

### 功能增强
- AB测试支持多元分组和权重配置
- 服务器扫描进度可视化
- 历史记录空状态优化（emoji+引导）
- 7个模块添加错误重试按钮
- 知识库利用率提升至95%（62/65个KB文件）

### 知识库集成（新增）
八字：大运流年、格局、神煞、十神、调候、紫微合参
六爻：纳甲、六亲、六神、旬空、进退、梅花互参、案例
奇门：用神、排盘详解、风水结合、气色
紫微：大限v2、宫位、四化、双星组合
风水：扩展、罗盘
面相/手相：气色扩展、纹理知识
民俗：生肖、民俗、子平、佛教、道教

## v1.2.9 (2026-06-09)
- 初始版本（从APK反编译恢复）

---
*生成于 2026-06-22*