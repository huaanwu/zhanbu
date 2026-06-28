# AI占卜大师 更新日志

## v1.3.1 (Unreleased)

### Bug 修复
- **P0 chainOfThought key 错位**:`Expert.chainOfThought` 的 domainRules 用英文 key(bazi/liuyao/qimen/ziwei),但 index.html 5 处调用传中文('八字'/'紫微'/'六爻'/'奇门'/'三术同参'),全部走 fallback。改为中英文双 key + 提取 7 个 `_CO_*` 模块级 const
- **P1 innerHTML XSS**:`index.html` 9 处 catch 路径 `${e.message}` 未转义(3105/3344/3661/3806/4264/4410/4512/4664/5147),改 `escapeHtml(e.message)`
- **P2 liuyao lunar 集成**:移除 `liuyao.js` 硬编码绝对路径 `D:/get/zhanbu/www/lib/node_modules/lunar-javascript/lunar.js`,改为相对路径 fallback + 5 处静默 catch 加 console.warn
- **P3 空 catch 加日志**:`index.html` 3 处空 catch(LocalServerDiscovery × 2, LocalModelTest × 1)补 console.warn

### 改进
- AI 解读入口统一接入 `getActiveABConfig()` + Cache + Fewshot/CoT 开关(bazi/ziwei/liuyao/qimen/cross 共 5 处)
- `liuyao.js` 暴露高精度排盘函数 `getYearGZEx` / `getMonthGZEx` / `getHourGZEx`(立春换年柱、节气月、早子时/晚子时分支)
- `expert.js` `liuYao.score` / `crossValidate` 用 `SHI_YING + GUA_FULL_TO_SHORT` 双 fallback 推导世应位置(替代不可靠的 `isShi`/`isYing` 标记)

### 测试
- 新增 `www/test_all.js`(master runner)+ 6 个模块单测 + Cache/ABTest/bug_fixes 接线测试
- 基线:`node www/test_all.js` → 143/143 全过(liuyao 7 + qimen 7 + xingshi 8 + expert 10 + visual 7 + accuracy 104)
- 准确度基线数据存档在 `www/tests/fixtures/accuracy_baseline*.{json,md}`

### 清理
- 删除临时调试文件:`_fix2.js` / `_fix_test.js` / `_original_test.js` / `test_simple.js` / `test_suite.js` / `test_rag.js`(共 6 个)

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