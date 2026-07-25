/**
 * 小六壬起课核心回归测试
 *
 * 断言以"正月起大安、月上起日、日上起时"通行规则为基准,
 * 关键用例均手工数宫核对(六宫: 大安0 留连1 速喜2 赤口3 小吉4 空亡5)。
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';' + fs.readFileSync('xiaoliuren.js', 'utf-8');
eval(code);
var xlr = globalThis.window.xiaoliuren;

function expectThrow(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + error.message);
}

runner.module('小六壬 API 与元数据');
runner.test('核心 API 全部存在', function() {
  runner.assert(xlr && typeof xlr.paiKe === 'function');
  runner.assert(typeof xlr.formatXiaoliurenPrompt === 'function');
  runner.assertEq(xlr.GONG_NAMES.join(','), '大安,留连,速喜,赤口,小吉,空亡');
});
runner.test('六宫元数据完整(五行/六神/方位/吉凶/口诀/断意)', function() {
  xlr.GONG_NAMES.forEach(function(name) {
    var m = xlr.GONG_META[name];
    runner.assert(m && m.wuxing && m.liushen && m.fangwei && m.jixiong, name + ' 元数据应完整');
    runner.assert(m.koujue.indexOf(name) === 0, name + ' 口诀应以宫名开头');
    runner.assert(m.duanyi.length > 10, name + ' 断意不应为空');
  });
});
runner.test('非法输入显式报错', function() {
  expectThrow(function() { xlr.paiKe('lunar', { month: 0, day: 1, hourZhi: 1 }); });
  expectThrow(function() { xlr.paiKe('lunar', { month: 13, day: 1, hourZhi: 1 }); }, '1-12');
  expectThrow(function() { xlr.paiKe('lunar', { month: 1, day: 31, hourZhi: 1 }); }, '1-30');
  expectThrow(function() { xlr.paiKe('lunar', { month: 1.5, day: 1, hourZhi: 1 }); }, '整数');
  expectThrow(function() { xlr.paiKe('number', { num1: 0, num2: 1, num3: 1 }); });
  expectThrow(function() { xlr.paiKe('wat', {}); }, '未知起课方式');
});

runner.module('小六壬 落宫算法(手工数宫核对)');
runner.test('正月初一子时三宫皆大安(正月起大安)', function() {
  var pan = xlr.paiKe('lunar', { month: 1, day: 1, hourZhi: 1 });
  runner.assertEq(pan.yueGong.name, '大安');
  runner.assertEq(pan.riGong.name, '大安');
  runner.assertEq(pan.shiGong.name, '大安');
  runner.assertEq(pan.final.name, '大安');
});
runner.test('月宫顺推: 二至六月依次留连/速喜/赤口/小吉/空亡, 七月回大安', function() {
  var expect = ['留连', '速喜', '赤口', '小吉', '空亡', '大安'];
  [2, 3, 4, 5, 6, 7].forEach(function(m, i) {
    var pan = xlr.paiKe('lunar', { month: m, day: 1, hourZhi: 1 });
    runner.assertEq(pan.yueGong.name, expect[i]);
  });
});
runner.test('日上起日: 大安月初二落留连, 初七回大安, 三十落空亡', function() {
  runner.assertEq(xlr.paiKe('lunar', { month: 1, day: 2, hourZhi: 1 }).riGong.name, '留连');
  runner.assertEq(xlr.paiKe('lunar', { month: 1, day: 7, hourZhi: 1 }).riGong.name, '大安');
  runner.assertEq(xlr.paiKe('lunar', { month: 1, day: 30, hourZhi: 1 }).riGong.name, '空亡');
});
runner.test('日上起时: 大安日丑时落留连, 亥时空亡', function() {
  runner.assertEq(xlr.paiKe('lunar', { month: 1, day: 1, hourZhi: 2 }).shiGong.name, '留连');
  runner.assertEq(xlr.paiKe('lunar', { month: 1, day: 1, hourZhi: 12 }).shiGong.name, '空亡');
});
runner.test('经典例: 三月初五午时 → 速喜/大安/大安', function() {
  var pan = xlr.paiKe('lunar', { month: 3, day: 5, hourZhi: 7 }); // 午=7
  runner.assertEq(pan.yueGong.name, '速喜');
  runner.assertEq(pan.riGong.name, '大安');
  runner.assertEq(pan.shiGong.name, '大安');
});
runner.test('报数法: 8/15/3 → 留连/赤口/空亡, 大数自动取余', function() {
  var pan = xlr.paiKe('number', { num1: 8, num2: 15, num3: 3 });
  runner.assertEq(pan.yueGong.name, '留连');
  runner.assertEq(pan.riGong.name, '赤口');
  runner.assertEq(pan.shiGong.name, '空亡');
  // 13 % 12 = 1 → 子时; 报数 13 与 1 同宫
  var p13 = xlr.paiKe('number', { num1: 13, num2: 1, num3: 1 });
  runner.assertEq(p13.yueGong.name, '大安');
});

runner.module('小六壬 时间起课与 prompt');
runner.test('时间起课与农历起课结果一致(2026-06-28 14:30 未时)', function() {
  var pan = xlr.paiKe('time', { dt: new Date(2026, 5, 28, 14, 30) });
  runner.assert(pan.lunar && pan.lunar.ganzhi, '应带农历/干支信息');
  runner.assertEq(pan.hourZhi, 8); // 14:30 = 未时(子1…未8)
  var manual = xlr.paiKe('lunar', { month: pan.month, day: pan.day, hourZhi: pan.hourZhi });
  runner.assertEq(manual.yueGong.name, pan.yueGong.name);
  runner.assertEq(manual.riGong.name, pan.riGong.name);
  runner.assertEq(manual.shiGong.name, pan.shiGong.name);
});
runner.test('formatXiaoliurenPrompt 含三传/落宫/口诀/问题', function() {
  var pan = xlr.paiKe('lunar', { month: 3, day: 5, hourZhi: 7 });
  var text = xlr.formatXiaoliurenPrompt(pan, '明日出行顺利吗');
  runner.assert(text.indexOf('月宫：速喜') >= 0, '应含月宫');
  runner.assert(text.indexOf('时宫：大安') >= 0, '应含时宫');
  runner.assert(text.indexOf('落宫为断') >= 0, '应标注落宫为断');
  runner.assert(text.indexOf('大安事事昌') >= 0, '应含落宫口诀');
  runner.assert(text.indexOf('明日出行顺利吗') >= 0, '应含所问之事');
});

runner.run();
