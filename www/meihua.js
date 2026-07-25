// ========== 梅花易数起卦/体用分析系统 v1.0 ==========
// 起卦复用 liuyao.js 的 qiGuaByTime / qiGuaByNumber(与梅花年月日时法、数字法规则一致),
// 本文件负责梅花特有的确定性分析: 体用判定、五行生克、互卦/变卦关系。
// 原则: 体用/生克/吉凶是 100% 确定性规则, 由代码给出, AI 只做展开解读。
//
// 体用规则(通行): 动爻所在经卦为"用"(事体/外因), 无动爻的经卦为"体"(自己/内因)。
// 生克断法: 用生体大吉, 体克用小吉, 体用比和吉, 体生用凶(泄气), 用克体大凶。
// 变卦看结果, 互卦看过程, 均以与体卦的生克关系参断。

// 八卦基础表(序号与 liuyao.js GUA_NAME 一致: 1乾2兑3离4震5巽6坎7艮8坤, lines 自下而上)
var MH_TRIGRAM = {
  1: { name: '乾', symbol: '☰', wuxing: '金', nature: '天', lines: [1,1,1] },
  2: { name: '兑', symbol: '☱', wuxing: '金', nature: '泽', lines: [1,1,0] },
  3: { name: '离', symbol: '☲', wuxing: '火', nature: '火', lines: [1,0,1] },
  4: { name: '震', symbol: '☳', wuxing: '木', nature: '雷', lines: [1,0,0] },
  5: { name: '巽', symbol: '☴', wuxing: '木', nature: '风', lines: [0,1,1] },
  6: { name: '坎', symbol: '☵', wuxing: '水', nature: '水', lines: [0,1,0] },
  7: { name: '艮', symbol: '☶', wuxing: '土', nature: '山', lines: [0,0,1] },
  8: { name: '坤', symbol: '☷', wuxing: '土', nature: '地', lines: [0,0,0] }
};

var MH_SHENG = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' }; // key 生 value
var MH_KE = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };     // key 克 value

function mhTrigramByName(name) {
  for (var n = 1; n <= 8; n++) {
    if (MH_TRIGRAM[n].name === name) return n;
  }
  throw new Error('未知的经卦名: ' + name);
}

function mhTrigramFromLines(bottomUpLines) {
  for (var n = 1; n <= 8; n++) {
    var l = MH_TRIGRAM[n].lines;
    if (l[0] === bottomUpLines[0] && l[1] === bottomUpLines[1] && l[2] === bottomUpLines[2]) return n;
  }
  throw new Error('无效的三爻卦象: ' + JSON.stringify(bottomUpLines));
}

// 体卦五行 vs 另一卦五行 的生克关系与吉凶(以体为主语)
function mhRelation(tiWuxing, otherWuxing) {
  if (tiWuxing === otherWuxing) {
    return { label: '比和', jixiong: '吉', desc: '体用比和，事易成就，得人助力，谋为顺畅' };
  }
  if (MH_SHENG[otherWuxing] === tiWuxing) {
    return { label: '用生体', jixiong: '大吉', desc: '用生体，有进益之喜，外力助我，事易成' };
  }
  if (MH_KE[tiWuxing] === otherWuxing) {
    return { label: '体克用', jixiong: '小吉', desc: '体克用，事可成但须费力，成之稍迟' };
  }
  if (MH_SHENG[tiWuxing] === otherWuxing) {
    return { label: '体生用', jixiong: '凶·泄气', desc: '体生用，泄气耗力，事多劳而少成，防破财耗损' };
  }
  // MH_KE[other] === ti
  return { label: '用克体', jixiong: '大凶', desc: '用克体，事难成，防损失、疾病、官非之灾' };
}

// 另一卦(互/变)与体卦的关系描述(用词随卦位调整)
function mhAuxRelation(tiWuxing, otherWuxing, auxLabel) {
  if (tiWuxing === otherWuxing) return auxLabel + '与体比和，助力平稳';
  if (MH_SHENG[otherWuxing] === tiWuxing) return auxLabel + '生体，' + (auxLabel.indexOf('变') >= 0 ? '结果转吉' : '过程有助');
  if (MH_KE[tiWuxing] === otherWuxing) return auxLabel + '被体所克，我方能掌控' + (auxLabel.indexOf('变') >= 0 ? '结果' : '过程');
  if (MH_SHENG[tiWuxing] === otherWuxing) return auxLabel + '泄体，' + (auxLabel.indexOf('变') >= 0 ? '结果耗力' : '过程劳神');
  return auxLabel + '克体，' + (auxLabel.indexOf('变') >= 0 ? '结果不利' : '过程有阻');
}

function mhRequireLiuyao() {
  var liuyao = (typeof window !== 'undefined' && window.liuyao) || (typeof globalThis !== 'undefined' && globalThis.window && globalThis.window.liuyao);
  if (!liuyao || typeof liuyao.getGuaImage !== 'function') {
    throw new Error('六爻排盘模块(liuyao.js)未加载，梅花易数依赖其起卦/卦象函数');
  }
  return liuyao;
}

/**
 * 梅花易数起卦 + 体用分析
 * method: 'time'   params: { dt, lunarContext? }     — 年月日时法(年支数+月+日 / +时)
 *         'number' params: { num1, num2, num3? }     — 数字法(一数%8上卦, 二数%8下卦, 三数或两数和%6动爻)
 */
