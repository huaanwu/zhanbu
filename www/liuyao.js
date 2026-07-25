// ========== 六爻纳甲排盘系统 v1.2 ==========
// 基础干支函数由 lib/ganzhi.js 提供；本文件负责起卦、卦象变换、京房纳甲、八宫六亲/世应和伏神。
// 所有六爻线数组统一使用“自下而上”：index 0=初爻，index 5=上爻。

var GUA_NAME = {
  1: ['乾', '☰', [1,1,1]],
  2: ['兑', '☱', [0,1,1]],
  3: ['离', '☲', [1,0,1]],
  4: ['震', '☳', [0,0,1]],
  5: ['巽', '☴', [1,1,0]],
  6: ['坎', '☵', [0,1,0]],
  7: ['艮', '☶', [1,0,0]],
  8: ['坤', '☷', [0,0,0]]
};

var LIUSHISIGUA = {
  '1,1':'乾为天','1,2':'天泽履','1,3':'天火同人','1,4':'天雷无妄','1,5':'天风姤','1,6':'天水讼','1,7':'天山遁','1,8':'天地否',
  '2,1':'泽天夬','2,2':'兑为泽','2,3':'泽火革','2,4':'泽雷随','2,5':'泽风大过','2,6':'泽水困','2,7':'泽山咸','2,8':'泽地萃',
  '3,1':'火天大有','3,2':'火泽睽','3,3':'离为火','3,4':'火雷噬嗑','3,5':'火风鼎','3,6':'火水未济','3,7':'火山旅','3,8':'火地晋',
  '4,1':'雷天大壮','4,2':'雷泽归妹','4,3':'雷火丰','4,4':'震为雷','4,5':'雷风恒','4,6':'雷水解','4,7':'雷山小过','4,8':'雷地豫',
  '5,1':'风天小畜','5,2':'风泽中孚','5,3':'风火家人','5,4':'风雷益','5,5':'巽为风','5,6':'风水涣','5,7':'风山渐','5,8':'风地观',
  '6,1':'水天需','6,2':'水泽节','6,3':'水火既济','6,4':'水雷屯','6,5':'水风井','6,6':'坎为水','6,7':'水山蹇','6,8':'水地比',
  '7,1':'山天大畜','7,2':'山泽损','7,3':'山火贲','7,4':'山雷颐','7,5':'山风蛊','7,6':'山水蒙','7,7':'艮为山','7,8':'山地剥',
  '8,1':'地天泰','8,2':'地泽临','8,3':'地火明夷','8,4':'地雷复','8,5':'地风升','8,6':'地水师','8,7':'地山谦','8,8':'坤为地'
};

// 京房纳甲：数组顺序固定为初爻→上爻。乾内甲外壬，坤内乙外癸。
var NA_JIA = {
  '乾': [['甲','子','水'],['甲','寅','木'],['甲','辰','土'],['壬','午','火'],['壬','申','金'],['壬','戌','土']],
  '兑': [['丁','巳','火'],['丁','卯','木'],['丁','丑','土'],['丁','亥','水'],['丁','酉','金'],['丁','未','土']],
  '离': [['己','卯','木'],['己','丑','土'],['己','亥','水'],['己','酉','金'],['己','未','土'],['己','巳','火']],
  '震': [['庚','子','水'],['庚','寅','木'],['庚','辰','土'],['庚','午','火'],['庚','申','金'],['庚','戌','土']],
  '巽': [['辛','丑','土'],['辛','亥','水'],['辛','酉','金'],['辛','未','土'],['辛','巳','火'],['辛','卯','木']],
  '坎': [['戊','寅','木'],['戊','辰','土'],['戊','午','火'],['戊','申','金'],['戊','戌','土'],['戊','子','水']],
  '艮': [['丙','辰','土'],['丙','午','火'],['丙','申','金'],['丙','戌','土'],['丙','子','水'],['丙','寅','木']],
  '坤': [['乙','未','土'],['乙','巳','火'],['乙','卯','木'],['癸','丑','土'],['癸','亥','水'],['癸','酉','金']]
};

