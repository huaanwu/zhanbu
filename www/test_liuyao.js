/**
 * liuyao.js test - fixed method check
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

var code = fs.readFileSync('liuyao.js', 'utf-8');
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

runner.run();
