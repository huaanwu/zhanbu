/**
 * liuyao.js test - fixed method check
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';' + fs.readFileSync('liuyao.js', 'utf-8');
globalThis.window = {};
eval(code);
var liuyao = globalThis.window.liuyao;

runner.module('liuyao.js - Liuyao System');

runner.test('global object exists', function() {
  runner.assert(liuyao !== undefined, 'liuyao is undefined');
});

runner.test('core functions exist', function() {
  runner.assert(typeof liuyao.panGua === 'function', 'panGua');
  runner.assert(typeof liuyao.qiGuaByTime === 'function', 'qiGuaByTime');
  runner.assert(typeof liuyao.qiGuaByNumber === 'function', 'qiGuaByNumber');
  runner.assert(typeof liuyao.qiGuaByCoin === 'function', 'qiGuaByCoin');
});

runner.test('time-based divination returns correct structure', function() {
  var pan = liuyao.panGua('time', { dt: new Date(2026, 5, 28, 14, 30) });
  runner.assertHasKeys(pan, ['method', 'datetime', 'timeGanzhi', 'gua', 'yaoList']);
  runner.assert(pan.method && pan.method.length > 0, 'method should be non-empty');
  runner.assertHasKeys(pan.timeGanzhi, ['year', 'month', 'day', 'hour']);
  runner.assert(Array.isArray(pan.yaoList), 'yaoList should be array');
  runner.assertEq(pan.yaoList.length, 6, 'should have 6 yao');
  runner.assertHasKeys(pan.yaoList[0], ['yao', 'name', 'gan', 'zhi', 'wuxing', 'liuqin', 'liushen', 'isDong']);
  runner.assertHasKeys(pan.gua, ['name', 'upper', 'lower', 'dongYaoList']);
  runner.assert(pan.gua.name.length > 0, 'gua name not empty');
});

runner.test('number-based divination', function() {
  var pan = liuyao.panGua('number', { num1: 3, num2: 7, num3: 5 });
  runner.assert(pan.gua.name.length > 0, 'gua name not empty');
  runner.assertEq(pan.yaoList.length, 6, 'should have 6 yao');
});

runner.test('formatLiuyaoPrompt output', function() {
  var pan = liuyao.panGua('time', { dt: new Date() });
  var prompt = liuyao.formatLiuyaoPrompt(pan, 'test question');
  runner.assert(prompt.indexOf('test question') >= 0, 'prompt should contain question');
  runner.assert(prompt.indexOf(pan.gua.name) >= 0, 'prompt should contain gua name');
});

runner.test('liushen and liuqin populated', function() {
  var pan = liuyao.panGua('time', { dt: new Date(2026, 5, 28) });
  for (var i = 0; i < pan.yaoList.length; i++) {
    runner.assert(pan.yaoList[i].liushen && pan.yaoList[i].liushen.length > 0, 'liushen should exist');
    runner.assert(pan.yaoList[i].liuqin && pan.yaoList[i].liuqin.length > 0, 'liuqin should exist');
  }
});

runner.test('64 gua coverage', function() {
  var names = [];
  for (var u = 1; u <= 8; u++) {
    for (var l = 1; l <= 8; l++) {
      try {
        var pan = liuyao.panGua('number', { num1: u, num2: l, num3: 1 });
        if (pan.gua.name) names.push(pan.gua.name);
      } catch(e) {}
    }
  }
  var unique = {};
  for (var i = 0; i < names.length; i++) unique[names[i]] = true;
  var count = Object.keys(unique).length;
  runner.assert(count >= 60, 'should have at least 60 unique gua names, got ' + count);
});

// 回归测试：纳甲上下卦规约
// 规约：trigram 在卦之上(upper, 4-6 爻) → 用 NA_JIA 表前 3;
//       trigram 在卦之下(lower, 1-3 爻) → 用 NA_JIA 表后 3
// 若 slice 顺序错, 六亲/五行/纳甲全部错位
runner.test('纳甲规约：乾为天六爻', function() {
  var pan = liuyao.panGua('number', { num1: 1, num2: 1, num3: 1 });
  var expected = ['壬午','壬申','壬戌','甲子','甲寅','甲辰'];
  var actual = pan.yaoList.map(function(y){ return y.gan + y.zhi; });
  runner.assertEq(actual.join('|'), expected.join('|'), '乾为天 纳甲');
});

runner.test('纳甲规约：天地否六爻', function() {
  var pan = liuyao.panGua('number', { num1: 1, num2: 8, num3: 1 });
  var expected = ['乙丑','乙亥','乙酉','甲子','甲寅','甲辰'];
  var actual = pan.yaoList.map(function(y){ return y.gan + y.zhi; });
  runner.assertEq(actual.join('|'), expected.join('|'), '天地否 纳甲');
});

runner.test('纳甲规约：水雷屯六爻', function() {
  var pan = liuyao.panGua('number', { num1: 6, num2: 4, num3: 1 });
  var expected = ['庚午','庚申','庚戌','戊寅','戊辰','戊午'];
  var actual = pan.yaoList.map(function(y){ return y.gan + y.zhi; });
  runner.assertEq(actual.join('|'), expected.join('|'), '水雷屯 纳甲');
});

runner.test('纳甲规约：64 卦抽样校验', function() {
  // 抽样 16 个卦，验证每卦六爻纳甲与 NA_JIA 表规约一致
  var samples = [
    [1,1],[1,8],[8,1],[8,8],[6,4],[4,6],[7,2],[2,7],
    [5,3],[3,5],[4,7],[7,4],[3,1],[1,3],[5,8],[8,5]
  ];
  for (var i = 0; i < samples.length; i++) {
    var u = samples[i][0], l = samples[i][1];
    var pan = liuyao.panGua('number', { num1: u, num2: l, num3: 1 });
    // 验证六爻的 五行 都来自 NA_JIA 表（不能为空/未知）
    for (var j = 0; j < 6; j++) {
      var y = pan.yaoList[j];
      runner.assert(y.gan && y.zhi && y.wuxing, pan.gua.name + ' 第' + (j+1) + '爻 纳甲非空');
      runner.assert(y.liuqin && y.liuqin !== '未知', pan.gua.name + ' 第' + (j+1) + '爻 六亲已计算');
    }
  }
});

runner.run();
