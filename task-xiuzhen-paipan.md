# 占卜软件排盘修真任务书（审查方已定位根因，按单修，勿自由发挥）

项目根：D:\get\zhanbu，前端代码在 www/。排盘是 100% 确定性算法，AI 只解读。

## 已实锤的 Bug（带证据，逐条修）

### Bug 1（P0）：大六壬月将每年冬至交节后~12月31日全错
- 文件：`www/daliuren.js` 的 `dlrYueJiangFromDate(dt)`（约 117-134 行）
- 根因：`lunar.getJieQiTable()` 里的"冬至"永远是**上一年**的（实测：2026-12-22 的表中 冬至=2025-12-21、小雪=2026-11-22、大寒=2026-1-20，**没有 2026-12-22 的当年冬至**）。于是冬至交节后找"最近已过中气"错配成小雪 → 寅将（应为丑将）。
- 证据：2026-12-22 12:30 软件给寅将，sxtwl 独立库核算冬至=2026-12-22 04:50 左右，之后应为丑将。
- **修法**：改用 `lunar.getPrevJieQi()` 链式回溯（`getPrevJieQi()` 返回最近节气，若名字不在中气表 DLR_ZHONGQI 里，取该节气的 solar 往前 1 秒再造 Lunar 继续 getPrevJieQi，直到命中中气）。此路径精确到时刻、无跨年缺项。**禁止**继续用 getJieQiTable。
- 注意 `lunar.getPrevJieQi()` 存在性先用 node 实测确认；若该 API 无参数回溯能力，用 `Solar.fromYmdHms(...).getLunar()` 以交节日-1天构造再取。

### Bug 2（P0）：奇门遁甲四柱年/月柱错误
- 文件：`www/qimen.js` `panQimen()` 约 384-389 行
- 根因：用了粗算法 `getYearGZ(year)`（不按立春换年）和 `getMonthGZ(yearGZ[0], month)`（把公历月当节气月，结构性错位 1-2 个月）。
- 证据：2026-09-07 10:30 奇门四柱=丙午 **戊戌** 甲申 己巳，正确=丙午 **丙申** 甲申 己巳；2026-01-15 奇门=丙午年，正确=乙巳年（未过立春）。
- **修法**：改用高精度引擎——与 liuyao.js 的 `getLunarContext` 同款路径（`Solar.fromYmdHms(...).getLunar()` + `lunar.getEightChar()`），取 year/month 两柱；dayGZ/hourGZ 现有逻辑不动（已验证正确，且局数/符头依赖它）。
- 奇门引擎未加载时的行为：与 liuyao 一致，抛错，**不静默降级粗算法**。

### Bug 3（P1）：大六壬/六爻结果页和 AI prompt 缺农历日期
- `www/daliuren.js` `paiKe`（time 模式）：把已有的 lunar 对象的农历文本带出，加 `pan.lunarText`（格式：`二〇二六年七月廿六` + 闰月标注 + 时辰支）。
- `www/app/daliuren.js` `renderDaliuren`：在 gua-info 行加"农历"项（参考 `app/xiaoliuren.js:54` 的写法）。
- `formatDaliurenPrompt`：四柱行后加农历行。
- `www/liuyao.js` panGua 返回里已有 lunar context，确认 `pan.lunar` 含农历文本（没有就补），`www/app/liuyao.js` 的 gua-info 行同样加"农历"显示。

### Bug 4（P1）：晚子时（23:00-24:00）四柱自相矛盾 + 注释撒谎
- 现象：daliuren/liuyao 走 EightChar 默认 sect，23 点时日柱不换（子正换日）但时柱按次日干推 → 显示"甲申日丙子时"这种五鼠遁不可能组合。且 `daliuren.js:443` 注释自称"日柱按子初(23:00)换日"与实际不符。
- **修法（保守，不改课体行为）**：保持日柱子正换日不变（课只用日干+时支，不受影响）；让时柱显示按本日干推（五鼠遁自洽）。lunar-javascript EightChar 有 setSect，用 node 实测哪个 sect 让"日柱不变+时柱按本日"，选用之；若做不到就只在大六壬/六爻的显示层用 `getHourGZ(dayGZ[0], hour)`（ganzhi.js 已有）覆盖时柱显示。修注释使其与实际一致。奇门 23 点行为本次不动（流派分歧，另行决策）。
- 约束：**三传/卦象结果必须逐位不变**（用回归测试证明）。

## 必须做的收尾
1. `www/sw.js` 的 `SW_VERSION` 升一级（cache-first 不升版本用户手机端拿不到新代码）。
2. `www/index.html` 里 daliuren.js / qimen.js / liuyao.js / app 对应 script 标签的 `?v=` 参数升一级。
3. 给 `www/test_daliuren.js` 加回归用例：冬至交节后（2026-12-22 12:30）月将=丑将；`www/test_qimen.js` 加：2026-09-07 月柱=丙申、2026-01-15 年柱=乙巳。

## 验收命令（修完我会独立跑，别自报完成就算完）
```bash
cd /d/get/zhanbu/www
node test_daliuren.js   # 原 30 例全过 + 新冬至例
node test_qimen.js      # 原 13 例全过 + 新四柱例
node test_liuyao.js && node test_meihua.js && node test_xiaoliuren.js  # 不得回归
node --check daliuren.js && node --check qimen.js && node --check liuyao.js && node --check app/daliuren.js && node --check app/liuyao.js
```
我还会用 sxtwl 独立库对拍冬至窗口月将和奇门四柱，结果以我的验收为准。

## 边界
- 只改 www/ 下上述文件 + 测试文件 + sw.js/index.html 版本号。**不动** lib/ganzhi.js 的粗算法函数签名（qimen 停用它们即可），不动 kb_data、rag、core/。
- 发现任务书与实际代码不符（行号漂移等），以根因描述为准。
- 最后输出：每个 bug 的 diff 摘要 + 你本地跑验收命令的真实输出。
