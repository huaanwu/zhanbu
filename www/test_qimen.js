/**
 * qimen.js test - fixed keys
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

globalThis.window = globalThis;
var LunarLib = require('./lib/lunar.bundle.js');
// 注: 旧版 lunar.bundle.js 直接 require 返回空对象(Solar 是 var 未导出)
//     ganzhi.js 通过 vm 沙箱加载, 这里是死代码, 保留仅为向后兼容
if (LunarLib && LunarLib.Solar) globalThis.Solar = LunarLib.Solar;
eval(fs.readFileSync('lib/ganzhi.js', 'utf-8'));
eval(fs.readFileSync('qimen.js', 'utf-8'));
var qimen = globalThis.window.qimen;

runner.module('qimen.js - Qimen System');

runner.test('global object exists', function() {
  runner.assert(qimen !== undefined, 'qimen undefined');
});

runner.test('core functions exist', function() {
  runner.assert(typeof qimen.panQimen === 'function', 'panQimen');
  runner.assert(typeof qimen.formatQimenPrompt === 'function', 'formatQimenPrompt');
});

runner.test('returns correct structure', function() {
  var pan = qimen.panQimen(2026, 6, 28, 14, 0);
  runner.assertHasKeys(pan, ['jushu', 'jushu_text', 'bazi', 'gong9']);
  runner.assert(Array.isArray(pan.gong9), 'gong9 should be array');
  runner.assertEq(pan.gong9.length, 9, 'should have 9 palaces');
  runner.assert(pan.jushu > 0, 'jushu > 0');
});

runner.test('each palace complete', function() {
  var pan = qimen.panQimen(2026, 6, 28, 14, 0);
  for (var i = 0; i < pan.gong9.length; i++) {
    var g = pan.gong9[i];
    runner.assertHasKeys(g, ['gong', 'name', 'tianpan', 'dipan', 'renpan', 'jiuxing', 'shenpan']);
    runner.assert(g.gong >= 1 && g.gong <= 9, 'gong number 1-9');
  }
});

runner.test('different hours yield different jushu', function() {
  var pan1 = qimen.panQimen(2026, 6, 28, 3, 0);
  var pan2 = qimen.panQimen(2026, 6, 28, 15, 0);
  var same = pan1.jushu_text === pan2.jushu_text;
  var sameBazi = pan1.bazi.join(',') === pan2.bazi.join(',');
  // Different hours within same 2-hour shichen may have same jushu
  // But different shichen should have different bazi
  runner.assert(sameBazi === false || same === false, 'different shichen should differ');
});

runner.test('formatQimenPrompt contains question', function() {
  var pan = qimen.panQimen(2026, 6, 28, 14, 0);
  var prompt = qimen.formatQimenPrompt(pan, 'test question');
  runner.assert(prompt.indexOf('test question') >= 0, 'contains question');
});

runner.test('yin/yang dun works', function() {
  var winter = qimen.panQimen(2026, 1, 15, 12, 0);
  runner.assertEq(winter.gong9.length, 9, 'winter 9 palaces');
  var summer = qimen.panQimen(2026, 7, 15, 12, 0);
  runner.assertEq(summer.gong9.length, 9, 'summer 9 palaces');
});

runner.module('qimen.js - 拆补法定局(符头定元)');

runner.test('getYuanByDayGz: 符头地支定三元', function() {
  // 子午卯酉 → 上元(甲子/甲午/己卯/己酉皆上元)
  runner.assertEq(qimen.getYuanByDayGz('甲子').yuanName, '上元');
  runner.assertEq(qimen.getYuanByDayGz('甲午').yuanName, '上元');
  runner.assertEq(qimen.getYuanByDayGz('己卯').yuanName, '上元');
  runner.assertEq(qimen.getYuanByDayGz('己酉').futou, '己酉');
  runner.assertEq(qimen.getYuanByDayGz('己酉').yuanName, '上元');
  // 寅申巳亥 → 中元
  runner.assertEq(qimen.getYuanByDayGz('甲寅').yuanName, '中元');
  runner.assertEq(qimen.getYuanByDayGz('甲申').yuanName, '中元');
  runner.assertEq(qimen.getYuanByDayGz('己巳').yuanName, '中元');
  // 辰戌丑未 → 下元
  runner.assertEq(qimen.getYuanByDayGz('甲辰').yuanName, '下元');
  runner.assertEq(qimen.getYuanByDayGz('己未').yuanName, '下元');
});

runner.test('getYuanByDayGz: 非符头日归本元(元内5天同元)', function() {
  // 戊申日: 本元 甲辰乙巳丙午丁未戊申 → 符头甲辰 → 下元
  var r = qimen.getYuanByDayGz('戊申');
  runner.assertEq(r.futou, '甲辰');
  runner.assertEq(r.yuanName, '下元');
  // 癸酉日: 本元 己巳庚午辛未壬申癸酉 → 符头己巳 → 中元
  var r2 = qimen.getYuanByDayGz('癸酉');
  runner.assertEq(r2.futou, '己巳');
  runner.assertEq(r2.yuanName, '中元');
});

runner.test('定局回归: 2026-07-15 庚寅日 小暑下元 → 阴遁5局(旧天数法误判2局)', function() {
  var pan = qimen.panQimen(2026, 7, 15, 12, 0);
  runner.assertEq(pan.jieqi, '小暑');
  runner.assertEq(pan.yuan, '下元');
  runner.assertEq(pan.futou, '己丑');
  runner.assertEq(pan.jushu, 5);
  runner.assertEq(pan.jushu_text, '阴遁5局');
});

runner.test('定局回归: 2026-07-21 丙申日 小暑上元 → 阴遁8局(旧天数法误判5局)', function() {
  var pan = qimen.panQimen(2026, 7, 21, 12, 0);
  runner.assertEq(pan.jieqi, '小暑');
  runner.assertEq(pan.yuan, '上元');
  runner.assertEq(pan.futou, '甲午');
  runner.assertEq(pan.jushu, 8);
});

runner.test('定局回归: 符头当日(2026-01-15 己丑) 小寒下元 → 阳遁5局', function() {
  var pan = qimen.panQimen(2026, 1, 15, 12, 0);
  runner.assertEq(pan.jieqi, '小寒');
  runner.assertEq(pan.yuan, '下元');
  runner.assertEq(pan.futou, '己丑');
  runner.assertEq(pan.jushu, 5);
});

runner.test('prompt 含定局/符头信息', function() {
  var pan = qimen.panQimen(2026, 7, 15, 12, 0);
  var prompt = qimen.formatQimenPrompt(pan, '');
  runner.assert(prompt.indexOf('拆补法') >= 0, '应含定局法');
  runner.assert(prompt.indexOf('符头己丑') >= 0, '应含符头');
  runner.assert(prompt.indexOf('下元') >= 0, '应含元');
});

runner.run();
