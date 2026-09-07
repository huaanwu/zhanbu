// ========== 灵签(观音灵签/关帝灵签)抽签与解析 ==========
// 纯函数为主: KB 数据作为参数传入(不直接 fetch), 方便 Node 测试。
// 数据来源:
//   观音灵签: www/kb_data/buddhism_divine_kb.json (entries bdiv_21..bdiv_120, num 1-100, 字段 num/level/title/poem/desc/advice)
//   关帝灵签: www/kb_data/guandi_qian_kb.json (entries guandi_001..guandi_100, num 1-100,
//             字段 num/ganzhi/level/gudian/gudian_alt/poem/shengyi/jie/dongpo/bixian; 来源见该文件 _comment)
// 原则与 liuyao.js 一致: 抽签只产出签号, 签文为 KB 既定事实, AI 只做解读不"创作"签文。

var LQ_KIND_NAMES = { guanyin: '观音灵签', guandi: '关帝灵签' };

function lqCheckKind(kind) {
  if (kind !== 'guanyin' && kind !== 'guandi') throw new Error('未知签种: ' + kind);
}

// mulberry32: 可复现伪随机(seed 仅用于测试)
function lqRng(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 抽签: kind 'guanyin'|'guandi', 返回 1-100 签号。
 * seed 可选, 传入整数则结果可复现(测试用)。
 */
function draw(kind, seed) {
  lqCheckKind(kind);
  if (seed !== undefined && seed !== null) {
    var s = Number(seed);
    if (!Number.isFinite(s)) throw new Error('seed 必须是有限数');
    return Math.floor(lqRng(Math.floor(s))() * 100) + 1;
  }
  return Math.floor(Math.random() * 100) + 1;
}

function lqFindEntry(kbData, num) {
  if (!kbData || !Array.isArray(kbData.entries)) throw new Error('知识库数据无效(缺 entries)');
  for (var i = 0; i < kbData.entries.length; i++) {
    if (kbData.entries[i].num === num) return kbData.entries[i];
  }
  return null;
}

/**
 * 从 KB 数据解析出第 num 签:
 * 返回 { kind, kindName, num, title, level, poem, jie, gudian, shengyi, dongpo, bixian, advice, ganzhi }
 * (观音签无 shengyi/dongpo/bixian/ganzhi, 对应字段为空串)
 */
function parseQian(kind, num, kbData) {
  lqCheckKind(kind);
  var n = Number(num);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('签号须为 1-100 的整数');
  var e = lqFindEntry(kbData, n);
  if (!e) throw new Error('知识库中未找到第 ' + n + ' 签');
  if (!e.poem) throw new Error('第 ' + n + ' 签数据缺签诗');
  var kindName = LQ_KIND_NAMES[kind];
  if (kind === 'guanyin') {
    return {
      kind: kind, kindName: kindName, num: n,
      title: kindName + '第' + n + '签·' + (e.title || ''),
      level: e.level || '中平',
      poem: e.poem,
      jie: e.desc || '',
      gudian: e.title || '',
      shengyi: '', dongpo: '', bixian: '', ganzhi: '',
      advice: e.advice || ''
    };
  }
  return {
    kind: kind, kindName: kindName, num: n,
    title: kindName + '第' + n + '签·' + (e.gudian || ''),
    level: e.level || e.category || '中平',
    poem: e.poem,
    jie: e.jie || '',
    gudian: e.gudian_alt && e.gudian_alt !== e.gudian ? (e.gudian + '（另本作：' + e.gudian_alt + '）') : (e.gudian || ''),
    shengyi: e.shengyi || '',
    dongpo: e.dongpo || '',
    bixian: e.bixian || '',
    ganzhi: e.ganzhi || '',
    advice: ''
  };
}

// 组装给 AI 的确定性事实 prompt (签号/等级/签文为既定签文, AI 只解读)
function formatLingqianPrompt(qian, question) {
  var text = '【' + qian.kindName + '·第' + qian.num + '签】\n';
  if (qian.ganzhi) text += '签号干支：' + qian.ganzhi + '\n';
  text += '吉凶等级：' + qian.level + '\n';
  text += '典故：' + qian.gudian + '\n';
  text += '签诗：' + qian.poem + '\n';
  if (qian.shengyi) text += '圣意：' + qian.shengyi + '\n';
  if (qian.jie) text += (qian.kind === 'guanyin' ? '签意：' : '解曰：') + qian.jie + '\n';
  if (qian.dongpo) text += '东坡解：' + qian.dongpo + '\n';
  if (qian.bixian) text += '碧仙注：' + qian.bixian + '\n';
  if (qian.advice) text += '化解建议：' + qian.advice + '\n';
  text += '\n说明：签号、吉凶等级与签诗为既定签文事实，不可更改；请以此为据解签。\n';
  if (question) text += '\n所问之事：' + question + '\n';
  return text;
}

window.lingqian = {
  KIND_NAMES: LQ_KIND_NAMES,
  draw: draw,
  parseQian: parseQian,
  formatLingqianPrompt: formatLingqianPrompt
};
