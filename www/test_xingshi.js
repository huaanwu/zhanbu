/**
 * xingshi.js test - fixed prompt check
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

globalThis.window = {};
eval(fs.readFileSync('xingshi.js', 'utf-8'));
var Xingshi = globalThis.window.Xingshi;

runner.module('xingshi.js - Xingshi System');

runner.test('global object exists', function() {
  runner.assert(Xingshi !== undefined, 'Xingshi undefined');
});

runner.test('core functions exist', function() {
  runner.assert(typeof Xingshi.calculateGege === 'function', 'calculateGege');
  runner.assert(typeof Xingshi.buildXingshiPrompt === 'function', 'buildXingshiPrompt');
  runner.assert(typeof Xingshi.getCharBihua === 'function', 'getCharBihua');
});

runner.test('wuge calculation returns all 5 cells', function() {
  var data = Xingshi.calculateGege('Li', 'Ming');
  runner.assertHasKeys(data, ['tiange', 'renge', 'dige', 'waige', 'zongge', 'sancaiWuge']);
  for (var keys = ['tiange', 'renge', 'dige', 'waige', 'zongge'], i = 0; i < keys.length; i++) {
    runner.assert(Number.isInteger(data[keys[i]]) && data[keys[i]] > 0, keys[i] + ' should be positive int');
  }
  runner.assertType(data.sancaiWuge, 'array');
  runner.assertEq(data.sancaiWuge.length, 3, 'sancai 3 items');
});

runner.test('single character name', function() {
  var data = Xingshi.calculateGege('Wang', 'Yi');
  runner.assert(data.tiange > 0, 'tiange > 0');
  runner.assert(data.renge > 0, 'renge > 0');
});

runner.test('compound surname', function() {
  var data = Xingshi.calculateGege('Ouyang', 'Xue');
  runner.assert(data.tiange > 0, 'compound tiange > 0');
});

runner.test('bihua query', function() {
  var bh = Xingshi.getCharBihua('yi');
  runner.assert(Number.isInteger(bh) && bh > 0, 'chinese char bihua > 0');
  var bh2 = Xingshi.getCharBihua('A');
  runner.assert(Number.isInteger(bh2), 'letter has bihua');
});

runner.test('prompt contains wuge names', function() {
  var data = Xingshi.calculateGege('Zhang', 'Sanfeng');
  var prompt = Xingshi.buildXingshiPrompt(data, 'male', '1990-01-01');
  runner.assert(prompt.indexOf('\u5929') >= 0, 'should contain tian');
  runner.assert(prompt.indexOf('\u4eba') >= 0, 'should contain ren');
  runner.assert(prompt.indexOf('\u5730') >= 0, 'should contain di');
});

runner.test('KANGXI_BIHUA data complete', function() {
  var count = Object.keys(Xingshi.KANGXI_BIHUA || {}).length;
  runner.assert(count > 100, 'KANGXI_BIHUA > 100 chars, got ' + count);
});

runner.run();