var LIU_QIN = {
  '金,金':'兄弟','金,木':'妻财','金,水':'子孙','金,火':'官鬼','金,土':'父母',
  '木,木':'兄弟','木,火':'子孙','木,土':'妻财','木,金':'官鬼','木,水':'父母',
  '水,水':'兄弟','水,木':'子孙','水,火':'妻财','水,土':'官鬼','水,金':'父母',
  '火,火':'兄弟','火,土':'子孙','火,金':'妻财','火,水':'官鬼','火,木':'父母',
  '土,土':'兄弟','土,金':'子孙','土,水':'妻财','土,木':'官鬼','土,火':'父母'
};

var LIU_SHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
var LIU_SHEN_START = { '甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5 };
var YAO_NAMES = ['初爻','二爻','三爻','四爻','五爻','上爻'];
var PALACE_WUXING = { '乾':'金','兑':'金','离':'火','震':'木','巽':'木','坎':'水','艮':'土','坤':'土' };

// 八宫顺序：本宫、一世、二世、三世、四世、五世、游魂、归魂。
var GUA_PALACE_GROUPS = {
  '乾': ['乾为天','天风姤','天山遁','天地否','风地观','山地剥','火地晋','火天大有'],
  '坎': ['坎为水','水泽节','水雷屯','水火既济','泽火革','雷火丰','地火明夷','地水师'],
  '艮': ['艮为山','山火贲','山天大畜','山泽损','火泽睽','天泽履','风泽中孚','风山渐'],
  '震': ['震为雷','雷地豫','雷水解','雷风恒','地风升','水风井','泽风大过','泽雷随'],
  '巽': ['巽为风','风天小畜','风火家人','风雷益','天雷无妄','火雷噬嗑','山雷颐','山风蛊'],
  '离': ['离为火','火山旅','火风鼎','火水未济','山水蒙','风水涣','天水讼','天火同人'],
  '坤': ['坤为地','地雷复','地泽临','地天泰','雷天大壮','泽天夬','水天需','水地比'],
  '兑': ['兑为泽','泽水困','泽地萃','泽山咸','水山蹇','地山谦','雷山小过','雷泽归妹']
};
var GUA_PALACE = {};
(function buildGuaPalaceTable() {
  var shiByOrder = [6,1,2,3,4,5,4,3];
  var yingByOrder = [3,4,5,6,1,2,1,6];
  var typeByOrder = ['本宫','一世','二世','三世','四世','五世','游魂','归魂'];
  Object.keys(GUA_PALACE_GROUPS).forEach(function(palace) {
    GUA_PALACE_GROUPS[palace].forEach(function(name, idx) {
      GUA_PALACE[name] = {
        palace: palace,
        wuxing: PALACE_WUXING[palace],
        order: idx,
        type: typeByOrder[idx],
        shi: shiByOrder[idx],
        ying: yingByOrder[idx]
      };
    });
  });
})();

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(function(v, i) { return v === b[i]; });
}

function requireValidDate(dt) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) throw new Error('起卦日期无效');
  return dt;
}

function integerValue(value, label) {
  var n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(label + '必须是有限整数');
  return n;
}

function moduloOneBased(value, modulo, label) {
  var n = integerValue(value, label);
  var result = ((n % modulo) + modulo) % modulo;
  return result === 0 ? modulo : result;
}

