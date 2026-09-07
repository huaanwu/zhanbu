/**
 * 梅花易数体用分析核心回归测试
 *
 * 断言以梅花通行规则为基准: 动爻所在经卦为用、另一为体;
 * 用生体大吉 / 体克用小吉 / 比和吉 / 体生用凶(泄) / 用克体大凶。
 * 经典例取自 kb_data/meihua_ext_kb.json 的起卦示例并手工核对体用与互变。
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';'
  + fs.readFileSync('liuyao.js', 'utf-8') + ';'
  + fs.readFileSync('meihua.js', 'utf-8');
eval(code);
var meihua = globalThis.window.meihua;

function expectThrow(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + error.message);
}

runner.module('梅花 API 与生克规则');
runner.test('核心 API 全部存在', function() {
  runner.assert(meihua && typeof meihua.paiGua === 'function');
  runner.assert(typeof meihua.formatMeihuaPrompt === 'function');
  runner.assert(typeof meihua.relationOf === 'function');
  runner.assertEq(Object.keys(meihua.TRIGRAM).length, 8);
});
runner.test('五种体用生克关系吉凶正确', function() {
  runner.assertEq(meihua.relationOf('金', '金').label, '比和');
  runner.assertEq(meihua.relationOf('金', '土').label, '用生体');  // 土生金
  runner.assertEq(meihua.relationOf('金', '土').jixiong, '大吉');
  runner.assertEq(meihua.relationOf('金', '木').label, '体克用');  // 金克木
  runner.assertEq(meihua.relationOf('金', '木').jixiong, '小吉');
  runner.assertEq(meihua.relationOf('木', '火').label, '体生用');  // 木生火
  runner.assertEq(meihua.relationOf('木', '火').jixiong, '凶·泄气');
  runner.assertEq(meihua.relationOf('木', '金').label, '用克体');  // 金克木
  runner.assertEq(meihua.relationOf('木', '金').jixiong, '大凶');
});
runner.test('八卦五行表正确', function() {
  runner.assertEq(meihua.TRIGRAM[1].wuxing, '金');  // 乾
  runner.assertEq(meihua.TRIGRAM[2].wuxing, '金');  // 兑
  runner.assertEq(meihua.TRIGRAM[3].wuxing, '火');  // 离
  runner.assertEq(meihua.TRIGRAM[4].wuxing, '木');  // 震
  runner.assertEq(meihua.TRIGRAM[5].wuxing, '木');  // 巽
  runner.assertEq(meihua.TRIGRAM[6].wuxing, '水');  // 坎
  runner.assertEq(meihua.TRIGRAM[7].wuxing, '土');  // 艮
  runner.assertEq(meihua.TRIGRAM[8].wuxing, '土');  // 坤
});
runner.test('非法输入显式报错', function() {
  expectThrow(function() { meihua.paiGua('wat', {}); }, '未知起卦方式');
  expectThrow(function() { meihua.paiGua('number', { num1: 1.5, num2: 2 }); }, '整数');
  var saved = globalThis.window.liuyao;
  delete globalThis.window.liuyao;
  expectThrow(function() { meihua.paiGua('number', { num1: 1, num2: 2 }); }, 'liuyao');
  globalThis.window.liuyao = saved;
});

runner.module('梅花 原著经典占例(《梅花易数》)');
runner.test('观梅占: 辰年十二月十七日申时 → 泽火革初爻动, 用离火克体兑金', function() {
  // 原著: 5+12+17=34, 34%8余2兑上; 34+9=43, 43%8余3离下; 43%6余1初爻动
  // 革之咸, 用克体 → 断女子折花伤股(凶)
  var pan = meihua.paiGua('time', {
    dt: new Date(2024, 0, 1),
    lunarContext: { lunar: { yearZhiNumber: 5, month: 12, day: 17, hourZhiNumber: 9 } }
  });
  runner.assertEq(pan.gua.name, '泽火革');
  runner.assertEq(pan.dong, 1);
  runner.assertEq(pan.yong.name, '离');
  runner.assertEq(pan.ti.name, '兑');
  runner.assertEq(pan.relation.label, '用克体');
  runner.assertEq(pan.relation.jixiong, '大凶');
  runner.assertEq(pan.bian.name, '泽山咸');
});
runner.test('牡丹占: 巳年三月十六日卯时 → 天风姤五爻动, 用乾金克体巽木', function() {
  // 原著: 6+3+16=25, 25%8余1乾上; 25+4=29, 29%8余5巽下; 29%6余5五爻动
  // 姤之鼎, 用克体 → 断次日午时为马所践毁(凶)
  var pan = meihua.paiGua('time', {
    dt: new Date(2024, 0, 1),
    lunarContext: { lunar: { yearZhiNumber: 6, month: 3, day: 16, hourZhiNumber: 4 } }
  });
  runner.assertEq(pan.gua.name, '天风姤');
  runner.assertEq(pan.dong, 5);
  runner.assertEq(pan.yong.name, '乾');
  runner.assertEq(pan.ti.name, '巽');
  runner.assertEq(pan.relation.label, '用克体');
  runner.assertEq(pan.bian.name, '火风鼎');
});

runner.module('梅花 经典起卦例(KB 示例手工核对)');
runner.test('时间法: 甲辰年五月十五巳时 → 天山遁初爻动, 用艮生体乾大吉', function() {
  // KB meihua_001: 年支辰5+月5+日15=25, 25%8余1乾上; 25+巳6=31, 31%8余7艮下; 31%6余1初爻动
  var pan = meihua.paiGua('time', {
    dt: new Date(2024, 5, 15),
    lunarContext: { lunar: { yearZhiNumber: 5, month: 5, day: 15, hourZhiNumber: 6 } }
  });
  runner.assertEq(pan.gua.name, '天山遁');
  runner.assertEq(pan.dong, 1);
  runner.assertEq(pan.yong.name, '艮');   // 动爻在下卦 → 下卦为用
  runner.assertEq(pan.ti.name, '乾');
  runner.assertEq(pan.relation.label, '用生体');  // 艮土生乾金
  runner.assertEq(pan.relation.jixiong, '大吉');
  runner.assertEq(pan.hu.name, '天风姤');         // 二三四巽 + 三四五乾
  runner.assertEq(pan.bian.name, '天火同人');     // 初爻变, 下艮变离
  runner.assertEq(pan.bian.yongSide.name, '离');
});
runner.test('数字法: 35/78 → 火水未济五爻动, 体坎克用离小吉', function() {
  // KB meihua_002: 35%8余3离上, 78%8余6坎下, 113%6余5五爻动
  var pan = meihua.paiGua('number', { num1: 35, num2: 78 });
  runner.assertEq(pan.gua.name, '火水未济');
  runner.assertEq(pan.dong, 5);
  runner.assertEq(pan.yong.name, '离');   // 动爻在上卦 → 上卦为用
  runner.assertEq(pan.ti.name, '坎');
  runner.assertEq(pan.relation.label, '体克用');  // 坎水克离火
  runner.assertEq(pan.relation.jixiong, '小吉');
});
runner.test('数字法第三数定动爻: 35/78/3 → 三爻动', function() {
  var pan = meihua.paiGua('number', { num1: 35, num2: 78, num3: 3 });
  runner.assertEq(pan.dong, 3);
  runner.assertEq(pan.yong.name, '坎');   // 三爻在下卦
});

runner.module('梅花 体用判定边界');
runner.test('同体用五行 → 比和(乾为天二爻动)', function() {
  var pan = meihua.paiGua('number', { num1: 1, num2: 1 }); // 乾为天, (1+1)%6=2 二爻动
  runner.assertEq(pan.gua.name, '乾为天');
  runner.assertEq(pan.relation.label, '比和');
  runner.assertEq(pan.relation.jixiong, '吉');
});
runner.test('体生用泄气: 雷火丰初爻动(体震木生用离火)', function() {
  var pan = meihua.paiGua('number', { num1: 4, num2: 3 }); // 上震下离, 7%6=1 初爻动
  runner.assertEq(pan.gua.name, '雷火丰');
  runner.assertEq(pan.yong.name, '离');
  runner.assertEq(pan.ti.name, '震');
  runner.assertEq(pan.relation.label, '体生用');
});
runner.test('用克体大凶: 天雷无妄五爻动(用乾金克体震木)', function() {
  var pan = meihua.paiGua('number', { num1: 1, num2: 4 }); // 上乾下震, 5%6=5 五爻动
  runner.assertEq(pan.gua.name, '天雷无妄');
  runner.assertEq(pan.yong.name, '乾');
  runner.assertEq(pan.ti.name, '震');
  runner.assertEq(pan.relation.label, '用克体');
  runner.assertEq(pan.relation.jixiong, '大凶');
});
runner.test('三/四爻动是体用归属分界(同为火泽睽)', function() {
  var lower = meihua.paiGua('number', { num1: 3, num2: 2, num3: 3 }); // 三爻动在下
  runner.assertEq(lower.yong.position, '下卦');
  var upper = meihua.paiGua('number', { num1: 3, num2: 2, num3: 4 }); // 四爻动在上
  runner.assertEq(upper.yong.position, '上卦');
});

runner.module('梅花 prompt 与真实时间起卦');
runner.test('formatMeihuaPrompt 含体用/生克定论/互变/问题', function() {
  var pan = meihua.paiGua('number', { num1: 35, num2: 78 });
  var text = meihua.formatMeihuaPrompt(pan, '这笔生意能成吗');
  runner.assert(text.indexOf('火水未济') >= 0, '应含本卦名');
  runner.assert(text.indexOf('体卦:坎') >= 0, '应含体卦');
  runner.assert(text.indexOf('用卦:离') >= 0, '应含用卦');
  runner.assert(text.indexOf('体克用') >= 0, '应含生克定论');
  runner.assert(text.indexOf('不可更改') >= 0, '应声明结论不可更改');
  runner.assert(text.indexOf('这笔生意能成吗') >= 0, '应含所问之事');
});
runner.test('真实时间起卦结构完整(走农历引擎)', function() {
  var pan = meihua.paiGua('time', { dt: new Date(2026, 5, 28, 14, 30) });
  runner.assert(pan.gua && pan.gua.name.length >= 3, '应有本卦名');
  runner.assert(pan.ti.name !== pan.yong.name || pan.ti.position !== pan.yong.position, '体用应分属两卦');
  runner.assert(['上卦', '下卦'].indexOf(pan.yong.position) >= 0, '用卦应有归属');
  runner.assert(pan.hu.name && pan.bian.name, '应有互卦/变卦');
});

runner.run();
