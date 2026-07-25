/**
 * 称骨算命(袁天罡称骨)核心回归测试
 *
 * 断言基准(两个独立来源交叉核对, 四表完全一致):
 *   [1] https://www.cnblogs.com/muyi-yang/p/19169874 (四表 + 全部断语 + 甲子年正月初一子时=三两九示例)
 *   [2] https://www.ba-zi.ai/blog/bazi-weight-chart  (四表 + 1990-03-15 10:30 = 三两七示例)
 * 用例 2024-02-10 为甲辰年正月初一(2024 春节, 立春 2/4 之后), 2023-03-22 为癸卯年闰二月初一。
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';'
  + fs.readFileSync('chenggu.js', 'utf-8');
eval(code);
var chenggu = globalThis.window.chenggu;

function expectThrow(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + (error && error.message));
}

runner.module('称骨 API 与数据表完整性');
runner.test('核心 API 与数据表全部存在', function() {
  runner.assert(chenggu && typeof chenggu.chengguSuan === 'function');
  runner.assert(typeof chenggu.chengguSuanByLunar === 'function');
  runner.assert(typeof chenggu.formatChengguPrompt === 'function');
  runner.assert(typeof chenggu.qianToText === 'function');
});
runner.test('年/月/日/时四表条目完整(60/12/30/12)', function() {
  runner.assertEq(Object.keys(chenggu.YEAR_WEIGHT).length, 60);
  runner.assertEq(chenggu.MONTH_WEIGHT.slice(1).length, 12);
  runner.assertEq(chenggu.DAY_WEIGHT.slice(1).length, 30);
  runner.assertEq(Object.keys(chenggu.HOUR_WEIGHT).length, 12);
  // 六十甲子抽查(来源[1][2]一致): 甲子1.2 / 己卯1.9 / 戊午1.9 / 癸亥0.6
  runner.assertEq(chenggu.YEAR_WEIGHT['甲子'], 12);
  runner.assertEq(chenggu.YEAR_WEIGHT['己卯'], 19);
  runner.assertEq(chenggu.YEAR_WEIGHT['戊午'], 19);
  runner.assertEq(chenggu.YEAR_WEIGHT['癸亥'], 6);
  // 月/日/时抽查
  runner.assertEq(chenggu.MONTH_WEIGHT[3], 18);  // 三月一两八
  runner.assertEq(chenggu.MONTH_WEIGHT[12], 5);  // 腊月五钱
  runner.assertEq(chenggu.DAY_WEIGHT[1], 5);     // 初一五钱
  runner.assertEq(chenggu.DAY_WEIGHT[30], 6);    // 三十六钱
  runner.assertEq(chenggu.HOUR_WEIGHT['子'], 16);
  runner.assertEq(chenggu.HOUR_WEIGHT['亥'], 6);
});
runner.test('断语档位 21~72 连续无缺(52 档, 男女歌俱全)', function() {
  runner.assertEq(Object.keys(chenggu.VERDICTS).length, 52);
  for (var q = 21; q <= 72; q++) {
    var v = chenggu.VERDICTS[q];
    runner.assert(v, '缺第 ' + q + ' 钱档');
    runner.assert(v.m && v.m.length >= 16, q + ' 钱档缺男命歌');
    runner.assert(v.f && v.f.length >= 16, q + ' 钱档缺女命歌');
  }
});

runner.module('称骨 已知例交叉核对(来源[1][2])');
runner.test('甲子年正月初一日子时 → 三两九钱(来源[1]书例)', function() {
  var pan = chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 1, day: 1, hourZhi: '子' });
  runner.assertEq(pan.totalQian, 39); // 1.2+0.6+0.5+1.6=3.9
  runner.assertEq(pan.totalText, '三两九钱');
  runner.assert(pan.verdict.male.indexOf('不须劳碌过平生') >= 0, '三两九男命歌不符');
  runner.assertEq(pan.weights.year.text, '一两二钱');
  runner.assertEq(pan.weights.hour.text, '一两六钱');
});
runner.test('1990-03-15 10:30(庚午年二月十九巳时) → 三两七钱(来源[2]书例, 走农历引擎)', function() {
  var pan = chenggu.chengguSuan(new Date(1990, 2, 15, 10, 30));
  runner.assertEq(pan.lunar.yearGZ, '庚午');
  runner.assertEq(pan.lunar.month, 2);
  runner.assertEq(pan.lunar.day, 19);
  runner.assertEq(pan.lunar.hourZhi, '巳');
  runner.assertEq(pan.totalQian, 37); // 0.9+0.7+0.5+1.6=3.7
  runner.assertEq(pan.totalText, '三两七钱');
  runner.assert(pan.verdict.male.indexOf('此命般般事不成') >= 0, '三两七男命歌不符');
});
runner.test('2024-02-10 11:00(甲辰年正月初一午时, 春节且立春后) → 二两九钱', function() {
  var pan = chenggu.chengguSuan(new Date(2024, 1, 10, 11, 0));
  runner.assertEq(pan.lunar.yearGZ, '甲辰'); // 立春 2024-02-04, 春节 2024-02-10
  runner.assertEq(pan.lunar.month, 1);
  runner.assertEq(pan.lunar.day, 1);
  runner.assertEq(pan.totalQian, 29); // 0.8+0.6+0.5+1.0=2.9
  runner.assertEq(pan.totalText, '二两九钱');
  runner.assert(pan.verdict.male.indexOf('初年运限未曾亨') >= 0, '二两九男命歌不符');
});
runner.test('2023-03-22 12:00(癸卯年闰二月初一) → 闰月按当月算, 三两四钱', function() {
  var pan = chenggu.chengguSuan(new Date(2023, 2, 22, 12, 0));
  runner.assertEq(pan.lunar.yearGZ, '癸卯');
  runner.assert(pan.lunar.isLeapMonth, '应为闰二月');
  runner.assertEq(pan.lunar.month, 2);
  runner.assertEq(pan.lunar.day, 1);
  runner.assertEq(pan.totalQian, 34); // 1.2+0.7+0.5+1.0=3.4
  runner.assert(pan.verdict.male.indexOf('僧道门中衣禄多') >= 0, '三两四男命歌不符');
});

runner.module('称骨 计算规则边界');
runner.test('最轻组合(壬子年五月初一丑时) → 二两一', function() {
  var pan = chenggu.chengguSuanByLunar({ yearGZ: '壬子', month: 5, day: 1, hourZhi: '丑' });
  runner.assertEq(pan.totalQian, 21);
  runner.assertEq(pan.totalText, '二两一钱');
  runner.assert(pan.verdict.male.indexOf('短命非业谓大空') >= 0);
});
runner.test('最重组合(戊午年三月十八子时) → 七两一', function() {
  var pan = chenggu.chengguSuanByLunar({ yearGZ: '戊午', month: 3, day: 18, hourZhi: '子' });
  runner.assertEq(pan.totalQian, 71);
  runner.assertEq(pan.totalText, '七两一钱');
  runner.assert(pan.verdict.male.indexOf('公侯卿相在其中') >= 0);
});
runner.test('总重=四项之和(真实日期内部一致性)', function() {
  var pan = chenggu.chengguSuan(new Date(2026, 6, 25, 14, 30));
  var sum = pan.weights.year.qian + pan.weights.month.qian + pan.weights.day.qian + pan.weights.hour.qian;
  runner.assertEq(pan.totalQian, sum);
  runner.assert(pan.totalQian >= 21 && pan.totalQian <= 72, '总重应在 21~72 钱');
});
runner.test('钱数转中文', function() {
  runner.assertEq(chenggu.qianToText(36), '三两六钱');
  runner.assertEq(chenggu.qianToText(40), '四两');
  runner.assertEq(chenggu.qianToText(7), '七钱');
  runner.assertEq(chenggu.qianToText(10), '一两');
});

runner.module('称骨 非法输入显式报错');
runner.test('年干支/月/日/时支非法均抛错', function() {
  expectThrow(function() { chenggu.chengguSuanByLunar({ yearGZ: '甲丑', month: 1, day: 1, hourZhi: '子' }); }, '年干支');
  expectThrow(function() { chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 13, day: 1, hourZhi: '子' }); }, '农历月');
  expectThrow(function() { chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 0, day: 1, hourZhi: '子' }); }, '农历月');
  expectThrow(function() { chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 1, day: 31, hourZhi: '子' }); }, '农历日');
  expectThrow(function() { chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 1, day: 1, hourZhi: '猫' }); }, '时支');
  expectThrow(function() { chenggu.chengguSuan('not-a-date'); }, '无效');
});

runner.module('称骨 prompt 组装');
runner.test('formatChengguPrompt 含农历/明细/总重/断语/定论声明/问题', function() {
  var pan = chenggu.chengguSuanByLunar({ yearGZ: '甲子', month: 1, day: 1, hourZhi: '子' });
  var text = chenggu.formatChengguPrompt(pan, '我一生财运如何');
  runner.assert(text.indexOf('甲子年') >= 0, '应含年干支');
  runner.assert(text.indexOf('三两九钱') >= 0, '应含总骨重');
  runner.assert(text.indexOf('一两二钱') >= 0, '应含年重明细');
  runner.assert(text.indexOf('不须劳碌过平生') >= 0, '应含男命断语');
  runner.assert(text.indexOf('劳碌奔波一场空') >= 0, '应含女命断语');
  runner.assert(text.indexOf('不可更改') >= 0, '应声明结论不可更改');
  runner.assert(text.indexOf('我一生财运如何') >= 0, '应含所问之事');
});

runner.run();
