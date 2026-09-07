/**
 * 灵签(观音灵签/关帝灵签)核心回归测试
 *
 * 断言基准(多来源交叉核对, 详见 www/kb_data/guandi_qian_kb.json 的 _comment):
 *   [1] https://temples.tw/stick/fs100 关圣帝君一百签签诗(庙宇采用本)
 *   [2] https://www.xinyi.hk/goods-4478.html 陈哲毅《关圣帝君百首灵签详解》目录(典故名+吉凶等级·版本A)
 *   [3] https://www.maigoo.com/shenghuo/418040.html (1-100签圣意/解曰/东坡解/碧仙注, 典故名·版本B)
 *   [4] 新浪博客《关圣帝君签诗解注一百首》 blog_6066e4860100eq5d (第1-60签)
 *   观音灵签: www/kb_data/buddhism_divine_kb.json (既有 KB, 100签)
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
eval(fs.readFileSync('lingqian.js', 'utf-8'));
var lingqian = globalThis.window.lingqian;

var guanyinKB = JSON.parse(fs.readFileSync('kb_data/buddhism_divine_kb.json', 'utf-8'));
var guandiKB = JSON.parse(fs.readFileSync('kb_data/guandi_qian_kb.json', 'utf-8'));

function expectThrow(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + (error && error.message));
}

runner.module('灵签 API 与 KB 数据完整性');
runner.test('核心 API 全部存在', function() {
  runner.assert(lingqian && typeof lingqian.draw === 'function');
  runner.assert(typeof lingqian.parseQian === 'function');
  runner.assert(typeof lingqian.formatLingqianPrompt === 'function');
  runner.assertEq(lingqian.KIND_NAMES.guanyin, '观音灵签');
  runner.assertEq(lingqian.KIND_NAMES.guandi, '关帝灵签');
});
runner.test('两种 KB 均含 100 签(num 1-100 无缺)', function() {
  function nums(kb) { return kb.entries.filter(function(e) { return typeof e.num === 'number'; }).map(function(e) { return e.num; }).sort(function(a, b) { return a - b; }); }
  var gn = nums(guanyinKB), gd = nums(guandiKB);
  runner.assertEq(gn.length, 100);
  runner.assertEq(gd.length, 100);
  runner.assertEq(gn[0], 1); runner.assertEq(gn[99], 100);
  runner.assertEq(gd[0], 1); runner.assertEq(gd[99], 100);
  // 关帝 KB 每签必备字段
  for (var n = 1; n <= 100; n++) {
    var q = lingqian.parseQian('guandi', n, guandiKB);
    runner.assert(q.poem && q.jie && q.gudian && q.level, '关帝第' + n + '签字段缺失');
  }
  for (var m = 1; m <= 100; m++) {
    var g = lingqian.parseQian('guanyin', m, guanyinKB);
    runner.assert(g.poem && g.jie && g.level, '观音第' + m + '签字段缺失');
  }
});

runner.module('灵签 抽签 draw');
runner.test('抽签范围 1-100(两种签种各抽 200 次)', function() {
  for (var i = 0; i < 200; i++) {
    var a = lingqian.draw('guanyin'), b = lingqian.draw('guandi');
    runner.assert(a >= 1 && a <= 100 && Number.isInteger(a), '观音签号越界: ' + a);
    runner.assert(b >= 1 && b <= 100 && Number.isInteger(b), '关帝签号越界: ' + b);
  }
});
runner.test('seed 可复现(同 seed 同结果, 不同 seed 序列不同)', function() {
  runner.assertEq(lingqian.draw('guanyin', 42), lingqian.draw('guanyin', 42));
  runner.assertEq(lingqian.draw('guandi', 42), lingqian.draw('guandi', 42));
  var seq1 = [lingqian.draw('guandi', 1), lingqian.draw('guandi', 2), lingqian.draw('guandi', 3)];
  var seq2 = [lingqian.draw('guandi', 99), lingqian.draw('guandi', 100), lingqian.draw('guandi', 101)];
  runner.assert(seq1.join(',') !== seq2.join(','), '不同 seed 应产生不同序列');
  // seed 结果仍在范围内
  [1, 7, 42, 123456].forEach(function(s) {
    var v = lingqian.draw('guanyin', s);
    runner.assert(v >= 1 && v <= 100, 'seed 抽签越界');
  });
});

runner.module('灵签 parseQian 与来源核对');
runner.test('观音第1签: 上上·钟离成道·开天辟地作良缘(既有KB)', function() {
  var q = lingqian.parseQian('guanyin', 1, guanyinKB);
  runner.assertEq(q.level, '上上');
  runner.assert(q.title.indexOf('钟离成道') >= 0, 'title: ' + q.title);
  runner.assert(q.poem.indexOf('开天辟地作良缘') >= 0, 'poem: ' + q.poem);
  runner.assert(q.jie.indexOf('大吉') >= 0, 'jie: ' + q.jie);
  runner.assert(q.advice.length > 0, '观音签应有化解建议');
});
runner.test('观音第100签: 下下·末签(既有KB)', function() {
  var q = lingqian.parseQian('guanyin', 100, guanyinKB);
  runner.assertEq(q.level, '下下');
  runner.assert(q.poem.length >= 16, 'poem: ' + q.poem);
  runner.assert(q.title.indexOf('观音灵签第100签') >= 0);
});
runner.test('关帝第1签: 甲甲·大吉·汉高祖入关(来源[1][2][3]一致)', function() {
  var q = lingqian.parseQian('guandi', 1, guandiKB);
  runner.assertEq(q.level, '大吉');
  runner.assertEq(q.ganzhi, '甲甲');
  runner.assert(q.title.indexOf('汉高祖入关') >= 0, 'title: ' + q.title);
  runner.assert(q.gudian.indexOf('汉高祖入关') >= 0 && q.gudian.indexOf('十八学士登瀛洲') >= 0, '应含两版本典故名');
  runner.assert(q.poem.indexOf('巍巍独步向云间') >= 0, 'poem: ' + q.poem);
  runner.assert(q.poem.indexOf('福如东海寿如山') >= 0, 'poem: ' + q.poem);
  runner.assert(q.shengyi.indexOf('功名遂') >= 0, 'shengyi: ' + q.shengyi);
  runner.assert(q.jie.indexOf('谋望') >= 0, 'jie: ' + q.jie);
  runner.assert(q.dongpo.indexOf('云间独步') >= 0, 'dongpo: ' + q.dongpo);
});
runner.test('关帝第100签: 癸癸·上上·唐明宗祷告天(来源[1][2][3]一致)', function() {
  var q = lingqian.parseQian('guandi', 100, guandiKB);
  runner.assertEq(q.level, '上上');
  runner.assertEq(q.ganzhi, '癸癸');
  runner.assert(q.gudian.indexOf('唐明宗祷告天') >= 0, 'gudian: ' + q.gudian);
  runner.assert(q.gudian.indexOf('赵阅道焚香告天') >= 0, '应含另本典故名');
  runner.assert(q.poem.indexOf('我本天仙雷雨师') >= 0, 'poem: ' + q.poem);
  runner.assert(q.poem.indexOf('抽得终签百事宜') >= 0, 'poem: ' + q.poem);
  runner.assert(q.shengyi.indexOf('签诗百') >= 0, 'shengyi: ' + q.shengyi);
});
runner.test('关帝抽查: 第4签下下/第8签上上/第97签上上·买臣五十富贵(来源[1][2])', function() {
  var q4 = lingqian.parseQian('guandi', 4, guandiKB);
  runner.assertEq(q4.level, '下下');
  runner.assertEq(q4.ganzhi, '甲丁');
  runner.assert(q4.poem.indexOf('莫教福谢悔无追') >= 0, 'poem4: ' + q4.poem);
  var q8 = lingqian.parseQian('guandi', 8, guandiKB);
  runner.assertEq(q8.level, '上上');
  runner.assert(q8.gudian.indexOf('大舜耕历山') >= 0);
  var q97 = lingqian.parseQian('guandi', 97, guandiKB);
  runner.assertEq(q97.level, '上上');
  runner.assertEq(q97.ganzhi, '癸庚');
  runner.assert(q97.gudian.indexOf('买臣五十富贵') >= 0, 'gudian97: ' + q97.gudian);
  runner.assert(q97.poem.indexOf('五十功名心已灰') >= 0, 'poem97: ' + q97.poem);
});
runner.test('关帝干支签号规律: 第61签庚甲/第50签戊癸', function() {
  runner.assertEq(lingqian.parseQian('guandi', 61, guandiKB).ganzhi, '庚甲');
  runner.assertEq(lingqian.parseQian('guandi', 50, guandiKB).ganzhi, '戊癸');
});

runner.module('灵签 非法输入显式报错');
runner.test('非法 kind/签号/KB 数据均抛错', function() {
  expectThrow(function() { lingqian.draw('mazu'); }, '未知签种');
  expectThrow(function() { lingqian.draw(''); }, '未知签种');
  expectThrow(function() { lingqian.parseQian('mazu', 1, guandiKB); }, '未知签种');
  expectThrow(function() { lingqian.parseQian('guandi', 0, guandiKB); }, '1-100');
  expectThrow(function() { lingqian.parseQian('guandi', 101, guandiKB); }, '1-100');
  expectThrow(function() { lingqian.parseQian('guandi', 1.5, guandiKB); }, '1-100');
  expectThrow(function() { lingqian.parseQian('guanyin', 'x', guanyinKB); }, '1-100');
  expectThrow(function() { lingqian.parseQian('guandi', 1, {}); }, '知识库数据无效');
  expectThrow(function() { lingqian.parseQian('guandi', 1, { entries: [] }); }, '未找到第 1 签');
});

runner.module('灵签 prompt 组装');
runner.test('formatLingqianPrompt(关帝) 含等级/典故/签诗/圣意/解曰/不可更改声明/问题', function() {
  var q = lingqian.parseQian('guandi', 1, guandiKB);
  var text = lingqian.formatLingqianPrompt(q, '今年事业如何');
  runner.assert(text.indexOf('关帝灵签') >= 0 && text.indexOf('第1签') >= 0, '应含签种与签号');
  runner.assert(text.indexOf('甲甲') >= 0, '应含干支');
  runner.assert(text.indexOf('大吉') >= 0, '应含吉凶等级');
  runner.assert(text.indexOf('汉高祖入关') >= 0, '应含典故');
  runner.assert(text.indexOf('巍巍独步向云间') >= 0, '应含签诗');
  runner.assert(text.indexOf('圣意') >= 0 && text.indexOf('功名遂') >= 0, '应含圣意');
  runner.assert(text.indexOf('解曰') >= 0, '应含解曰');
  runner.assert(text.indexOf('东坡解') >= 0 && text.indexOf('碧仙注') >= 0, '应含东坡解/碧仙注');
  runner.assert(text.indexOf('不可更改') >= 0, '应声明签文不可更改');
  runner.assert(text.indexOf('今年事业如何') >= 0, '应含所问之事');
});
runner.test('formatLingqianPrompt(观音) 含签意/化解/问题', function() {
  var q = lingqian.parseQian('guanyin', 1, guanyinKB);
  var text = lingqian.formatLingqianPrompt(q, '求姻缘');
  runner.assert(text.indexOf('观音灵签') >= 0, '应含签种');
  runner.assert(text.indexOf('上上') >= 0, '应含等级');
  runner.assert(text.indexOf('签意') >= 0, '应含签意');
  runner.assert(text.indexOf('化解建议') >= 0, '应含化解建议');
  runner.assert(text.indexOf('求姻缘') >= 0, '应含问题');
});

runner.run();
