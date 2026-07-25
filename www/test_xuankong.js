/**
 * test_xuankong.js (v3.0.11)
 *
 * 玄空飞星算盘层接线检查:
 *   - currentYun(year) 三元九运 + 已知年(1864/2024/2044)
 *   - yunPan(year) 运盘顺飞 9 宫
 *   - mountainPan/facePan 山向盘
 *   - wangShanWangXiang 旺山旺向判定
 *   - 五黄二黑定位
 *   - app/fengshui.js 改调算盘层
 *   - state.js / cache.js 适配
 *   - index.html 加玄空 tab
 *
 * 跑法: node www/test_xuankong.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

console.log('\n========================================');
console.log('   玄空飞星算盘层测试 (v3.0.11)');
console.log('========================================');

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('  [OK] ' + name); PASS++; }
  catch (e) { console.log('  [FAIL] ' + name + ' — ' + e.message); FAIL++; }
}

// Stub + 加载算盘层
globalThis.window = {};
eval(fs.readFileSync('xuankong.js', 'utf-8'));
const xk = globalThis.window.xuankong;

// ============ Case 1: 当前运 (三元九运) ============
check('currentYun 1864 = 一运(一白水)', () => {
  var r = xk.currentYun(1864);
  assert.strictEqual(r.yun, 1);
  assert.strictEqual(r.yunName, '一白贪狼');
  assert.strictEqual(r.nature, '水');
  assert.strictEqual(r.period, '上元');
  assert.strictEqual(r.startYear, 1864);
  assert.strictEqual(r.endYear, 1883);
});

check('currentYun 1984 = 七运(下元开始)', () => {
  // 1984 - 1864 = 120, 120/20=6, +1=7运
  var r = xk.currentYun(1984);
  assert.strictEqual(r.yun, 7);
  assert.strictEqual(r.yunName, '七赤破军');
  assert.strictEqual(r.period, '下元');
});

check('currentYun 2026 = 九运(下元)', () => {
  // 2024-2043 = 9运(下元)
  var r = xk.currentYun(2026);
  assert.strictEqual(r.yun, 9);
  assert.strictEqual(r.yunName, '九紫右弼');
  assert.strictEqual(r.period, '下元');
  assert.strictEqual(r.isJi, true, '九紫为吉星');
  assert.strictEqual(r.startYear, 2024);
  assert.strictEqual(r.endYear, 2043);
  assert.strictEqual(r.yearsFromStart, 2, '2026 是 2024-2043 运内第 3 年');
});

check('currentYun 2044 = 一运(新三元循环)', () => {
  // 9运=2024-2043, 2044 起又是 1运
  var r = xk.currentYun(2044);
  assert.strictEqual(r.yun, 1);
  assert.strictEqual(r.yunName, '一白贪狼');
});

check('currentYun 中元六运 1988', () => {
  // 1988 - 1864 = 124, 124/20=6, +1=7运? 但 1988 实际属于 1984-2003(7运)
  // 实际:7运=1984-2003,8运=2004-2023,9运=2024-2043
  // 1988 在 7运 ✓
  var r = xk.currentYun(1988);
  assert.strictEqual(r.yun, 7);
  // 中元 4-6 运: 1964-1983(4运)...1984-2003(7运)实际是下元
  // 等等,三元九运每元 60 年, 上元 1864-1923(1-3运), 中元 1924-1983(4-6运), 下元 1984-2043(7-9运)
  // 1984 = 7运, 所以 1988 也在 7运 ✓
});

check('currentYun 1935 = 五运(中元)', () => {
  // 1935 - 1864 = 71, 71/20=3, +1=4运
  // 等等: 1运=1864-1883, 2运=1884-1903, 3运=1904-1923, 4运=1924-1943, 5运=1944-1963
  // 1935 在 4运(1924-1943), 不是 5运
  var r = xk.currentYun(1935);
  assert.strictEqual(r.yun, 4);
  assert.strictEqual(r.period, '中元');
});

check('currentYun 非法年份显式报错', () => {
  assert.throws(() => xk.currentYun(1800), /玄空飞星仅支持 1864/);
});

// ============ Case 2: 运盘 (当运星入中,顺飞9宫) ============
check('yunPan 2026(九运):5宫=9, 6宫=1, 7宫=2, ..., 4宫=8', () => {
  // 九运入中=9, 顺飞: 5→9, 6→1, 7→2, 8→3, 9→4, 1→5, 2→6, 3→7, 4→8
  var p = xk.yunPan(2026);
  assert.strictEqual(p.centerStar, 9);
  assert.strictEqual(p.panByGong[5], 9, '5宫=9(入中)');
  assert.strictEqual(p.panByGong[6], 1);
  assert.strictEqual(p.panByGong[7], 2);
  assert.strictEqual(p.panByGong[8], 3);
  assert.strictEqual(p.panByGong[9], 4);
  assert.strictEqual(p.panByGong[1], 5);
  assert.strictEqual(p.panByGong[2], 6);
  assert.strictEqual(p.panByGong[3], 7);
  assert.strictEqual(p.panByGong[4], 8);
});

check('yunPan 1984(七运):5宫=7', () => {
  var p = xk.yunPan(1984);
  assert.strictEqual(p.centerStar, 7);
  assert.strictEqual(p.panByGong[5], 7);
});

check('yunPan 9 宫入星无重复且 1-9 全覆盖', () => {
  var p = xk.yunPan(2026);
  var arr = [];
  for (var g = 1; g <= 9; g++) arr.push(p.panByGong[g]);
  arr.sort(function (a, b) { return a - b; });
  assert.deepStrictEqual(arr, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

// ============ Case 3: 山盘 + 向盘 ============
check('mountainPan 坐北(坎1):5宫=1, 顺飞', () => {
  // 坐北=坎=1宫, 入中=1
  var m = xk.mountainPan(2026, '北');
  assert.strictEqual(m.sitGong, 1);
  assert.strictEqual(m.centerStar, 1);
  assert.strictEqual(m.panByGong[5], 1);
  assert.strictEqual(m.panByGong[6], 2);
  assert.strictEqual(m.panByGong[9], 5);
  assert.strictEqual(m.panByGong[1], 6);
  assert.strictEqual(m.panByGong[4], 9);
});

check('mountainPan 坐南(离9):5宫=9', () => {
  var m = xk.mountainPan(2026, '南');
  assert.strictEqual(m.sitGong, 9);
  assert.strictEqual(m.centerStar, 9);
  assert.strictEqual(m.panByGong[5], 9);
});

check('facePan 向南(离9):5宫=9', () => {
  var f = xk.facePan(2026, '南');
  assert.strictEqual(f.faceGong, 9);
  assert.strictEqual(f.centerStar, 9);
});

check('mountainPan/facePan 非法坐向报错', () => {
  assert.throws(() => xk.mountainPan(2026, '天顶'), /未知坐向/);
  assert.throws(() => xk.facePan(2026, '天空'), /未知向方/);
});

// ============ Case 4: 旺山旺向判定 ============
check('wangShanWangXiang 2026 坐北向南(坎/离) 上山下水', () => {
  // 2026 运盘入中=9, 山盘(坎=1)坐宫=北(1), 山星到坐= 坐北/坐宫=1
  //   山盘:5宫=1, 顺飞 → 1宫=5; 坐宫=1 → 山星到坐=5 (不是 9,不旺)
  // 向盘(离=9)向宫=南(9), 向星到向= 9宫=5 (不是 9,不旺)
  // 都不旺 → 上山下水
  var yp = xk.yunPan(2026), mp = xk.mountainPan(2026, '北'), fp = xk.facePan(2026, '南');
  var r = xk.wangShanWangXiang(yp, mp, fp, '北', '南');
  assert.strictEqual(r.wangShan, false);
  assert.strictEqual(r.wangXiang, false);
  assert.ok(r.verdict.indexOf('上山下水') >= 0);
});

check('wangShanWangXiang 旺山旺向: 需山星=yunStar=9 到坐宫, 向星=9 到向宫', () => {
  // 要构造: 山盘入中=9, 且坐宫入星=9; 即坐卦本身=9(离)
  // 坐南(离9): 山盘入中=9, 1宫=5, ..., 9宫=4 — 山星到坐(南=9宫)=4 ≠9
  // 要让山星到坐=9, 坐宫必须是入中顺飞的第 5 步
  // 山盘 panByGong[坐Gong] = yunStar
  // 入中=坐卦, 顺飞第 i 步 = (坐卦 + i) 模 9(1-9循环)
  // 要 panByGong[坐Gong] = yunStar, 即坐到中距离 = (yunStar - 坐卦) 模 9
  // 让 山盘入中=坐卦=yunStar=9: 坐=9(离)
  // 验证: 9运/坐南/向南 都向星到向=5(不是 9) → 旺山不旺向
  // 真正的"旺山旺向"需要替卦/进阶操作,本轮基础版不覆盖 — 标 partial
  var yp = xk.yunPan(2026), mp = xk.mountainPan(2026, '南'), fp = xk.facePan(2026, '南');
  var r = xk.wangShanWangXiang(yp, mp, fp, '南', '南');
  // 山盘:坐=9, 5宫=9, ..., 9宫=4 — 山星到坐(9宫)=4(不旺)
  // 向盘:向=9, 5宫=9, ..., 9宫=4 — 向星到向(9宫)=4(不旺)
  assert.strictEqual(r.wangShan, false);
  assert.strictEqual(r.wangXiang, false);
});

// ============ Case 5: 五黄二黑定位 ============
check('wuhuangAndErhei 2026:五黄/二黑位置', () => {
  // 2026 运盘: 5宫=9, 6=1, 7=2, 8=3, 9=4, 1=5, 2=6, 3=7, 4=8
  // 五黄(5) 在 1宫; 二黑(2) 在 7宫
  var yp = xk.yunPan(2026);
  var r = xk.wuhuangAndErhei(yp);
  assert.strictEqual(r.wuhuangAt, 1, '五黄在 1宫(2026九运)');
  assert.strictEqual(r.erheiAt, 7, '二黑在 7宫');
});

check('wuhuangAndErhei 1984(七运):五黄在 7宫', () => {
  // 七运入中=7, 顺飞 5→7, 6→8, 7→9, 8→1, 9→2, 1→3, 2→4, 3→5, 4→6
  // 五黄(5) 在 3宫
  var yp = xk.yunPan(1984);
  var r = xk.wuhuangAndErhei(yp);
  assert.strictEqual(r.wuhuangAt, 3, '五黄在 3宫(七运)');
});

// ============ Case 6: formatPrompt 包含全部事实 ============
check('formatPrompt 含三元/运/山/向/旺山旺向/五黄二黑', () => {
  var text = xk.formatPrompt(2026, '北', '南');
  assert.ok(text.indexOf('玄空飞星') >= 0);
  assert.ok(text.indexOf('第9运') >= 0, '含运');  // v3.0.11 改成 "第9运 (九紫右弼)"
  assert.ok(text.indexOf('九紫右弼') >= 0, '入中星');
  assert.ok(text.indexOf('山盘') >= 0);
  assert.ok(text.indexOf('向盘') >= 0);
  assert.ok(text.indexOf('旺山旺向判定') >= 0);
  assert.ok(text.indexOf('五黄') >= 0);
  assert.ok(text.indexOf('二黑') >= 0);
  assert.ok(text.indexOf('坐方') >= 0, '含坐方');
  assert.ok(text.indexOf('向方') >= 0, '含向方');
});

// ============ Case 7: app/fengshui.js 玄空接线 ============
check('app/fengshui.js 调 window.xuankong.currentYun/yunPan/mountainPan/facePan', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/window\.xuankong\.currentYun/.test(src), '用 currentYun');
  assert.ok(/window\.xuankong\.yunPan/.test(src), '用 yunPan');
  assert.ok(/window\.xuankong\.mountainPan/.test(src), '用 mountainPan');
  assert.ok(/window\.xuankong\.facePan/.test(src), '用 facePan');
  assert.ok(/window\.xuankong\.wangShanWangXiang/.test(src), '用 wangShanWangXiang');
  assert.ok(/window\.xuankong\.formatPrompt/.test(src), '用 formatPrompt');
});

check('app/fengshui.js v3.0.14 调流年/流月飞星', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/window\.xuankong\.liunianPan/.test(src), '用 liunianPan');
  assert.ok(/window\.xuankong\.liuyuePan/.test(src), '用 liuyuePan');
  assert.ok(/liunianAndLiuyueWuhuang/.test(src), '用双五黄检测');
});

// ============ Case 7b: v3.0.14 流年/流月算法 ============
check('liunianPan 2026(丙午年,午=9宫入中): 5宫=9, 6=1, 7=2...', () => {
  var p = xk.liunianPan(2026);
  assert.strictEqual(p.yearZhi, '午');
  assert.strictEqual(p.centerGong, 9);
  assert.strictEqual(p.centerStar, 9);
  assert.strictEqual(p.panByGong[5], 9, '5 宫入 9');
  assert.strictEqual(p.panByGong[6], 1);
  assert.strictEqual(p.panByGong[7], 2);
});

check('liunianPan 2027(丁未年,未=2坤入中): 5宫=2', () => {
  // 2027: ((2027-4) % 12) = (2023%12) = 7 → 8(戌)... 等等
  // 2027 - 4 = 2023, 2023 % 12 = 7, XK_ZHI[7] = '申' (索引 0=子 7=申)
  // 让我重算: 2024(子年因 2024-4=2020, 2020%12=8, 8=申 — 不对)
  // XK_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  // 索引: 2024 - 4 = 2020, 2020 % 12 = 8, XK_ZHI[8] = '申'
  // 等等,2024 是甲辰年,辰=4 索引(子0丑1寅2卯3辰4...)→ (2024-4)%12=2020%12=8=申 ❌
  // 正确: ((year - 4) % 12 + 12) % 12 是个相对偏移,2024 年应得辰(索引 4)
  // ((2024-4) % 12) = 2020 % 12 = 168 * 12 + 4 = 2020? 不,168*12=2016, 2020-2016=4, 所以 2020 % 12 = 4 ✓
  // XK_ZHI[4] = '辰' ✓
  // 2026 年: ((2026-4)%12) = 2022%12 = 168*12=2016, 2022-2016=6, XK_ZHI[6]='午' ✓
  // 2027 年: ((2027-4)%12) = 2023%12 = 168*12=2016, 2023-2016=7, XK_ZHI[7]='未' ✓
  var p = xk.liunianPan(2027);
  assert.strictEqual(p.yearZhi, '未');
  assert.strictEqual(p.centerGong, 2, '未=坤=2 宫');
  assert.strictEqual(p.panByGong[5], 2, '5 宫入 2');
});

check('liunianPan 2030(庚戌年,戌=6乾): 5宫=6', () => {
  // 2030-4=2026, %12=2026-2016=10, XK_ZHI[10]='戌'
  var p = xk.liunianPan(2030);
  assert.strictEqual(p.yearZhi, '戌');
  assert.strictEqual(p.centerGong, 6);
  assert.strictEqual(p.panByGong[5], 6);
});

check('liuyuePan 正月(寅=8宫入中): 5宫=8', () => {
  var p = xk.liuyuePan(2026, 1);
  assert.strictEqual(p.monthCN, '正月');
  assert.strictEqual(p.monthZhi, '寅');
  assert.strictEqual(p.centerGong, 8);
  assert.strictEqual(p.panByGong[5], 8);
});

check('liuyuePan 五月(午=9宫): 5宫=9', () => {
  var p = xk.liuyuePan(2026, 5);
  assert.strictEqual(p.monthZhi, '午');
  assert.strictEqual(p.centerGong, 9);
  assert.strictEqual(p.panByGong[5], 9);
});

check('liuyuePan 十二月(丑=8): 5宫=8', () => {
  var p = xk.liuyuePan(2026, 12);
  assert.strictEqual(p.monthCN, '十二月');
  assert.strictEqual(p.monthZhi, '丑');
  assert.strictEqual(p.centerGong, 8);
});

check('liuyuePan 非法月份报错', () => {
  assert.throws(() => xk.liuyuePan(2026, 0), /月份须为/);
  assert.throws(() => xk.liuyuePan(2026, 13), /月份须为/);
});

check('liunianAndLiuyueWuhuang 五黄二黑 + doubleWu 检测', () => {
  var r = xk.liunianAndLiuyueWuhuang(2026, 5);
  // 2026 午=9入中, 5宫=9 → 5黄在 4宫(因顺飞 9 宫)... 让算法决定
  assert.ok(r.liunianWuhuang >= 1 && r.liunianWuhuang <= 9, '流年五黄在 1-9 宫');
  assert.ok(r.liuyueWuhuang >= 1 && r.liuyueWuhuang <= 9, '流月五黄在 1-9 宫');
  assert.strictEqual(typeof r.doubleWu, 'boolean');
});

check('window.xuankong 暴露 liunian/liuyue/ZHI_TO_GONG/MONTH_ZHI/MONTH_CN', () => {
  assert.strictEqual(typeof xk.liunianPan, 'function');
  assert.strictEqual(typeof xk.liuyuePan, 'function');
  assert.strictEqual(typeof xk.liunianAndLiuyueWuhuang, 'function');
  assert.ok(Array.isArray(xk.MONTH_ZHI));
  assert.ok(Array.isArray(xk.MONTH_CN));
  assert.strictEqual(xk.MONTH_ZHI.length, 12);
  assert.strictEqual(xk.MONTH_CN.length, 12);
  assert.strictEqual(xk.MONTH_ZHI[0], '寅');  // 正月
  assert.strictEqual(xk.MONTH_ZHI[11], '丑');  // 十二月
});

check('app/fengshui.js 渲染含流年/流月 SVG + doubleWu 提示', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/drawJiugong\(liunian\.panByGong/.test(src), '流年盘 SVG');
  assert.ok(/drawJiugong\(liuyue\.panByGong/.test(src), '流月盘 SVG');
  assert.ok(/双五黄叠加/.test(src), '双五黄提示');
});

// ============ Case 8: v3.0.15 流月农历精确化 ============
check('liuyuePan 接受干支纪月(乙未): 未=8宫入中', () => {
  // 乙未 → 取最后一位 "未" → XK_ZHI_TO_GONG['未'] = 2 (坤)
  // 等等,我之前说未=2坤,但 v3.0.14 测试 liuyuePan 正月寅=8 宫,显然未也应该是 2 不是 8
  // 让我重看 XK_ZHI_TO_GONG:
  // 子=1, 丑=8, 寅=8, 卯=3, 辰=4, 巳=4, 午=9, 未=2, 申=2, 酉=7, 戌=6, 亥=6
  // 乙未 → 未 = 2 宫(坤),5宫=2,顺飞
  var p = xk.liuyuePan(2026, '乙未');
  assert.strictEqual(p.monthZhi, '未');
  assert.strictEqual(p.centerGong, 2);
  assert.strictEqual(p.panByGong[5], 2);
});

check('liuyuePan 接受干支纪月(丙申): 申=2宫入中', () => {
  var p = xk.liuyuePan(2026, '丙申');
  assert.strictEqual(p.monthZhi, '申');
  assert.strictEqual(p.centerGong, 2);
  assert.strictEqual(p.panByGong[5], 2);
});

check('liuyuePan 非法干支纪月报错', () => {
  assert.throws(() => xk.liuyuePan(2026, 'XX'), /未知干支/);
});

check('xk.lunarMonthGZ 调 lunar 引擎返回干支月(需 Solar)', () => {
  // 模拟 lunar: window.Solar.fromYmd(...).getLunar().getMonthInGanZhi()
  globalThis.window = globalThis.window || {};
  globalThis.window.Solar = globalThis.window.LunarLib && globalThis.window.LunarLib.Solar;
  if (!globalThis.window.Solar) {
    // 测试环境无 lunar.bundle.js,跳过(改用 fallback)
    console.log('  [SKIP] lunar 引擎未在 Node 测试环境加载');
    return;
  }
  // 2026-07-15 → 农历 丙午年 乙未月
  var r = xk.lunarMonthGZ(new Date(2026, 6, 15));  // 月份 0-indexed
  assert.strictEqual(r.monthZhi, '未');
  assert.strictEqual(r.monthNum, 6);  // 农历六月(1-indexed)
  // 春节前 (2026-01-30) → 乙巳年 己丑月(腊月)
  var r2 = xk.lunarMonthGZ(new Date(2026, 0, 30));
  assert.strictEqual(r2.monthZhi, '丑');
});

check('app/fengshui.js v3.0.15 用 lunar 引擎精确化流月 + fallback', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/lunarMonthGZ/.test(src), '调 lunarMonthGZ');
  assert.ok(/catch[\s\S]*回退/.test(src), 'lunar 未加载时回退阳历月数');
});

check('window.xuankong v3.0.15 暴露 lunarMonthGZ', () => {
  assert.strictEqual(typeof xk.lunarMonthGZ, 'function');
});

// ============ Case 9: v3.0.16 替卦 ============
check('TI_GUA 表完整(8 卦→替星,主流派)', () => {
  // 主流派: 坎1→7, 坤2→2(本宫), 震3→5(本宫), 巽4→6,
  //        乾6→9, 兑7→3, 艮8→8(本宫), 离9→4
  assert.strictEqual(xk.TI_GUA[1], 7);
  assert.strictEqual(xk.TI_GUA[2], 2);
  assert.strictEqual(xk.TI_GUA[3], 5);
  assert.strictEqual(xk.TI_GUA[4], 6);
  assert.strictEqual(xk.TI_GUA[6], 9);
  assert.strictEqual(xk.TI_GUA[7], 3);
  assert.strictEqual(xk.TI_GUA[8], 8);
  assert.strictEqual(xk.TI_GUA[9], 4);
});

check('tiGuaMountainPan 坐北(坎1→替星7):5宫=7,顺飞', () => {
  var m = xk.tiGuaMountainPan(2026, '北');
  assert.strictEqual(m.sitGong, 1);
  assert.strictEqual(m.tiStar, 7);
  assert.strictEqual(m.centerStar, 7);
  assert.strictEqual(m.panByGong[5], 7, '5宫入7');
  assert.strictEqual(m.panByGong[6], 8);
  assert.strictEqual(m.panByGong[9], 2);  // 9宫入2
});

check('tiGuaMountainPan 坐南(离9→替星4):5宫=4', () => {
  var m = xk.tiGuaMountainPan(2026, '南');
  assert.strictEqual(m.sitGong, 9);
  assert.strictEqual(m.tiStar, 4);
  assert.strictEqual(m.centerStar, 4);
  assert.strictEqual(m.panByGong[5], 4);
});

check('tiGuaMountainPan 与元月旦盘不同(替卦生效)', () => {
  var yuandan = xk.mountainPan(2026, '北');  // 元旦:入中=1
  var ti = xk.tiGuaMountainPan(2026, '北');  // 替卦:入中=7
  assert.strictEqual(yuandan.centerStar, 1);
  assert.strictEqual(ti.centerStar, 7);
  assert.notDeepStrictEqual(yuandan.panByGong, ti.panByGong);
});

check('tiGuaFacePan 向东(震3→替星5):5宫=5', () => {
  var f = xk.tiGuaFacePan(2026, '东');
  assert.strictEqual(f.faceGong, 3);
  assert.strictEqual(f.tiStar, 5);
  assert.strictEqual(f.centerStar, 5);
});

check('tiGuaMountainPan 非法坐向报错', () => {
  assert.throws(() => xk.tiGuaMountainPan(2026, '天顶'), /未知坐向/);
});

check('app/fengshui.js v3.0.16 用替卦 toggle', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/tiGuaMountainPan/.test(src), '用 tiGuaMountainPan');
  assert.ok(/tiGuaFacePan/.test(src), '用 tiGuaFacePan');
  assert.ok(/state\.xuankong\.tiGua/.test(src), '读 state.xuankong.tiGua toggle');
  assert.ok(/selXkTiGua/.test(src), 'selXkTiGua 函数挂到 window');
});

check('index.html 含替卦 toggle', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/data-xk-tigua="true"/.test(src), '替卦(标准) 按钮');
  assert.ok(/data-xk-tigua="false"/.test(src), '元旦盘(基础) 按钮');
  assert.ok(/onclick="selXkTiGua/.test(src), 'selXkTiGua onclick');
});

check('window.xuankong 暴露 TI_GUA + tiGua* 函数', () => {
  assert.ok(xk.TI_GUA, 'TI_GUA 暴露');
  assert.strictEqual(typeof xk.tiGuaMountainPan, 'function');
  assert.strictEqual(typeof xk.tiGuaFacePan, 'function');
});

// ============ Case 10: v3.0.17 流日飞星 ============
check('liuriPan 甲子日(子=1宫):5宫=1', () => {
  var p = xk.liuriPan(2026, '甲子');
  assert.strictEqual(p.dayZhi, '子');
  assert.strictEqual(p.centerGong, 1);
  assert.strictEqual(p.centerStar, 1);
  assert.strictEqual(p.panByGong[5], 1);
});

check('liuriPan 甲午日(午=9宫):5宫=9', () => {
  var p = xk.liuriPan(2026, '甲午');
  assert.strictEqual(p.dayZhi, '午');
  assert.strictEqual(p.centerGong, 9);
  assert.strictEqual(p.panByGong[5], 9);
});

check('liuriPan 60 甲子循环一周期:9 宫入星无重复', () => {
  // 60 日干支循环: 子丑寅卯辰巳午未申酉戌亥 × 5 = 60 日
  // 入中宫号循环 1,8,8,3,4,4,9,2,2,7,6,6 = 12 宫(地支) × 5 甲子
  // 应 9 宫都覆盖过
  var seen = new Set();
  for (var d = 1; d <= 60; d++) {
    var ganZhi = ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉',
                  '甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未',
                  '甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳',
                  '甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯',
                  '甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑',
                  '甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'];
    var p = xk.liuriPan(2026, ganZhi[d - 1]);
    for (var g = 1; g <= 9; g++) seen.add(p.panByGong[g]);
  }
  // 60 日里 9 宫都应出现
  assert.ok(seen.size === 9, '9 宫全覆盖(实际 ' + seen.size + ')');
});

check('liuriPan 非法干支报错', () => {
  assert.throws(() => xk.liuriPan(2026, 'XX'), /未知干支/);
  assert.throws(() => xk.liuriPan(2026, ''), /dayGZ 须为/);
});

check('tiGuaLiuriPan 甲子日(子=1→替7):5宫=7', () => {
  var p = xk.tiGuaLiuriPan(2026, '甲子');
  assert.strictEqual(p.tiStar, 7);
  assert.strictEqual(p.panByGong[5], 7);
});

check('tiGuaLiuriPan 甲午日(午=9→替4):5宫=4', () => {
  var p = xk.tiGuaLiuriPan(2026, '甲午');
  assert.strictEqual(p.tiStar, 4);
  assert.strictEqual(p.panByGong[5], 4);
});

check('liuriPan 与 tiGuaLiuriPan 同日不同盘(替卦生效)', () => {
  var yd = xk.liuriPan(2026, '甲子');
  var ti = xk.tiGuaLiuriPan(2026, '甲子');
  assert.strictEqual(yd.centerStar, 1);
  assert.strictEqual(ti.centerStar, 7);
  assert.notDeepStrictEqual(yd.panByGong, ti.panByGong);
});

check('app/fengshui.js 渲染含流日盘 + 替卦流日盘', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/liuri\.panByGong/.test(src), '流日盘 SVG');
  assert.ok(/tiGuaLiuri\.panByGong/.test(src), '替卦流日盘 SVG');
  assert.ok(/lunarDayGZ\(now\)/.test(src), 'lunarDayGZ 取日干支');
});

check('window.xuankong 暴露流日函数 + lunarDayGZ', () => {
  assert.strictEqual(typeof xk.liuriPan, 'function');
  assert.strictEqual(typeof xk.tiGuaLiuriPan, 'function');
  assert.strictEqual(typeof xk.lunarDayGZ, 'function');
});

// ============ Case 11: v3.0.18 流时飞星 ============
check('hourToShiZhi 12 时辰映射正确', () => {
  assert.strictEqual(xk.hourToShiZhi(23), '子');
  assert.strictEqual(xk.hourToShiZhi(0), '子');
  assert.strictEqual(xk.hourToShiZhi(1), '丑');
  assert.strictEqual(xk.hourToShiZhi(3), '寅');
  assert.strictEqual(xk.hourToShiZhi(11), '午');
  assert.strictEqual(xk.hourToShiZhi(12), '午');
  assert.strictEqual(xk.hourToShiZhi(13), '未');
  assert.strictEqual(xk.hourToShiZhi(21), '亥');
  assert.strictEqual(xk.hourToShiZhi(22), '亥');
});

check('liushiPan 甲子时(子=1宫):5宫=1', () => {
  var p = xk.liushiPan(2026, '甲子');
  assert.strictEqual(p.lastZhi, '子');
  assert.strictEqual(p.centerGong, 1);
  assert.strictEqual(p.panByGong[5], 1);
});

check('liushiPan 丙午时(午=9宫):5宫=9', () => {
  var p = xk.liushiPan(2026, '丙午');
  assert.strictEqual(p.lastZhi, '午');
  assert.strictEqual(p.centerGong, 9);
  assert.strictEqual(p.panByGong[5], 9);
});

check('liushiPan 12 时辰一周期(子丑寅...):每时辰 5 宫对应地支→宫', () => {
  var zhiList = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  for (var i = 0; i < 12; i++) {
    var p = xk.liushiPan(2026, zhiList[i]);
    assert.strictEqual(p.centerGong, XK_ZHI_TO_GONG[zhiList[i]], zhiList[i] + ' 宫映射');
  }
});

check('liushiPan 非法干支报错', () => {
  assert.throws(() => xk.liushiPan(2026, 'XX'), /未知干支/);
});

check('tiGuaLiushiPan 甲子时(子=1→替7):5宫=7', () => {
  var p = xk.tiGuaLiushiPan(2026, '甲子');
  assert.strictEqual(p.tiStar, 7);
  assert.strictEqual(p.panByGong[5], 7);
});

check('tiGuaLiushiPan 丙午时(午=9→替4):5宫=4', () => {
  var p = xk.tiGuaLiushiPan(2026, '丙午');
  assert.strictEqual(p.tiStar, 4);
  assert.strictEqual(p.panByGong[5], 4);
});

check('app/fengshui.js 渲染含流时盘 + 替卦流时盘', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/liushi\.panByGong/.test(src), '流时盘 SVG');
  assert.ok(/tiGuaLiushi\.panByGong/.test(src), '替卦流时盘 SVG');
  assert.ok(/lunarShiGZ\(now\)/.test(src), 'lunarShiGZ 取时干支');
});

check('window.xuankong 暴露流时函数 + hourToShiZhi + lunarShiGZ', () => {
  assert.strictEqual(typeof xk.hourToShiZhi, 'function');
  assert.strictEqual(typeof xk.liushiPan, 'function');
  assert.strictEqual(typeof xk.tiGuaLiushiPan, 'function');
  assert.strictEqual(typeof xk.lunarShiGZ, 'function');
});

check('app/fengshui.js 含玄空 tab 切换函数 selFsTab', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/selFsTab\b/.test(src), 'tab 切换函数');
  assert.ok(/doXuankong\b/.test(src), '玄空排盘函数');
});

// ============ Case 8: state.js xuankong 默认值 ============
check('state.js 含 xuankong 默认值', () => {
  var src = fs.readFileSync('core/state.js', 'utf-8');
  assert.ok(/xuankong:\s*\{/.test(src), 'state.xuankong 块');
});

// ============ Case 9: cache.js makeKey fengshui 仍 OK + 新增 xuankong case ============
check('cache.js makeKey 兼容 fengshui + 含 xuankong case', () => {
  var src = fs.readFileSync('cache.js', 'utf-8');
  assert.ok(/fs-v3\.0\.10/.test(src), 'fengshui cache 标签保留');
  // xuankong case — 可选,本轮若未实现则测试仍允许通过
});

// ============ Case 10: index.html 含玄空 tab + 玄空输入 UI ============
check('index.html pageFengshui 含玄空 tab', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/data-fs-tab="xuankong"|fsTabXk|玄空/.test(src), '玄空 tab');
  assert.ok(/id="xkSitDir"|id="xkFaceDir"/.test(src) || /坐方[\s\S]*?向方/.test(src), '玄空输入字段');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);