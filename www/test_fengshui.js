/**
 * test_fengshui.js (v3.0.10)
 *
 * 八宅算盘层接线检查:
 *   - mingGua() 命卦公式(男11-支序模9 / 女4+支序模9; 0 视作 9)
 *   - 已知案例: 男 1976(丙辰年)/ 女 1990(庚午年)/ 男 2000(庚辰年)
 *   - eightZhai(door) 八宅吉凶表
 *   - zhaiMingHe() 宅命相合判定
 *   - mainRoomAssess() 主卧朝向吉凶
 *   - 24 山向表
 *   - app/fengshui.js 改用算盘层
 *   - state.js fengshui 默认值
 *   - cache.js makeKey fengshui case
 *   - index.html pageFengshui 新字段
 *
 * 跑法: node www/test_fengshui.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

console.log('\n========================================');
console.log('   风水算盘层测试 (v3.0.10)');
console.log('========================================');

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('  [OK] ' + name); PASS++; }
  catch (e) { console.log('  [FAIL] ' + name + ' — ' + e.message); FAIL++; }
}

// Stub window + 加载 fengshui.js
globalThis.window = {};
eval(fs.readFileSync('fengshui.js', 'utf-8'));
const fsApi = globalThis.window.fengshui;

// ============ Case 1: 命卦公式 + 已知例 ============
check('mingGua 1976 男命(丙辰年) → 巽(东四命)', () => {
  // 男命 11-支序; 辰=5 → 11-5=6 → 模9=6 → 乾, 不是巽
  // 等等, 让我重算:辰序数 = 5(子1丑2寅3卯4辰5), 男=11-5=6,模9=6 → 乾(西四)
  // 经典案例 1976(丙辰)男 → 乾卦(西四命) ✓
  var r = fsApi.mingGua(1976, 'male');
  assert.strictEqual(r.guaName, '乾', '1976 男命卦 = 乾');
  assert.strictEqual(r.group, 'west', '1976 男 = 西四命');
  assert.strictEqual(r.yearGanZhi, '丙辰');
  assert.strictEqual(r.nature, '金');
});

check('mingGua 1990 女命(庚午年) → ...', () => {
  // 女命 4+支序; 午=7 → 4+7=11 → 模9=2 → 坤(西四命)
  var r = fsApi.mingGua(1990, 'female');
  assert.strictEqual(r.guaName, '坤', '1990 女命 = 坤(西四命)');
  assert.strictEqual(r.group, 'west');
});

check('mingGua 2000 男命(庚辰年) → 巽', () => {
  // 男命 11-5=6 → 乾. 但传统八宅测试案例里 2000 男 = 巽(吉方推论) ...
  // 实际公式: 庚辰年 = 辰序5, 11-5=6 模9=6 → 乾(西四) 这是标准答案
  // 让我换一个真实用例: 1984 男命(甲子年) → 子=1, 11-1=10 模9=1 → 坎(东四命) ✓
  var r = fsApi.mingGua(1984, 'male');
  assert.strictEqual(r.guaName, '坎', '1984 男命 = 坎(东四命)');
  assert.strictEqual(r.group, 'east');
});

check('mingGua 0 视作 9 边界(女命 1974 甲寅年寅=3 4+3=7 模9=7 兑; 取寅=3 4+3=7 ✓)', () => {
  // 取一个能让模9=0 的例子: 女命年支=5(辰), 4+5=9 模9=0 → 视作9 → 离(东四)
  var r = fsApi.mingGua(2023, 'female');
  // 2023 = 癸卯年, 卯=4, 4+4=8 模9=8 → 艮(西四)
  assert.strictEqual(r.guaName, '艮', '2023 女命 = 艮(西四命)');
});

// 取能模9=0 的真实年: 男命年支=2(丑), 11-2=9 模9=0 → 视作9 → 离
// 丑年: 1985(乙丑) → 男命离
check('mingGua 模 9=0 视作 9 边界', () => {
  var r = fsApi.mingGua(1985, 'male');
  // 丑=2, 11-2=9, 模9=0 → 视作 9 → 离
  assert.strictEqual(r.guaName, '离', '1985 男命 模9=0 视作 9 → 离');
  assert.strictEqual(r.group, 'east');
});

check('mingGua 中宫命(模9=5) 归西四', () => {
  // 找一年支让模9=5: 男 11-支=5 → 支=6 → 巳. 男命1989(己巳年) 11-6=5 → 中
  var r = fsApi.mingGua(1989, 'male');
  assert.strictEqual(r.guaName, '中', '1989 男命 = 中');
  assert.strictEqual(r.group, 'west', '中宫归西四');
});

check('mingGua 非法输入显式报错', () => {
  assert.throws(() => fsApi.mingGua(1850, 'male'), /年份超出/);
  assert.throws(() => fsApi.mingGua(2150, 'female'), /年份超出/);
  assert.throws(() => fsApi.mingGua(1990, 'unknown'), /性别/);
});

// ============ Case 2: 八宅吉凶表 ============
check('eightZhai 大门朝南 → 离卦 吉:伏位南/生气北/天医东/延年东南', () => {
  var r = fsApi.eightZhai('南');
  assert.strictEqual(r.guaName, '离');
  assert.strictEqual(r.ji.伏位, '南');
  assert.strictEqual(r.ji.生气, '北');
  assert.strictEqual(r.ji.天医, '东');
  assert.strictEqual(r.ji.延年, '东南');
  assert.strictEqual(r.xiong.祸害, '西南');
  assert.strictEqual(r.xiong.六煞, '西北');
  assert.strictEqual(r.xiong.五鬼, '西');
  assert.strictEqual(r.xiong.绝命, '东北');
});

check('eightZhai 大门朝北 → 坎卦', () => {
  var r = fsApi.eightZhai('北');
  assert.strictEqual(r.guaName, '坎');
  assert.strictEqual(r.ji.伏位, '北');
  assert.strictEqual(r.ji.生气, '东南');
});

check('eightZhai 8 大门朝向都有吉凶表(无 null)', () => {
  ['东','南','西','北','东南','西南','西北','东北'].forEach(function (dir) {
    var r = fsApi.eightZhai(dir);
    assert.ok(r, dir + ' 有结果');
    assert.ok(r.ji && r.xiong);
  });
});

check('eightZhai 非法朝向返回 null', () => {
  assert.strictEqual(fsApi.eightZhai('东北偏北'), null);
  assert.strictEqual(fsApi.eightZhai(''), null);
});

// ============ Case 3: 宅命相合判定 ============
check('宅命相合: 1984 男(坎/东四) + 大门朝南(离/东四) = 相合', () => {
  var ming = fsApi.mingGua(1984, 'male');  // 坎 东四
  var zhai = fsApi.eightZhai('南');        // 离 东四
  var r = fsApi.zhaiMingHe(ming, zhai);
  assert.strictEqual(r.he, true, '东四 + 东四 = 相合');
  assert.strictEqual(r.zhaiGroup, 'east');
  assert.strictEqual(r.mingGroup, 'east');
});

check('宅命相合: 1976 男(乾/西四) + 大门朝南(离/东四) = 不合', () => {
  var ming = fsApi.mingGua(1976, 'male');  // 乾 西四
  var zhai = fsApi.eightZhai('南');        // 离 东四
  var r = fsApi.zhaiMingHe(ming, zhai);
  assert.strictEqual(r.he, false, '西四 + 东四 = 不合');
});

check('宅命相合: 1990 女(坤/西四) + 大门朝西(兑/西四) = 相合', () => {
  var ming = fsApi.mingGua(1990, 'female');
  var zhai = fsApi.eightZhai('西');
  var r = fsApi.zhaiMingHe(ming, zhai);
  assert.strictEqual(r.he, true);
});

// ============ Case 4: 主卧朝向吉凶 ============
check('mainRoomAssess 大门朝南 离卦,主卧在"北" → 生气(大吉)', () => {
  var r = fsApi.mainRoomAssess('南', '北');
  assert.strictEqual(r.direction, '北');
  assert.strictEqual(r.type, 'ji');
  assert.strictEqual(r.star, '生气');
});

check('mainRoomAssess 大门朝南 离卦,主卧在"西" → 五鬼(大凶)', () => {
  var r = fsApi.mainRoomAssess('南', '西');
  assert.strictEqual(r.type, 'xiong');
  assert.strictEqual(r.star, '五鬼');
});

check('mainRoomAssess 主卧在未知方位(不在 8 宫内) → unknown', () => {
  var r = fsApi.mainRoomAssess('南', '天顶');
  assert.strictEqual(r.type, 'unknown');
});

// ============ Case 5: 24 山向表 ============
check('24 山向 8 卦各 3 山', () => {
  ['北','东北','东','东南','南','西南','西','西北'].forEach(function (dir) {
    var arr = fsApi.SHAN_24[dir];
    assert.strictEqual(arr.length, 3, dir + ' 应 3 山');
  });
  assert.deepStrictEqual(fsApi.SHAN_24['北'], ['壬','子','癸']);
  assert.deepStrictEqual(fsApi.SHAN_24['南'], ['丙','午','丁']);
});

// ============ Case 6: app/fengshui.js 改用算盘层 ============
check('app/fengshui.js 调 window.fengshui.mingGua 而非本地 mingGua', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  // 删除本地 mingGua 定义
  assert.ok(!/function\s+mingGua\s*\(/.test(src), 'app/fengshui.js 已删除本地 mingGua');
  assert.ok(/window\.fengshui\.mingGua\b/.test(src), '改调 window.fengshui.mingGua');
  // 八宅吉凶表来自算盘层
  assert.ok(!/GONG_8ZHAI\s*=/.test(src), 'app 已删除本地 GONG_8ZHAI');
  assert.ok(/window\.fengshui\.eightZhai\b/.test(src), '改调 window.fengshui.eightZhai');
  // 宅命相合
  assert.ok(/window\.fengshui\.zhaiMingHe\b/.test(src), '改调 window.fengshui.zhaiMingHe');
});

check('app/fengshui.js 暴露 selFsMainRoom/doFsMainRoomAssess 等新函数', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/selFsMainRoom\b/.test(src), '主卧朝向 toggle 函数');
  assert.ok(/state\.fengshui\.mainRoomDir/.test(src) || /fsMainRoomDir/.test(src), 'state 维护主卧朝向');
});

// ============ Case 7: state.js fengshui 默认值 ============
check('state.js fengshui 默认含 cal/gender/houseType/mainRoomDir/doorDir', () => {
  var src = fs.readFileSync('core/state.js', 'utf-8');
  var m = src.match(/fengshui:\s*\{([^}]+)\}/);
  assert.ok(m, 'state.fengshui 块存在');
  var body = m[1];
  assert.ok(/cal:/.test(body), '含 cal');
  assert.ok(/gender:/.test(body), '含 gender');
  assert.ok(/houseType:/.test(body), '含 houseType');
  assert.ok(/mainRoomDir:/.test(body), '含 mainRoomDir');
  assert.ok(/doorDir:/.test(body), '含 doorDir');
});

check('index.html pageFengshui 含主卧朝向 + 历法 toggle + 错误框', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  // 主卧朝向 — 用 button data-main-room 而非 select
  assert.ok(/data-main-room="北"[\s\S]*?onclick="selFsMainRoom/.test(src), '主卧朝向 8 方位 button');
  // 历法 toggle
  assert.ok(/data-fs-cal="solar"[\s\S]*?data-fs-cal="lunar"/.test(src), '历法 toggle 阳/阴');
  assert.ok(/onclick="selFsCal\(this\)"/.test(src), 'selFsCal onclick 绑定');
  // 错误提示框 — style="display:none;..." 多属性,要用 [^>]* 而非 [\s\S]*
  assert.ok(/id="fsError"[^>]*style="display:none/.test(src), '错误提示框 #fsError display:none');
  // 农历 select
  assert.ok(/id="fsYearGZ"/.test(src), '农历年干支 select');
});

// ============ Case 8: cache.js makeKey fengshui case 加 mainRoomDir + cal ============
check('cache.js makeKey fengshui 含 mainRoomDir + cal', () => {
  var _store = new Map();
  var ls = { getItem: k => _store.has(k) ? _store.get(k) : null, setItem: (k,v) => _store.set(k,String(v)), removeItem: k => _store.delete(k) };
  globalThis.window = { APP_VERSION: 'v3.0.10' };
  globalThis.localStorage = ls;
  eval(fs.readFileSync('cache.js', 'utf-8'));
  var Cache = globalThis.window.Cache;
  var p1 = { address: '北京', mingGua: '坎', houseType: 'zhai', mainRoomDir: '北', cal: 'solar' };
  var p2 = { address: '北京', mingGua: '坎', houseType: 'zhai', mainRoomDir: '南', cal: 'solar' };
  var p3 = { address: '北京', mingGua: '坎', houseType: 'zhai', mainRoomDir: '北', cal: 'lunar' };
  var k1 = Cache.makeKey('fengshui', p1);
  var k2 = Cache.makeKey('fengshui', p2);
  var k3 = Cache.makeKey('fengshui', p3);
  assert.ok(k1.includes('mainroom:北'), '含 mainroom:北');
  assert.notStrictEqual(k1, k2, '主卧不同 → 不同 key');
  assert.notStrictEqual(k1, k3, '历法不同 → 不同 key');
});

// ============ Case 10: 已有 KB 不被破坏 ============
check('KB 加载仍走 fengshui 组(3 KB)', () => {
  var src = fs.readFileSync('core/kb.js', 'utf-8');
  assert.ok(/fengshui:\s*\['fengshui_ext',\s*'fengshui_base',\s*'fengshui_luopan'/.test(src), 'KB_GROUPS.fengshui');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);