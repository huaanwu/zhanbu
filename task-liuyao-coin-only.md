# 修真任务：六爻起卦方式只保留铜钱摇卦

项目根 D:\get\zhanbu，改 www/ 下文件。用户决策：六爻以铜钱摇卦为正法，删除 时间/数字/随机/大衍 四种入口。

## 关键约束（先读再动手）
- **梅花易数（meihua.js）复用 liuyao.js 的 `qiGuaByTime`/`qiGuaByNumber`**（meihua.js:85/87），这两个函数是梅花自己的正法入口，**引擎层必须保留**，只在注释里标注"六爻页已不暴露，梅花专用"。
- 小六壬(xiaoliuren)、梅花(meihua)页面的起卦方式选择器（data-xlr-method / data-mh-method）**完全不动**。
- `qiGuaByRandom`/`qiGuaByYarrow`/`yarrowOneChange` 无任何其他调用方，可以从 liuyao.js 删除（删前先全局 grep 确认，含 expert/ 目录）。

## 改动点
1. `www/index.html` 约 324-328 行：六爻页的 5 个方式按钮，删除 时间/数字/随机/大衍，只留"🪙 铜钱"。建议把整个方式选择行移除（只剩一种没得选），铜钱逻辑改为默认固定。若保留行则铜钱按钮常驻 active 且无切换必要——二选一，以 UI 干净为准。
2. `www/app/liuyao.js`：
   - `selLiuyaoMethod` 删除或简化；`state.liuyao.method` 固定 'coin'（state.js 默认值同步改）。
   - `doLiuyao` 里的 method 分支（time/number/coin/yarrow/random，约 58-71 行）只留 coin 路径，其余删除。
   - 数字起卦的输入行 `liuyaoNumberRow` 相关 DOM 与显隐逻辑删除。
   - 寻物占等其他入口若引用 method，一并理顺为固定铜钱。
3. `www/liuyao.js`：删 `qiGuaByRandom`/`qiGuaByYarrow`/`yarrowOneChange` 及其 window.liuyao 导出；`panGua` 的 method 分发只留 'coin'（其他 method 抛"六爻已仅支持铜钱摇卦"错误，不要静默回退）。`qiGuaByTime`/`qiGuaByNumber` 保留并加注释"梅花专用，六爻页不暴露"。
4. `www/test_liuyao.js`：删除/改写针对 random/yarrow/time/number 六爻入口的用例（注意：测 qiGuaByTime/Number 的若实为梅花逻辑可保留但注释说明）；保证铜钱路径、装卦、六亲世应伏神等核心用例全在。
5. `www/sw.js` SW_VERSION 升一级；`www/index.html` liuyao.js/app-liuyao 的 ?v= 升一级。

## 验收（我会独立重跑）
```bash
cd /d/get/zhanbu/www
node test_liuyao.js    # 全过
node test_meihua.js    # 必须 15/15，证明梅花没被你误伤
node test_all.js 2>&1 | tail -5   # 若存在则跑
node --check liuyao.js && node --check app/liuyao.js
grep -rn "qiGuaByYarrow\|qiGuaByRandom\|selLiuyaoMethod\|liuyaoNumberRow" --include="*.js" --include="*.html" . | grep -v node_modules   # 应为空(除 test 里说明性注释)
```
输出：每处改动一句话摘要 + 验收命令真实输出。
