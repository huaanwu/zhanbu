/**
 * expert.js test - fixed mock data
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

globalThis.window = {};
eval(fs.readFileSync('lib/ganzhi.js', 'utf-8'));
eval(fs.readFileSync('expert/tables.js', 'utf-8'));
eval(fs.readFileSync('liuyao.js', 'utf-8'));
eval(fs.readFileSync('expert/bazi.js', 'utf-8'));
eval(fs.readFileSync('expert/liuyao.js', 'utf-8'));
eval(fs.readFileSync('expert/qimen.js', 'utf-8'));
eval(fs.readFileSync('expert/ziwei.js', 'utf-8'));
eval(fs.readFileSync('expert/chain.js', 'utf-8'));
var Expert = globalThis.window.Expert;
var liuyao = globalThis.window.liuyao;

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

runner.test('六爻专家使用排盘层正确变卦和阴阳，不再重复错误线序', function() {
  var pan = liuyao.panGua('number', { _internal:true, num1:1, num2:1, num3:2, dt:new Date(2026,5,28,14,30) });
  var facts = Expert.liuyao(pan);
  runner.assert(facts.indexOf('乾为天 → 变卦天火同人') >= 0, '应输出正确变卦天火同人');
  runner.assert(facts.indexOf('二爻阳甲寅(妻财) → 阴己丑(父母)') >= 0, '应输出阳变阴及正确变爻六亲');
});

runner.test('六爻月令旺相休囚死五态方向正确', function() {
  var pan = liuyao.panGua('number', { _internal:true, num1:1, num2:1, num3:2, dt:new Date(2026,5,28,14,30) });
  var facts = Expert.liuyao(pan);
  [
    '官鬼爻五行火：月令旺',
    '父母爻五行土：月令相（月令生扶）',
    '妻财爻五行木：月令休（生月令泄气）',
    '子孙爻五行水：月令囚（克月令耗力）',
    '兄弟爻五行金：月令死（被月令克）'
  ].forEach(function(text) { runner.assert(facts.indexOf(text) >= 0, '应包含：' + text); });
});

runner.test('六爻专家输出伏神与旬空事实', function() {
  var pan = liuyao.panGua('number', { _internal:true, num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  var facts = Expert.liuyao(pan);
  runner.assert(facts.indexOf('五爻下伏丙子(妻财)') >= 0, '履卦应输出妻财伏神');
  runner.assert(facts.indexOf('旬空') >= 0, '应输出旬空旺衰');
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