function getSolarEngine(dt) {
  var Solar = (typeof window !== 'undefined' && window.Solar) || (typeof globalThis !== 'undefined' && globalThis.Solar);
  // Node 测试环境下由 ganzhi.js 的高精度加载器把本地 lunar.bundle.js 挂到 globalThis。
  if (!Solar && typeof window !== 'undefined' && typeof window.getYearGZEx === 'function') {
    window.getYearGZEx(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    Solar = window.Solar || (typeof globalThis !== 'undefined' && globalThis.Solar);
  }
  if (!Solar || typeof Solar.fromDate !== 'function') {
    throw new Error('农历引擎未加载，无法保证时间起卦和干支准确');
  }
  return Solar;
}

function getLunarContext(dt) {
  requireValidDate(dt);
  var lunar = getSolarEngine(dt).fromDate(dt).getLunar();
  var eightChar = typeof lunar.getEightChar === 'function' ? lunar.getEightChar() : null;
  if (!eightChar) throw new Error('农历引擎缺少八字接口，无法排盘');
  return {
    lunar: {
      yearZhi: lunar.getYearZhi(),
      yearZhiNumber: lunar.getYearZhiIndex() + 1,
      month: Math.abs(lunar.getMonth()),
      isLeapMonth: lunar.getMonth() < 0,
      day: lunar.getDay(),
      hourZhi: lunar.getTimeZhi(),
      hourZhiNumber: lunar.getTimeZhiIndex() + 1
    },
    timeGanzhi: {
      year: eightChar.getYear(),
      month: eightChar.getMonth(),
      day: eightChar.getDay(),
      hour: eightChar.getTime()
    }
  };
}

// 经典梅花年月日时法：年支数+农历月+农历日定上卦，再加时支数定下卦和动爻。
function qiGuaByTime(dt, lunarContext) {
  dt = requireValidDate(dt || new Date());
  var context = lunarContext || getLunarContext(dt);
  var lunar = context.lunar;
  var base = lunar.yearZhiNumber + lunar.month + lunar.day;
  var total = base + lunar.hourZhiNumber;
  return {
    method: '时间起卦',
    upper: moduloOneBased(base, 8, '时间上卦数'),
    lower: moduloOneBased(total, 8, '时间下卦数'),
    dong: moduloOneBased(total, 6, '时间动爻数'),
    dt: dt,
    lunar: lunar
  };
}

function qiGuaByNumber(num1, num2, num3) {
  var n1 = integerValue(num1, '上卦数');
  var n2 = integerValue(num2, '下卦数');
  var hasThird = num3 !== null && num3 !== undefined && num3 !== '';
  var dongSource = hasThird ? integerValue(num3, '动爻数') : n1 + n2;
  return {
    method: '数字起卦',
    upper: moduloOneBased(n1, 8, '上卦数'),
    lower: moduloOneBased(n2, 8, '下卦数'),
    dong: moduloOneBased(dongSource, 6, '动爻数'),
    numbers: { upper: n1, lower: n2, moving: hasThird ? dongSource : null }
  };
}

function randomOneBased(max) {
  return Math.min(max, Math.floor(Math.random() * max) + 1);
}

function qiGuaByRandom() {
  return {
    method: '随机起卦',
    upper: randomOneBased(8),
    lower: randomOneBased(8),
    dong: randomOneBased(6)
  };
}

function getGuaNumFromTopLines(lines) {
  for (var n = 1; n <= 8; n++) {
    if (arraysEqual(GUA_NAME[n][2], lines)) return n;
  }
  throw new Error('无效的三爻卦象：' + JSON.stringify(lines));
}

function getGuaNumFromBottomLines(lines) {
  if (!Array.isArray(lines) || lines.length !== 3) throw new Error('三爻卦象必须恰好包含3爻');
  return getGuaNumFromTopLines(lines.slice().reverse());
}

function getGuaNameFromBottomLines(lines) {
  if (!Array.isArray(lines) || lines.length !== 6) throw new Error('六爻卦象必须恰好包含6爻');
  var lower = getGuaNumFromBottomLines(lines.slice(0, 3));
  var upper = getGuaNumFromBottomLines(lines.slice(3, 6));
  return LIUSHISIGUA[upper + ',' + lower];
}

// 三枚铜钱：字=2、背=3，和为6/7/8/9分别是老阴/少阳/少阴/老阳。
function tossCoin() {
  var c1 = Math.random() < 0.5 ? 0 : 1; // 0=字，1=背
  var c2 = Math.random() < 0.5 ? 0 : 1;
  var c3 = Math.random() < 0.5 ? 0 : 1;
  var backs = c1 + c2 + c3;
  if (backs === 0) return { yao:0, isDong:true,  label:'老阴', desc:'三枚字（阴动）', value:6 };
  if (backs === 1) return { yao:1, isDong:false, label:'少阳', desc:'两枚字一枚背', value:7 };
  if (backs === 2) return { yao:0, isDong:false, label:'少阴', desc:'一枚字两枚背', value:8 };
  return { yao:1, isDong:true, label:'老阳', desc:'三枚背（阳动）', value:9 };
}

function qiGuaByCoin() {
  var coinResults = [];
  var linesFromBottom = [];
  var dongYaoList = [];
  for (var i = 0; i < 6; i++) {
    var result = tossCoin();
    coinResults.push(result);
    linesFromBottom.push(result.yao);
    if (result.isDong) dongYaoList.push(i + 1);
  }
  return {
    method: '铜钱摇卦',
    upper: getGuaNumFromBottomLines(linesFromBottom.slice(3, 6)),
    lower: getGuaNumFromBottomLines(linesFromBottom.slice(0, 3)),
    dongYaoList: dongYaoList,
    coinResults: coinResults,
    lines: linesFromBottom
  };
}

// === 大衍筮法(揲蓍): 《系辞传》"大衍之数五十,其用四十有九" ===
// 一变: 49策分二、挂一、揲四、归奇,归奇非 5 即 9;二/三变归奇非 4 即 8。
// 三变余策 24/28/32/36,除四得 6/7/8/9 = 老阴/少阳/少阴/老阳。六爻共十八变。
function yarrowOneChange(stalks) {
  // 分二: 随机分为左右两堆(至少各 1)
  var left = 1 + Math.floor(Math.random() * (stalks - 1));
  var right = stalks - left;
  // 挂一: 从右堆取一
  right -= 1;
  // 揲四归奇: 整除归 4
  var lRem = left % 4 || 4;
  var rRem = right % 4 || 4;
  var guiki = 1 + lRem + rRem;
  return { remain: stalks - guiki, guiki: guiki };
}

function qiGuaByYarrow() {
  var YAO_VALUE = {
    6: { yao: 0, isDong: true,  label: '老阴', desc: '交(阴动)' },
    7: { yao: 1, isDong: false, label: '少阳', desc: '单' },
    8: { yao: 0, isDong: false, label: '少阴', desc: '拆' },
    9: { yao: 1, isDong: true,  label: '老阳', desc: '重(阳动)' }
  };
  var linesFromBottom = [];
  var dongYaoList = [];
  var stalkResults = [];
  for (var y = 0; y < 6; y++) {
    var stalks = 49;
    var changes = [];
    for (var c = 0; c < 3; c++) {
      var r = yarrowOneChange(stalks);
      changes.push(r.guiki);
      stalks = r.remain;
    }
    var value = stalks / 4;
    var info = YAO_VALUE[value];
    linesFromBottom.push(info.yao);
    if (info.isDong) dongYaoList.push(y + 1);
    stalkResults.push({
      value: value,
      changes: changes,
      yao: info.yao,
      isDong: info.isDong,
      label: info.label,
      desc: '归奇' + changes.join('/') + '→余策' + stalks
    });
  }
  return {
    method: '大衍筮法',
    upper: getGuaNumFromBottomLines(linesFromBottom.slice(3, 6)),
    lower: getGuaNumFromBottomLines(linesFromBottom.slice(0, 3)),
    dongYaoList: dongYaoList,
    stalkResults: stalkResults,
    lines: linesFromBottom
  };
}

function normalizeDongYaoList(dongYaoList) {
  if (!Array.isArray(dongYaoList)) return [];
  var seen = {};
  var result = [];
  dongYaoList.forEach(function(value) {
    var yao = integerValue(value, '动爻位置');
    if (yao < 1 || yao > 6) throw new Error('动爻位置必须在1到6之间');
    if (!seen[yao]) { seen[yao] = true; result.push(yao); }
  });
  return result.sort(function(a, b) { return a - b; });
}

function getGuaImage(upper, lower, dongYaoList) {
  var upperInfo = GUA_NAME[upper];
  var lowerInfo = GUA_NAME[lower];
  if (!upperInfo || !lowerInfo) throw new Error('上下卦编号必须在1到8之间');

  var moving = normalizeDongYaoList(dongYaoList);
  var benGua = lowerInfo[2].slice().reverse().concat(upperInfo[2].slice().reverse());
  var bianGua = benGua.map(function(value, idx) { return moving.indexOf(idx + 1) >= 0 ? 1 - value : value; });
  var huLower = benGua.slice(1, 4); // 二三四爻
  var huUpper = benGua.slice(2, 5); // 三四五爻
  var huLines = huLower.concat(huUpper);
  var cuoLines = benGua.map(function(value) { return 1 - value; });
  var zongLines = benGua.slice().reverse();

  var bianLowerNum = getGuaNumFromBottomLines(bianGua.slice(0, 3));
  var bianUpperNum = getGuaNumFromBottomLines(bianGua.slice(3, 6));
  var huLowerNum = getGuaNumFromBottomLines(huLower);
  var huUpperNum = getGuaNumFromBottomLines(huUpper);

  return {
    name: LIUSHISIGUA[upper + ',' + lower],
    upperGua: upperInfo[0],
    lowerGua: lowerInfo[0],
    upperSymbol: upperInfo[1],
    lowerSymbol: lowerInfo[1],
    benGuaLines: benGua,
    bianGuaLines: bianGua,
    dongYaoList: moving,
    dongYaoName: moving.map(function(yao) { return YAO_NAMES[yao - 1]; }).join('、'),
    huGuaName: LIUSHISIGUA[huUpperNum + ',' + huLowerNum],
    huGuaLines: huLines,
    cuoGuaName: getGuaNameFromBottomLines(cuoLines),
    cuoGuaLines: cuoLines,
    zongGuaName: getGuaNameFromBottomLines(zongLines),
    zongGuaLines: zongLines,
    bianGuaName: LIUSHISIGUA[bianUpperNum + ',' + bianLowerNum],
    bianUpperGua: GUA_NAME[bianUpperNum][0],
    bianLowerGua: GUA_NAME[bianLowerNum][0]
  };
}

function getGuaMeta(guaName) {
  var meta = GUA_PALACE[guaName];
  if (!meta) throw new Error('未找到八宫归属：' + guaName);
  return meta;
}

function buildLinesForTrigrams(upperGuaName, lowerGuaName) {
  var upperNum = null;
  var lowerNum = null;
  for (var n = 1; n <= 8; n++) {
    if (GUA_NAME[n][0] === upperGuaName) upperNum = n;
    if (GUA_NAME[n][0] === lowerGuaName) lowerNum = n;
  }
  if (!upperNum || !lowerNum) throw new Error('未知八卦名称');
  return GUA_NAME[lowerNum][2].slice().reverse().concat(GUA_NAME[upperNum][2].slice().reverse());
}

function naJia(upperGuaName, lowerGuaName, dongYaoList, dayGan, palaceMeta, lines, xunKong, options) {
  var upperNJ = NA_JIA[upperGuaName];
  var lowerNJ = NA_JIA[lowerGuaName];
  if (!upperNJ || !lowerNJ) throw new Error('纳甲失败：未知上下卦');
  if (!(dayGan in LIU_SHEN_START)) throw new Error('纳六神失败：未知日干 ' + dayGan);

  // 内卦使用该八卦纳甲表的前三爻，外卦使用后三爻。
  var sixYao = lowerNJ.slice(0, 3).concat(upperNJ.slice(3, 6));
  var guaLines = lines || buildLinesForTrigrams(upperGuaName, lowerGuaName);
  var moving = normalizeDongYaoList(dongYaoList);
  var emptyBranches = Array.isArray(xunKong) ? xunKong : [];
  var markShiYing = !options || options.markShiYing !== false;
  var result = [];

  for (var i = 0; i < 6; i++) {
    var item = sixYao[i];
    var gan = item[0], zhi = item[1], zhiWX = item[2];
    var liuQin = LIU_QIN[palaceMeta.wuxing + ',' + zhiWX] || '未知';
    var liuShenIdx = (LIU_SHEN_START[dayGan] + i) % 6;
    result.push({
      yao: i + 1,
      name: YAO_NAMES[i],
      yinYang: guaLines[i] === 1 ? '阳' : '阴',
      gan: gan,
      zhi: zhi,
      wuxing: zhiWX,
      liuqin: liuQin,
      liushen: LIU_SHEN[liuShenIdx],
      isDong: moving.indexOf(i + 1) >= 0,
      isShi: markShiYing && palaceMeta.shi === i + 1,
      isYing: markShiYing && palaceMeta.ying === i + 1,
      isXunKong: emptyBranches.indexOf(zhi) >= 0,
      fuShen: null
    });
  }
  return result;
}

function attachFuShen(yaoList, palaceMeta, dayGan, xunKong) {
  var present = {};
  yaoList.forEach(function(yao) { present[yao.liuqin] = true; });
  var pureLines = buildLinesForTrigrams(palaceMeta.palace, palaceMeta.palace);
  var pureYao = naJia(palaceMeta.palace, palaceMeta.palace, [], dayGan, palaceMeta, pureLines, xunKong, { markShiYing:false });
  var fuShenList = [];

  for (var i = 0; i < 6; i++) {
    if (present[pureYao[i].liuqin]) continue;
    var fu = Object.assign({}, pureYao[i], {
      liushen: yaoList[i].liushen,
      isDong: false,
      isShi: false,
      isYing: false,
      isFuShen: true,
      flyYao: i + 1,
      fuShen: null
    });
    yaoList[i].fuShen = fu;
    fuShenList.push(fu);
  }
  return fuShenList;
}

function panGua(method, params) {
  params = params || {};
  var dt = params.dt === undefined ? new Date() : params.dt;
  requireValidDate(dt);
  var lunarContext = getLunarContext(dt);
  var qigua;

  if (method === 'time') {
    qigua = qiGuaByTime(dt, lunarContext);
    qigua.dongYaoList = [qigua.dong];
  } else if (method === 'number') {
    var num1 = params.num1 === undefined || params.num1 === '' ? 1 : params.num1;
    var num2 = params.num2 === undefined || params.num2 === '' ? 1 : params.num2;
    qigua = qiGuaByNumber(num1, num2, params.num3);
    qigua.dongYaoList = [qigua.dong];
  } else if (method === 'coin') {
    qigua = qiGuaByCoin();
  } else if (method === 'yarrow') {
    qigua = qiGuaByYarrow();
  } else if (method === 'random') {
    qigua = qiGuaByRandom();
    qigua.dongYaoList = [qigua.dong];
  } else {
    throw new Error('不支持的起卦方式：' + method);
  }

  var guaInfo = getGuaImage(qigua.upper, qigua.lower, qigua.dongYaoList);
  var palaceMeta = getGuaMeta(guaInfo.name);
  var dayGZ = lunarContext.timeGanzhi.day;
  var emptyText = typeof window.getXunKong === 'function' ? window.getXunKong(dayGZ) : '';
  var xunKong = emptyText ? emptyText.split('') : [];
  var yaoList = naJia(
    guaInfo.upperGua,
    guaInfo.lowerGua,
    guaInfo.dongYaoList,
    dayGZ[0],
    palaceMeta,
    guaInfo.benGuaLines,
    xunKong
  );
  var fuShenList = attachFuShen(yaoList, palaceMeta, dayGZ[0], xunKong);

  var bianYaoList = null;
  var bianMeta = null;
  if (guaInfo.dongYaoList.length > 0) {
    bianMeta = getGuaMeta(guaInfo.bianGuaName);
    // 变爻六亲仍以本卦卦宫五行为“我”，不能改用变卦宫五行。
    bianYaoList = naJia(
      guaInfo.bianUpperGua,
      guaInfo.bianLowerGua,
      [],
      dayGZ[0],
      palaceMeta,
      guaInfo.bianGuaLines,
      xunKong,
      { markShiYing:false }
    );
  }

  return {
    method: qigua.method,
    datetime: dt.getFullYear() + '年' + (dt.getMonth()+1) + '月' + dt.getDate() + '日 ' + dt.getHours() + ':' + String(dt.getMinutes()).padStart(2, '0'),
    lunarDate: qigua.lunar || lunarContext.lunar,
    timeGanzhi: lunarContext.timeGanzhi,
    xunKong: xunKong,
    gua: {
      name: guaInfo.name,
      upper: guaInfo.upperGua + guaInfo.upperSymbol,
      lower: guaInfo.lowerGua + guaInfo.lowerSymbol,
      palace: palaceMeta.palace,
      palaceWuxing: palaceMeta.wuxing,
      palaceType: palaceMeta.type,
      shiYao: palaceMeta.shi,
      yingYao: palaceMeta.ying,
      dongYao: guaInfo.dongYaoList.length > 0 ? guaInfo.dongYaoList[0] : 0,
      dongYaoList: guaInfo.dongYaoList,
      dongYaoName: guaInfo.dongYaoName,
      lines: guaInfo.benGuaLines,
      bianName: guaInfo.dongYaoList.length > 0 ? guaInfo.bianGuaName : null,
      bianLines: guaInfo.dongYaoList.length > 0 ? guaInfo.bianGuaLines : null,
      bianUpperGua: guaInfo.dongYaoList.length > 0 ? guaInfo.bianUpperGua : null,
      bianLowerGua: guaInfo.dongYaoList.length > 0 ? guaInfo.bianLowerGua : null,
      bianPalace: bianMeta ? bianMeta.palace : null,
      huGua: guaInfo.huGuaName,
      cuoGua: guaInfo.cuoGuaName,
      zongGua: guaInfo.zongGuaName
    },
    yaoList: yaoList,
    bianYaoList: bianYaoList,
    fuShenList: fuShenList,
    huGua: guaInfo.huGuaName,
    coinResults: qigua.coinResults || null,
    stalkResults: qigua.stalkResults || null
  };
}

function formatLiuyaoPrompt(pan, question) {
  var text = '=== 六爻排盘 ===\n';
  text += '卦名：' + pan.gua.name + '\n';
  text += '卦宫：' + pan.gua.palace + '宫（' + pan.gua.palaceWuxing + '）·' + pan.gua.palaceType + '\n';
  text += '起卦方式：' + pan.method + '\n';
  text += '起卦时间：' + pan.datetime + '\n';
  text += '时间干支：年' + pan.timeGanzhi.year + ' 月' + pan.timeGanzhi.month + ' 日' + pan.timeGanzhi.day + ' 时' + pan.timeGanzhi.hour + '\n';
  text += '旬空：' + (pan.xunKong && pan.xunKong.length ? pan.xunKong.join('、') : '无') + '\n';
  text += '世爻：第' + pan.gua.shiYao + '爻；应爻：第' + pan.gua.yingYao + '爻\n';
  if (pan.gua.dongYaoList.length > 0) {
    text += '动爻：' + pan.gua.dongYaoList.map(function(yao) { return '第' + yao + '爻（' + YAO_NAMES[yao - 1] + '）'; }).join('、') + '\n';
    text += '变卦：' + pan.gua.bianName + '\n';
  } else {
    text += '动爻：无（静卦）\n';
  }
  text += '互卦：' + pan.huGua + '；错卦：' + pan.gua.cuoGua + '；综卦：' + pan.gua.zongGua + '\n';
  text += '\n六爻详情（自上而下显示）：\n';

  pan.yaoList.slice().reverse().forEach(function(yao) {
    var flags = [];
    if (yao.isShi) flags.push('世');
    if (yao.isYing) flags.push('应');
    if (yao.isDong) flags.push('动');
    if (yao.isXunKong) flags.push('空');
    text += yao.name + ' ' + yao.yinYang + ' ' + yao.gan + yao.zhi + '(' + yao.wuxing + ') ' + yao.liuqin + ' ' + yao.liushen;
    if (flags.length) text += '【' + flags.join('·') + '】';
    text += '\n';
    if (yao.fuShen) {
      text += '  伏神：' + yao.fuShen.gan + yao.fuShen.zhi + '(' + yao.fuShen.wuxing + ') ' + yao.fuShen.liuqin + '\n';
    }
  });

  if (pan.bianYaoList && pan.bianYaoList.length === 6) {
    text += '\n变卦六亲（仍按本卦' + pan.gua.palace + '宫定六亲）：\n';
    pan.bianYaoList.slice().reverse().forEach(function(yao) {
      text += yao.name + ' ' + yao.yinYang + ' ' + yao.gan + yao.zhi + '(' + yao.wuxing + ') ' + yao.liuqin + ' ' + yao.liushen + '\n';
    });
  }
  if (question) text += '\n所问之事：' + question + '\n';
  return text;
}

window.liuyao = {
  panGua: panGua,
  formatLiuyaoPrompt: formatLiuyaoPrompt,
  qiGuaByTime: qiGuaByTime,
  qiGuaByNumber: qiGuaByNumber,
  qiGuaByRandom: qiGuaByRandom,
  qiGuaByCoin: qiGuaByCoin,
  qiGuaByYarrow: qiGuaByYarrow,
  tossCoin: tossCoin,
  getGuaImage: getGuaImage,
  getGuaMeta: getGuaMeta
};
