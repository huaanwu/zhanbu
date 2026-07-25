/**
 * 六爻排盘核心回归测试
 *
 * 这些断言以京房纳甲、八宫世应和梅花时间起卦通行规则为基准，
 * 刻意避免仅检查“字段非空”而把错误算法测绿。
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';' + fs.readFileSync('liuyao.js', 'utf-8');
eval(code);
var liuyao = globalThis.window.liuyao;
eval(fs.readFileSync('app/liuyao.js', 'utf-8'));

var CLASSIC_NAJIA = {
  '乾': ['甲子','甲寅','甲辰','壬午','壬申','壬戌'],
  '兑': ['丁巳','丁卯','丁丑','丁亥','丁酉','丁未'],
  '离': ['己卯','己丑','己亥','己酉','己未','己巳'],
  '震': ['庚子','庚寅','庚辰','庚午','庚申','庚戌'],
  '巽': ['辛丑','辛亥','辛酉','辛未','辛巳','辛卯'],
  '坎': ['戊寅','戊辰','戊午','戊申','戊戌','戊子'],
  '艮': ['丙辰','丙午','丙申','丙戌','丙子','丙寅'],
  '坤': ['乙未','乙巳','乙卯','癸丑','癸亥','癸酉']
};

var PALACE_GROUPS = {
  '乾': ['乾为天','天风姤','天山遁','天地否','风地观','山地剥','火地晋','火天大有'],
  '坎': ['坎为水','水泽节','水雷屯','水火既济','泽火革','雷火丰','地火明夷','地水师'],
  '艮': ['艮为山','山火贲','山天大畜','山泽损','火泽睽','天泽履','风泽中孚','风山渐'],
  '震': ['震为雷','雷地豫','雷水解','雷风恒','地风升','水风井','泽风大过','泽雷随'],
  '巽': ['巽为风','风天小畜','风火家人','风雷益','天雷无妄','火雷噬嗑','山雷颐','山风蛊'],
  '离': ['离为火','火山旅','火风鼎','火水未济','山水蒙','风水涣','天水讼','天火同人'],
  '坤': ['坤为地','地雷复','地泽临','地天泰','雷天大壮','泽天夬','水天需','水地比'],
  '兑': ['兑为泽','泽水困','泽地萃','泽山咸','水山蹇','地山谦','雷山小过','雷泽归妹']
};
var PALACE_WX = { '乾':'金','兑':'金','离':'火','震':'木','巽':'木','坎':'水','艮':'土','坤':'土' };
var TRIGRAM_NAMES = [null,'乾','兑','离','震','巽','坎','艮','坤'];
var RELATION_BY_PALACE = {
  '金': { '金':'兄弟','木':'妻财','水':'子孙','火':'官鬼','土':'父母' },
  '木': { '木':'兄弟','火':'子孙','土':'妻财','金':'官鬼','水':'父母' },
  '水': { '水':'兄弟','木':'子孙','火':'妻财','土':'官鬼','金':'父母' },
  '火': { '火':'兄弟','土':'子孙','金':'妻财','水':'官鬼','木':'父母' },
  '土': { '土':'兄弟','金':'子孙','水':'妻财','木':'官鬼','火':'父母' }
};
var SHI_BY_ORDER = [6,1,2,3,4,5,4,3];
var YING_BY_ORDER = [3,4,5,6,1,2,1,6];
var EXPECTED_META = {};
Object.keys(PALACE_GROUPS).forEach(function(palace) {
  PALACE_GROUPS[palace].forEach(function(name, idx) {
    EXPECTED_META[name] = { palace: palace, wuxing: PALACE_WX[palace], shi: SHI_BY_ORDER[idx], ying: YING_BY_ORDER[idx] };
  });
});

function withRandom(values, fn) {
  var old = Math.random;
  var i = 0;
  Math.random = function() { return values[i++ % values.length]; };
  try { return fn(); } finally { Math.random = old; }
}

function assertThrows(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + error.message);
}

runner.module('六爻 API 与输入边界');
runner.test('核心 API 全部存在', function() {
  runner.assert(liuyao && typeof liuyao.panGua === 'function');
  ['qiGuaByTime','qiGuaByNumber','qiGuaByRandom','qiGuaByCoin','tossCoin'].forEach(function(name) {
    runner.assert(typeof liuyao[name] === 'function', name + ' 应存在');
  });
});
runner.test('非法日期和未知起卦方法会显式报错', function() {
  assertThrows(function() { liuyao.panGua('time', { dt: new Date('invalid') }); }, '日期');
  assertThrows(function() { liuyao.panGua('unknown', {}); }, '起卦方式');
});
runner.test('数字起卦支持 0/负整数的数学模并拒绝小数', function() {
  var r = liuyao.qiGuaByNumber(0, -1, 0);
  runner.assertEq(r.upper, 8, '0 余数应映射坤8');
  runner.assertEq(r.lower, 7, '-1 对8取正模应为7');
  runner.assertEq(r.dong, 6, '0 余数应映射上爻6');
  assertThrows(function() { liuyao.qiGuaByNumber(1.5, 2, 3); }, '整数');
});

runner.module('四种起卦方法');
runner.test('经典农历时间起卦：2026-07-19 05:47 → 离上艮下、五爻动', function() {
  // 农历丙午年六月初六卯时：午7 + 月6 + 日6 = 19 → 离3；再加卯4 = 23 → 艮7；23 % 6 = 5。
  var r = liuyao.qiGuaByTime(new Date(2026, 6, 19, 5, 47));
  runner.assertEq(r.upper, 3, '上卦离');
  runner.assertEq(r.lower, 7, '下卦艮');
  runner.assertEq(r.dong, 5, '五爻动');
  runner.assertEq(r.lunar.month, 6, '农历六月');
  runner.assertEq(r.lunar.day, 6, '农历初六');
  runner.assertEq(r.lunar.hourZhi, '卯', '卯时');
});
runner.test('数字起卦：22/77/45 → 坎上巽下、三爻动', function() {
  var r = liuyao.qiGuaByNumber(22, 77, 45);
  runner.assertEq(r.upper, 6); runner.assertEq(r.lower, 5); runner.assertEq(r.dong, 3);
});
runner.test('铜钱两字一背为少阳，一字两背为少阴', function() {
  var laoYin = withRandom([0.1,0.1,0.1], function() { return liuyao.tossCoin(); });
  var shaoYang = withRandom([0.1,0.1,0.9], function() { return liuyao.tossCoin(); });
  var shaoYin = withRandom([0.1,0.9,0.9], function() { return liuyao.tossCoin(); });
  var laoYang = withRandom([0.9,0.9,0.9], function() { return liuyao.tossCoin(); });
  runner.assertEq([laoYin.yao,laoYin.isDong,laoYin.label].join('|'), '0|true|老阴');
  runner.assertEq([shaoYang.yao,shaoYang.isDong,shaoYang.label].join('|'), '1|false|少阳');
  runner.assertEq([shaoYin.yao,shaoYin.isDong,shaoYin.label].join('|'), '0|false|少阴');
  runner.assertEq([laoYang.yao,laoYang.isDong,laoYang.label].join('|'), '1|true|老阳');
});
runner.test('随机起卦均匀直取1..8/1..8/1..6且方法名正确', function() {
  var r = withRandom([0, 0.999999, 0.5], function() { return liuyao.qiGuaByRandom(); });
  runner.assertEq(r.method, '随机起卦');
  runner.assertEq(r.upper, 1); runner.assertEq(r.lower, 8); runner.assertEq(r.dong, 4);
});
runner.test('铜钱六次均为少阳时得到乾为天静卦', function() {
  var pan = withRandom([0.1,0.1,0.9], function() { return liuyao.panGua('coin', { dt: new Date(2026,5,28,14,30) }); });
  runner.assertEq(pan.gua.name, '乾为天');
  runner.assertEq(pan.gua.dongYaoList.length, 0);
  runner.assertEq(pan.bianYaoList, null, '静卦不应伪造变卦六亲');
  runner.assertEq(pan.gua.bianName, null, '静卦不应显示变卦');
});

runner.module('本卦、变卦、互卦、错卦、综卦');
runner.test('天泽履六爻线序为自下而上 [阳阳阴 阳阳阳]', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:6, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.lines.join(','), '1,1,0,1,1,1');
});
runner.test('乾为天初爻动变天风姤，不是天泽履', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.bianName, '天风姤');
});
runner.test('水雷屯互卦山地剥', function() {
  var pan = liuyao.panGua('number', { num1:6, num2:4, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.huGua, '山地剥');
});
runner.test('天泽履互卦风火家人', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.huGua, '风火家人');
});
runner.test('水火既济的错卦、综卦均为火水未济', function() {
  var pan = liuyao.panGua('number', { num1:6, num2:3, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.cuoGua, '火水未济');
  runner.assertEq(pan.gua.zongGua, '火水未济');
});
runner.test('64卦本卦名称唯一且元数据完整', function() {
  var names = {};
  for (var u=1; u<=8; u++) for (var l=1; l<=8; l++) {
    var pan = liuyao.panGua('number', { num1:u, num2:l, num3:1, dt:new Date(2026,5,28,14,30) });
    names[pan.gua.name] = true;
    runner.assert(EXPECTED_META[pan.gua.name], pan.gua.name + ' 应属于八宫');
    runner.assert(pan.huGua && pan.gua.cuoGua && pan.gua.zongGua, pan.gua.name + ' 互错综卦完整');
  }
  runner.assertEq(Object.keys(names).length, 64);
});

runner.test('全64卦、384种单爻变化及互错综变换满足线序不变量', function() {
  var baseByName = {};
  for (var u=1; u<=8; u++) for (var l=1; l<=8; l++) {
    var base = liuyao.panGua('number', { num1:u, num2:l, num3:1, dt:new Date(2026,5,28,14,30) });
    baseByName[base.gua.name] = base.gua.lines.slice();
  }
  Object.keys(baseByName).forEach(function(name) {
    var pair = null;
    for (var u=1; u<=8 && !pair; u++) for (var l=1; l<=8; l++) {
      var probe = liuyao.panGua('number', { num1:u, num2:l, num3:1, dt:new Date(2026,5,28,14,30) });
      if (probe.gua.name === name) { pair = [u,l]; break; }
    }
    var lines = baseByName[name];
    for (var d=1; d<=6; d++) {
      var pan = liuyao.panGua('number', { num1:pair[0], num2:pair[1], num3:d, dt:new Date(2026,5,28,14,30) });
      var expectedBian = lines.map(function(v, i) { return i === d - 1 ? 1 - v : v; });
      runner.assertEq(baseByName[pan.gua.bianName].join(''), expectedBian.join(''), name + ' 第' + d + '爻变');
    }
    var sample = liuyao.panGua('number', { num1:pair[0], num2:pair[1], num3:1, dt:new Date(2026,5,28,14,30) });
    var expectedHu = lines.slice(1,4).concat(lines.slice(2,5));
    runner.assertEq(baseByName[sample.huGua].join(''), expectedHu.join(''), name + ' 互卦');
    runner.assertEq(baseByName[sample.gua.cuoGua].join(''), lines.map(function(v){return 1-v;}).join(''), name + ' 错卦');
    runner.assertEq(baseByName[sample.gua.zongGua].join(''), lines.slice().reverse().join(''), name + ' 综卦');
  });
});

runner.module('京房纳甲、八宫六亲与世应');
runner.test('乾为天：内甲子寅辰、外壬午申戌', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.yaoList.map(function(y){return y.gan+y.zhi;}).join('|'), CLASSIC_NAJIA['乾'].join('|'));
});
runner.test('坤为地：内乙未巳卯、外癸丑亥酉', function() {
  var pan = liuyao.panGua('number', { num1:8, num2:8, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.yaoList.map(function(y){return y.gan+y.zhi;}).join('|'), CLASSIC_NAJIA['坤'].join('|'));
});
runner.test('天地否与水雷屯的上下卦纳甲正确', function() {
  var pi = liuyao.panGua('number', { num1:1, num2:8, num3:1, dt:new Date(2026,5,28,14,30) });
  var tun = liuyao.panGua('number', { num1:6, num2:4, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pi.yaoList.map(function(y){return y.gan+y.zhi;}).join('|'), '乙未|乙巳|乙卯|壬午|壬申|壬戌');
  runner.assertEq(tun.yaoList.map(function(y){return y.gan+y.zhi;}).join('|'), '庚子|庚寅|庚辰|戊申|戊戌|戊子');
});
runner.test('天泽履属艮宫土，六亲按卦宫而非下卦兑金计算', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.palace, '艮');
  runner.assertEq(pan.gua.palaceWuxing, '土');
  runner.assertEq(pan.yaoList.map(function(y){return y.liuqin;}).join('|'), '父母|官鬼|兄弟|父母|子孙|兄弟');
});
runner.test('天泽履世在五爻、应在二爻并写入爻对象', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.shiYao, 5); runner.assertEq(pan.gua.yingYao, 2);
  runner.assertEq(pan.yaoList.filter(function(y){return y.isShi;})[0].yao, 5);
  runner.assertEq(pan.yaoList.filter(function(y){return y.isYing;})[0].yao, 2);
});
runner.test('64卦卦宫和世应全部符合八宫序', function() {
  for (var u=1; u<=8; u++) for (var l=1; l<=8; l++) {
    var pan = liuyao.panGua('number', { num1:u, num2:l, num3:1, dt:new Date(2026,5,28,14,30) });
    var exp = EXPECTED_META[pan.gua.name];
    runner.assertEq(pan.gua.palace, exp.palace, pan.gua.name + ' 卦宫');
    runner.assertEq(pan.gua.palaceWuxing, exp.wuxing, pan.gua.name + ' 宫五行');
    runner.assertEq(pan.gua.shiYao, exp.shi, pan.gua.name + ' 世爻');
    runner.assertEq(pan.gua.yingYao, exp.ying, pan.gua.name + ' 应爻');
  }
});
runner.test('64卦共384爻纳甲、六亲均符合内外卦与卦宫规则', function() {
  var allRelations = ['父母','兄弟','子孙','妻财','官鬼'];
  for (var u=1; u<=8; u++) for (var l=1; l<=8; l++) {
    var pan = liuyao.panGua('number', { num1:u, num2:l, num3:1, dt:new Date(2026,5,28,14,30) });
    var expNaJia = CLASSIC_NAJIA[TRIGRAM_NAMES[l]].slice(0,3).concat(CLASSIC_NAJIA[TRIGRAM_NAMES[u]].slice(3,6));
    runner.assertEq(pan.yaoList.map(function(y){return y.gan+y.zhi;}).join('|'), expNaJia.join('|'), pan.gua.name + ' 纳甲');
    pan.yaoList.forEach(function(y) {
      var expLiuQin = RELATION_BY_PALACE[pan.gua.palaceWuxing][y.wuxing];
      runner.assertEq(y.liuqin, expLiuQin, pan.gua.name + ' 第' + y.yao + '爻六亲');
    });
    var visibleAndHidden = {};
    pan.yaoList.forEach(function(y) { visibleAndHidden[y.liuqin] = true; if (y.fuShen) visibleAndHidden[y.fuShen.liuqin] = true; });
    allRelations.forEach(function(relation) { runner.assert(visibleAndHidden[relation], pan.gua.name + ' 应通过飞伏神齐备' + relation); });
  }
});
runner.test('变爻六亲仍按本卦卦宫：乾二爻动化同人，丑土仍为父母', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:2, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.gua.bianName, '天火同人');
  runner.assertEq(pan.bianYaoList[1].zhi, '丑');
  runner.assertEq(pan.bianYaoList[1].liuqin, '父母');
});
runner.test('缺失六亲按本宫纯卦安伏神：履卦妻财子水伏于五爻', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assert(pan.yaoList[4].fuShen, '五爻应有伏神');
  runner.assertEq(pan.yaoList[4].fuShen.liuqin, '妻财');
  runner.assertEq(pan.yaoList[4].fuShen.gan + pan.yaoList[4].fuShen.zhi, '丙子');
});

runner.module('日辰、旬空、六神与输出');
runner.test('2026-06-28 14:30 四柱为丙午 甲午 癸酉 己未', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.timeGanzhi.year, '丙午');
  runner.assertEq(pan.timeGanzhi.month, '甲午');
  runner.assertEq(pan.timeGanzhi.day, '癸酉');
  runner.assertEq(pan.timeGanzhi.hour, '己未');
});
runner.test('癸酉日属甲子旬，空戌亥；乾卦上爻戌标空', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.xunKong.join(''), '戌亥');
  runner.assertEq(pan.yaoList[5].zhi, '戌');
  runner.assertEq(pan.yaoList[5].isXunKong, true);
});
runner.test('癸日起玄武，六神自初至上顺排', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:1, num3:1, dt:new Date(2026,5,28,14,30) });
  runner.assertEq(pan.yaoList.map(function(y){return y.liushen;}).join('|'), '玄武|青龙|朱雀|勾陈|螣蛇|白虎');
});
runner.test('提示词包含变卦、卦宫、世应、旬空和伏神', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  var prompt = liuyao.formatLiuyaoPrompt(pan, '测试问题');
  ['变卦：','卦宫：艮宫（土）','世爻：第5爻','应爻：第2爻','旬空：','伏神'].forEach(function(text) {
    runner.assert(prompt.indexOf(text) >= 0, '提示词应包含 ' + text);
  });
});

runner.module('六爻页面联动');
runner.test('排盘结果展示本变互错综、卦宫世应旬空和伏神', function() {
  var resultEl = { innerHTML: '' };
  var oldDocument = globalThis.document;
  globalThis.document = { getElementById: function(id) { return id === 'lyResult' ? resultEl : null; } };
  try {
    var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
    renderLiuyao(pan);
    ['本卦：','天泽履','卦宫：','艮宫（土）','世5 · 应2','变卦：','天水讼','互卦：风火家人','错卦：地山谦','综卦：风天小畜','伏神：丙子(水) 妻财'].forEach(function(text) {
      runner.assert(resultEl.innerHTML.indexOf(text) >= 0, '页面应包含：' + text);
    });
  } finally {
    globalThis.document = oldDocument;
  }
});
runner.test('寻物用神不现时可从伏神定位，螣蛇环境映射有效', function() {
  var pan = liuyao.panGua('number', { num1:1, num2:2, num3:1, dt:new Date(2026,5,28,14,30) });
  var analysis = analyzeXunWu(pan, '钱包');
  runner.assert(!analysis.error, '伏神妻财应可作为寻物用神');
  runner.assertEq(analysis.yongShen.isFuShen, true);
  runner.assertEq(analysis.yongShen.position, 5);
  runner.assertEq(analysis.yongShen.liushen, '螣蛇');
  runner.assert(analysis.environment.desc.indexOf('缠绕') >= 0, '螣蛇环境应可识别');
  runner.assertEq(analysis.probability.level, 'low');
});

runner.module('大衍筮法(揲蓍)');
runner.test('三变归奇集合合法: 一变 5/9, 二三变 4/8, 归奇+余策=49', function() {
  var g1 = {}, g23 = {};
  for (var i = 0; i < 100; i++) {
    var q = liuyao.qiGuaByYarrow();
    runner.assertEq(q.stalkResults.length, 6);
    q.stalkResults.forEach(function(r) {
      g1[r.changes[0]] = true;
      g23[r.changes[1]] = true;
      g23[r.changes[2]] = true;
      runner.assert([6,7,8,9].indexOf(r.value) >= 0, '爻值应在 6-9: ' + r.value);
      runner.assertEq(r.changes[0] + r.changes[1] + r.changes[2] + r.value * 4, 49);
      if (r.isDong) runner.assert(r.value === 6 || r.value === 9, '仅老阴老阳为动');
    });
  }
  runner.assertEq(Object.keys(g1).sort().join(','), '5,9');
  runner.assertEq(Object.keys(g23).sort().join(','), '4,8');
});
runner.test('panGua(yarrow) 结构完整且动爻与六九一致', function() {
  for (var i = 0; i < 20; i++) {
    var pan = liuyao.panGua('yarrow', { dt: new Date(2026,5,28,14,30) });
    runner.assert(pan.gua && pan.gua.name.length >= 3, '应有卦名');
    runner.assertEq(pan.yaoList.length, 6);
    runner.assertEq(pan.stalkResults.length, 6);
    runner.assertEq(pan.method, '大衍筮法');
    pan.gua.dongYaoList.forEach(function(y) {
      var v = pan.stalkResults[y - 1].value;
      runner.assert(v === 6 || v === 9, '动爻应对应老阴/老阳, 实际: ' + v);
    });
  }
});

runner.run();
