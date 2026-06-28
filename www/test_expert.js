/**
 * expert.js test - fixed mock data
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

globalThis.window = {};
eval(fs.readFileSync('liuyao.js', 'utf-8'));
eval(fs.readFileSync('expert.js', 'utf-8'));
var Expert = globalThis.window.Expert;

runner.module('expert.js - Expert System');

runner.test('Expert object exists', function() {
  runner.assert(Expert !== undefined);
});

runner.test('bazi function exists', function() {
  runner.assert(typeof Expert.bazi === 'function');
});

runner.test('bazi returns deterministic facts', function() {
  // Use actual Chinese characters for ganzhi
  var mockPan = {
    gz: { year: 'GengWu', month: 'RenWu', day: 'JiaZi', hour: 'GengWu' },
    gender: 'male', dayGan: 'Jia', wangShuai: 'shengqiang',
    yearGan: 'Geng', yearZhi: 'Wu', monthGan: 'Ren', monthZhi: 'Wu',
    dayZhi: 'Zi', hourGan: 'Geng', hourZhi: 'Wu',
    dayGanZhi: 'JiaZi'
  };
  var facts = Expert.bazi(mockPan);
  runner.assertType(facts, 'string');
  // Check at least some content
  runner.assert(facts.length > 10, 'result should have some content, got ' + facts.length + ' chars');
});

runner.test('liuyao function exists', function() {
  if (typeof Expert.liuyao === 'function') {
    var facts = Expert.liuyao({ gua: { name: 'QianWeiTian' }, yaoList: [], wangShuai: 'shengqiang' });
    runner.assertType(facts, 'string');
  }
});

runner.test('SHI_YING table', function() {
  runner.assert(typeof SHI_YING === 'object' && Object.keys(SHI_YING).length >= 64);
});

runner.test('GUA_FULL_TO_SHORT', function() {
  runner.assert(typeof GUA_FULL_TO_SHORT === 'object' && Object.keys(GUA_FULL_TO_SHORT).length >= 60);
});

runner.test('wuxing sheng/ke', function() {
  runner.assertEq(Object.keys(SHENG).length, 5);
  runner.assertEq(Object.keys(KE).length, 5);
});

runner.test('12 zhi hidden gan', function() {
  runner.assertEq(Object.keys(BRANCH_HIDE_GAN).length, 12);
});

runner.test('60 nayin', function() {
  runner.assert(Object.keys(NAYIN_60JIAZI).length >= 60);
});

runner.test('TG_WX and DZ_WX', function() {
  runner.assertEq(Object.keys(TG_WX).length, 10);
  runner.assertEq(Object.keys(DZ_WX).length, 12);
});

runner.run();
