// ========== 小六壬(掐指一算)起课系统 v1.0 ==========
// 六宫固定循环: 大安 → 留连 → 速喜 → 赤口 → 小吉 → 空亡
// 起课规则(通行古法): 正月起大安, 月上起日, 日上起时, 以时宫(落宫)为断。
//   月宫 = (农历月 - 1) % 6          (正月=大安)
//   日宫 = (月宫 + 农历日 - 1) % 6    (初一从月宫起)
//   时宫 = (日宫 + 时支序数 - 1) % 6  (子时从日宫起, 子=1 丑=2 ... 亥=12)
// 报数法同理: 三个数分别当"月/日/时"三次落宫。
// 原则与 liuyao.js 一致: 落宫是 100% 确定性算法, 由代码给出; 断语为固定口诀, AI 只做展开解读。

var XLR_GONG_NAMES = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];

// 六神/五行配宫(通行派): 青龙木/玄武水/朱雀火/白虎金/六合木/勾陈土。
// 注: 留连、小吉的五行各派有分歧(留连有作四方土、小吉有作水者), 此处取六神本气, 改时核对。
var XLR_GONG_META = {
  '大安': {
    wuxing: '木', liushen: '青龙', fangwei: '东方', jixiong: '大吉',
    koujue: '大安事事昌，求谋在东方。失物去不远，宅舍保安康。行人身未动，病者主无妨。将军回田野，仔细更推详。',
    duanyi: '主安稳、静止、平安。事可成但宜守不宜急，失物未出远门，行人尚未动身，病无大碍。'
  },
  '留连': {
    wuxing: '水', liushen: '玄武', fangwei: '北方', jixiong: '凶·迟滞',
    koujue: '留连事难成，求谋日未明。官事只宜缓，去者未回程。失物南方见，急讨方遂心。更需防口舌，人事且平平。',
    duanyi: '主迟滞、拖延、纠缠。事难速成，宜缓不宜急；行人未归，官事宜和缓，谨防口舌是非。'
  },
  '速喜': {
    wuxing: '火', liushen: '朱雀', fangwei: '南方', jixiong: '吉·快速',
    koujue: '速喜喜来临，求财向南行。失物申未午，逢人路上寻。官事有福德，病者无祸侵。田宅六畜吉，行人有信音。',
    duanyi: '主快速、喜庆、好消息。事将速成，喜信临门；求财顺利，行人有音信，病者无碍。'
  },
  '赤口': {
    wuxing: '金', liushen: '白虎', fangwei: '西方', jixiong: '凶·口舌',
    koujue: '赤口主口舌，官非切要防。失物急去寻，行人有惊慌。鸡犬多作怪，病者出西方。更须防咒诅，恐怕染瘟殃。',
    duanyi: '主口舌、是非、官非惊恐。谋事多阻，防争执诉讼与惊吓；失物宜速寻，病者需留意。'
  },
  '小吉': {
    wuxing: '木', liushen: '六合', fangwei: '西南方', jixiong: '吉·和合',
    koujue: '小吉最吉昌，路上好商量。阴人来报喜，失物在坤方。行人立便至，交易甚是强。凡事皆和合，病者祈上苍。',
    duanyi: '主和合、顺利、贵人相助。凡事吉昌，宜出行、交易、商议；行人即至，有人来报喜。'
  },
  '空亡': {
    wuxing: '土', liushen: '勾陈', fangwei: '中央', jixiong: '大凶·落空',
    koujue: '空亡事不祥，阴人多乖张。求财无利益，行人有灾殃。失物寻不见，音信不久长。病人逢暗鬼，禳解保安康。',
    duanyi: '主落空、无成、虚耗。事多不遂，求财无益，失物难寻，音信断绝；宜静守禳解，不宜妄动。'
  }
};

var XLR_ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function xlrInteger(value, label) {
  var n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(label + '必须是有限整数');
  return n;
}

// 一基取模: 任意正整数 → 1..modulo
function xlrModOne(value, modulo, label) {
  var n = xlrInteger(value, label);
  if (n < 1) throw new Error(label + '必须为正整数');
  var r = n % modulo;
  return r === 0 ? modulo : r;
}

function xlrGong(index) {
  var name = XLR_GONG_NAMES[((index % 6) + 6) % 6];
  var meta = XLR_GONG_META[name];
  return {
    index: XLR_GONG_NAMES.indexOf(name),
    name: name,
    wuxing: meta.wuxing,
    liushen: meta.liushen,
    fangwei: meta.fangwei,
    jixiong: meta.jixiong
  };
}

// 三次落宫: month/day/hourZhi 均为一基正整数, 返回三宫
function xlrCast(month, day, hourZhi) {
  var m = xlrInteger(month, '月数');
  var d = xlrInteger(day, '日数');
  var h = xlrModOne(hourZhi, 12, '时支序数');
  if (m < 1 || d < 1) throw new Error('月数/日数必须为正整数');
  var yueIdx = (m - 1) % 6;
  var riIdx = (yueIdx + d - 1) % 6;
  var shiIdx = (riIdx + h - 1) % 6;
  return { yue: xlrGong(yueIdx), ri: xlrGong(riIdx), shi: xlrGong(shiIdx) };
}

