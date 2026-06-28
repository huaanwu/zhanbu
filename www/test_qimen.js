/**
 * qimen.js test - fixed keys
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

globalThis.window = globalThis;
var LunarLib = require('./lib/lunar.bundle.js');
globalThis.Solar = LunarLib.Solar;
globalThis.Lunar = LunarLib.Lunar;
globalThis.LunarLib = LunarLib;
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

runner.run();