function paiGua(method, params) {
  params = params || {};
  var liuyao = mhRequireLiuyao();
  var qi;
  if (method === 'time') {
    qi = liuyao.qiGuaByTime(params.dt || new Date(), params.lunarContext);
  } else if (method === 'number') {
    qi = liuyao.qiGuaByNumber(params.num1, params.num2, params.num3);
  } else {
    throw new Error('未知起卦方式: ' + method);
  }

  var image = liuyao.getGuaImage(qi.upper, qi.lower, [qi.dong]);
  var dongInUpper = qi.dong >= 4; // 动爻在四/五/上爻 → 动在上卦
  var tiNum = dongInUpper ? qi.lower : qi.upper;
  var yongNum = dongInUpper ? qi.upper : qi.lower;
  var ti = MH_TRIGRAM[tiNum];
  var yong = MH_TRIGRAM[yongNum];
  var relation = mhRelation(ti.wuxing, yong.wuxing);

  // 互卦(过程): huGuaLines = 互下(3爻,自下而上) + 互上(3爻)
  var huLowerNum = mhTrigramFromLines(image.huGuaLines.slice(0, 3));
  var huUpperNum = mhTrigramFromLines(image.huGuaLines.slice(3, 6));
  var huLower = MH_TRIGRAM[huLowerNum];
  var huUpper = MH_TRIGRAM[huUpperNum];

  // 变卦(结果): 用侧变出的新卦与体的关系
  var bianYongName = dongInUpper ? image.bianUpperGua : image.bianLowerGua;
  var bianYong = MH_TRIGRAM[mhTrigramByName(bianYongName)];

  // 综合断语: 以用对体为主, 变卦(结果)参断
  var verdict = relation.desc + '。';
  var bianRel = mhAuxRelation(ti.wuxing, bianYong.wuxing, '变卦');
  verdict += bianRel + '。';
  var goodStart = relation.jixiong.indexOf('吉') >= 0;
  var goodEnd = bianRel.indexOf('吉') >= 0 || bianRel.indexOf('比和') >= 0 || bianRel.indexOf('掌控') >= 0;
  if (goodStart && !goodEnd) verdict += '虽开局有利，须防先吉后凶、乐极生悲。';
  if (!goodStart && goodEnd) verdict += '虽眼前多阻，结局有望转好，宜坚持徐图。';

  return {
    method: method,
    methodLabel: qi.method,
    input: params,
    lunar: qi.lunar || null,
    gua: image,
    dong: qi.dong,
    dongYaoName: image.dongYaoName,
    ti: { num: tiNum, name: ti.name, symbol: ti.symbol, wuxing: ti.wuxing, nature: ti.nature, position: dongInUpper ? '下卦' : '上卦' },
    yong: { num: yongNum, name: yong.name, symbol: yong.symbol, wuxing: yong.wuxing, nature: yong.nature, position: dongInUpper ? '上卦' : '下卦' },
    relation: relation,
    hu: {
      name: image.huGuaName,
      upper: { name: huUpper.name, symbol: huUpper.symbol, wuxing: huUpper.wuxing },
      lower: { name: huLower.name, symbol: huLower.symbol, wuxing: huLower.wuxing },
      upperRel: mhAuxRelation(ti.wuxing, huUpper.wuxing, '互卦上'),
      lowerRel: mhAuxRelation(ti.wuxing, huLower.wuxing, '互卦下')
    },
    bian: {
      name: image.bianGuaName,
      yongSide: { name: bianYong.name, symbol: bianYong.symbol, wuxing: bianYong.wuxing },
      rel: bianRel
    },
    verdict: verdict
  };
}

// 组装给 AI 的确定性事实 prompt (体用/生克为代码定论, AI 不可更改)
function formatMeihuaPrompt(pan, question) {
  var text = '【梅花易数·' + pan.methodLabel + '】\n';
  if (pan.lunar) {
    text += '农历:' + pan.lunar.month + '月' + pan.lunar.day + '日' + (pan.lunar.isLeapMonth ? '(闰月)' : '') + ' ' + pan.lunar.hourZhi + '时\n';
  } else if (pan.method === 'number') {
    var nums = pan.input;
    text += '报数:' + nums.num1 + '、' + nums.num2 + (nums.num3 ? '、' + nums.num3 : '(动爻取两数和)') + '\n';
  }
  text += '\n本卦:' + pan.gua.name + '(' + pan.gua.upperGua + '上' + pan.gua.lowerGua + '下),动爻:' + pan.dongYaoName + '\n';
  text += '互卦:' + pan.hu.name + '(过程),变卦:' + pan.bian.name + '(结果)\n';
  text += '\n体用判定(动爻在' + pan.yong.position + '):\n';
  text += '  体卦:' + pan.ti.name + pan.ti.symbol + '五行属' + pan.ti.wuxing + '(' + pan.ti.position + ',代表求测者自身)\n';
  text += '  用卦:' + pan.yong.name + pan.yong.symbol + '五行属' + pan.yong.wuxing + '(' + pan.yong.position + ',代表所占之事)\n';
  text += '\n生克断法(代码定论,不可更改):\n';
  text += '  体用关系:' + pan.relation.label + ' → ' + pan.relation.jixiong + '。' + pan.relation.desc + '\n';
  text += '  互卦(过程):上' + pan.hu.upper.name + pan.hu.upper.wuxing + '、下' + pan.hu.lower.name + pan.hu.lower.wuxing + ' → ' + pan.hu.upperRel + ';' + pan.hu.lowerRel + '\n';
  text += '  变卦(结果):用侧变出' + pan.bian.yongSide.name + pan.bian.yongSide.wuxing + ' → ' + pan.bian.rel + '\n';
  text += '\n综合断语:' + pan.verdict + '\n';
  if (question) text += '\n所问之事:' + question + '\n';
  return text;
}

window.meihua = {
  TRIGRAM: MH_TRIGRAM,
  paiGua: paiGua,
  formatMeihuaPrompt: formatMeihuaPrompt,
  relationOf: mhRelation
};