function xlrGetSolarEngine(dt) {
  var Solar = (typeof window !== 'undefined' && window.Solar) || (typeof globalThis !== 'undefined' && globalThis.Solar);
  // Node 测试环境下由 ganzhi.js 的加载器把本地 lunar.bundle.js 挂到 globalThis。
  if (!Solar && typeof window !== 'undefined' && typeof window.getYearGZEx === 'function') {
    window.getYearGZEx(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    Solar = window.Solar || (typeof globalThis !== 'undefined' && globalThis.Solar);
  }
  if (!Solar || typeof Solar.fromDate !== 'function') {
    throw new Error('农历引擎未加载，无法按当前时间起课');
  }
  return Solar;
}

/**
 * 起课入口
 * method: 'time'   params: { dt }                — 取 dt 的农历月日时
 *         'lunar'  params: { month, day, hourZhi } — 手动农历月(1-12)/日(1-30)/时支(1-12, 子=1)
 *         'number' params: { num1, num2, num3 }  — 报数法, 三数分别当月/日/时
 */
function paiKe(method, params) {
  params = params || {};
  var month, day, hourZhi, input, lunarInfo = null;
  if (method === 'time') {
    var dt = params.dt || new Date();
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) throw new Error('起课时间无效');
    var lunar = xlrGetSolarEngine(dt).fromDate(dt).getLunar();
    // 闰月处理: 取绝对值按本月算(通行做法之一, 有派闰月归下月, 改时核对)
    month = Math.abs(lunar.getMonth());
    day = lunar.getDay();
    var timeZhi = lunar.getTimeZhi();
    hourZhi = XLR_ZHI_NAMES.indexOf(timeZhi) + 1;
    lunarInfo = {
      text: lunar.getYearInChinese() + '年' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
      month: month, day: day, isLeapMonth: lunar.getMonth() < 0,
      timeZhi: timeZhi,
      ganzhi: { year: lunar.getYearInGanZhi(), month: lunar.getMonthInGanZhi(), day: lunar.getDayInGanZhi(), time: lunar.getTimeInGanZhi() }
    };
    input = { dt: dt };
  } else if (method === 'lunar') {
    month = xlrInteger(params.month, '农历月');
    day = xlrInteger(params.day, '农历日');
    if (month < 1 || month > 12) throw new Error('农历月须在 1-12 之间');
    if (day < 1 || day > 30) throw new Error('农历日须在 1-30 之间');
    hourZhi = xlrModOne(params.hourZhi, 12, '时支序数');
    input = { month: month, day: day, hourZhi: hourZhi };
  } else if (method === 'number') {
    month = xlrInteger(params.num1, '第一个数');
    day = xlrInteger(params.num2, '第二个数');
    hourZhi = xlrInteger(params.num3, '第三个数');
    if (month < 1 || day < 1 || hourZhi < 1) throw new Error('报数必须为正整数');
    input = { num1: month, num2: day, num3: hourZhi };
  } else {
    throw new Error('未知起课方式: ' + method);
  }

  var cast = xlrCast(month, day, hourZhi);
  var methodLabel = method === 'time' ? '时间起课' : method === 'lunar' ? '农历起课' : '报数起课';
  return {
    method: method,
    methodLabel: methodLabel,
    input: input,
    lunar: lunarInfo,
    month: month, day: day, hourZhi: hourZhi,
    yueGong: cast.yue,   // 月宫 — 事情开端/起因
    riGong: cast.ri,     // 日宫 — 发展过程
    shiGong: cast.shi,   // 时宫 — 最终结果(落宫为断)
    final: cast.shi,
    koujue: XLR_GONG_META[cast.shi.name].koujue,
    duanyi: XLR_GONG_META[cast.shi.name].duanyi
  };
}

// 组装给 AI 的确定性事实 prompt (AI 只解读, 不允许改落宫)
function formatXiaoliurenPrompt(pan, question) {
  var text = '【小六壬起课·' + pan.methodLabel + '】\n';
  if (pan.lunar) {
    text += '农历：' + pan.lunar.text + (pan.lunar.isLeapMonth ? '(闰月)' : '') + ' ' + pan.lunar.timeZhi + '时\n';
    text += '干支：' + pan.lunar.ganzhi.year + '年 ' + pan.lunar.ganzhi.month + '月 ' + pan.lunar.ganzhi.day + '日 ' + pan.lunar.ganzhi.time + '时\n';
  } else if (pan.method === 'lunar') {
    text += '农历：' + pan.month + '月' + pan.day + '日 ' + XLR_ZHI_NAMES[pan.hourZhi - 1] + '时\n';
  } else {
    text += '报数：' + pan.input.num1 + '、' + pan.input.num2 + '、' + pan.input.num3 + '\n';
  }
  text += '\n三传落宫（月宫为开端，日宫为过程，时宫为结果）：\n';
  text += '  月宫：' + pan.yueGong.name + '（' + pan.yueGong.wuxing + '·' + pan.yueGong.liushen + '·' + pan.yueGong.fangwei + '·' + pan.yueGong.jixiong + '）\n';
  text += '  日宫：' + pan.riGong.name + '（' + pan.riGong.wuxing + '·' + pan.riGong.liushen + '·' + pan.riGong.fangwei + '·' + pan.riGong.jixiong + '）\n';
  text += '  时宫：' + pan.shiGong.name + '（' + pan.shiGong.wuxing + '·' + pan.shiGong.liushen + '·' + pan.shiGong.fangwei + '·' + pan.shiGong.jixiong + '）★ 落宫为断\n';
  text += '\n最终落宫【' + pan.final.name + '】口诀：' + pan.koujue + '\n';
  text += '断意：' + pan.duanyi + '\n';
  if (question) text += '\n所问之事：' + question + '\n';
  return text;
}

window.xiaoliuren = {
  GONG_NAMES: XLR_GONG_NAMES,
  GONG_META: XLR_GONG_META,
  ZHI_NAMES: XLR_ZHI_NAMES,
  paiKe: paiKe,
  formatXiaoliurenPrompt: formatXiaoliurenPrompt
};
