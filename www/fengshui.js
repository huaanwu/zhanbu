// ========== 风水(八宅 + 24 山向)算盘层 v3.0.10 ==========
// 原则:八宅命卦/宅卦/吉凶位为 100% 确定性查表,AI 不允许"创作"命卦数。
// 公式来源(联网核实, 2026-07):
//   [S1] 命卦公式: 男命 11-年支序数(子=1起) 模9, 女命 4+年支序数 模9
//        0 视作 9; 模9=5 时为"坤"中宫命(传统归西四)
//        https://baike.baidu.com/item/%E5%91%BD%E5%8D%A6/4784138
//        https://baike.baidu.com/item/%E5%85%AB%E5%AE%85/5037438
//   [S2] 东四命: 坎1/震3/巽4/离9 → 吉位 东南/东/南/北(生气/天医/延年/伏位)
//        西四命: 坤2/兑7/乾6/艮8 → 吉位 西/西北/西南/东北
//        中宫命(模9=5): 传统归西四
//   [S3] 大门朝向→宅卦(后天八卦): 东=震 南=离 西=兑 北=坎
//        东南=巽 西南=坤 西北=乾 东北=艮
//   [S4] 宅命相合: 东四命+东四宅(坎震巽离) OR 西四命+西四宅(乾坤兑艮)
//        不合: 跨东四/西四 — 由 AI 给出化解方案

var FS_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var FS_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 年支序数: 子=1, 丑=2, ..., 亥=12
function fsZhiIdx(year) {
  // 1900=庚子(子=1)→ ((1900 - 4) % 12 + 12) % 12 + 1 = ((1896) % 12) + 1 = 0 + 1 = 1 ✓
  return ((year - 4) % 12 + 12) % 12 + 1;
}

// 年干: 1900=庚(7) → ((1900-4) % 10 + 10) % 10 = 6+10=... 简化: ((year - 4) % 10 + 10) % 10
function fsGanIdx(year) {
  return ((year - 4) % 10 + 10) % 10;
}

// 八宅九宫(数字 1-9): 1坎 2坤 3震 4巽 5中 6乾 7兑 8艮 9离
// 中宫=5 归西四(传统)
var FS_GUA_8 = {
  1: { name: '坎', group: 'east', nature: '水' },
  2: { name: '坤', group: 'west', nature: '土' },
  3: { name: '震', group: 'east', nature: '木' },
  4: { name: '巽', group: 'east', nature: '木' },
  5: { name: '中', group: 'west', nature: '土' },  // 中宫归西
  6: { name: '乾', group: 'west', nature: '金' },
  7: { name: '兑', group: 'west', nature: '金' },
  8: { name: '艮', group: 'west', nature: '土' },
  9: { name: '离', group: 'east', nature: '火' }
};

// 大门朝向 → 宅卦(S3)
var FS_MEN_GUA = {
  '东':'震', '南':'离', '西':'兑', '北':'坎',
  '东南':'巽', '西南':'坤', '西北':'乾', '东北':'艮'
};
var FS_MEN_DIR_TO_GUA_NUM = {};
Object.keys(FS_MEN_GUA).forEach(function (dir) {
  var name = FS_MEN_GUA[dir];
  // 找 name 对应的九宫数
  for (var k in FS_GUA_8) {
    if (FS_GUA_8[k].name === name) { FS_MEN_DIR_TO_GUA_NUM[dir] = parseInt(k, 10); break; }
  }
});

// 命卦确定性公式(S1)
function fsMingGua(year, gender) {
  if (!year || year < 1900 || year > 2099) {
    throw new Error('年份超出命卦公式支持范围(1900-2099): ' + year);
  }
  if (gender !== 'male' && gender !== 'female') {
    throw new Error('性别必须是 male/female: ' + gender);
  }
  var zhi = fsZhiIdx(year);  // 1-12
  var raw = gender === 'male' ? (11 - zhi) : (4 + zhi);
  var mod9 = raw % 9;
  // 0 视作 9
  var guaNum = mod9 === 0 ? 9 : mod9;
  var gua = FS_GUA_8[guaNum];
  var ganIdx = fsGanIdx(year);
  var yangYear = ganIdx % 2 === 0;  // 阳干:甲丙戊庚壬(0,2,4,6,8 偶数索引)
  return {
    year: year,
    yearGan: FS_GAN[ganIdx],
    yearZhi: FS_ZHI[zhi - 1],
    yearGanZhi: FS_GAN[ganIdx] + FS_ZHI[zhi - 1],
    yangYear: yangYear,
    gender: gender,
    guaNum: guaNum,
    guaName: gua.name,
    group: gua.group,        // 'east' | 'west'
    nature: gua.nature
  };
}

// 八宅吉凶位表(S2)
// "大游年"轨迹: 伏位→延年→生气→天医(4吉); 祸害→六煞→五鬼→绝命(4凶)
// 注:坎/震/巽/离(东四)与乾坤兑艮(西四)的吉凶方分布有流派差异,
// 本表取最主流的"大游年"轨迹;不同流派 AI 会注明。
var FS_GONG_8ZHAI = {
  1: { name:'坎', ji: { 伏位:'北', 生气:'东南', 天医:'东', 延年:'南' }, xiong: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } },
  2: { name:'坤', ji: { 伏位:'西南', 生气:'北', 天医:'东', 延年:'东南' }, xiong: { 祸害:'南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
  3: { name:'震', ji: { 伏位:'东', 生气:'南', 天医:'东南', 延年:'北' }, xiong: { 祸害:'西南', 六煞:'西', 五鬼:'东北', 绝命:'西北' } },
  4: { name:'巽', ji: { 伏位:'东南', 生气:'东', 天医:'北', 延年:'南' }, xiong: { 祸害:'西', 六煞:'东北', 五鬼:'西南', 绝命:'西北' } },
  5: { name:'中', ji: { 伏位:'中央', 生气:'南', 天医:'东', 延年:'北' }, xiong: { 祸害:'西南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
  6: { name:'乾', ji: { 伏位:'西北', 生气:'西南', 天医:'东', 延年:'北' }, xiong: { 祸害:'南', 六煞:'西', 五鬼:'东北', 绝命:'东南' } },
  7: { name:'兑', ji: { 伏位:'西', 生气:'西北', 天医:'东南', 延年:'南' }, xiong: { 祸害:'北', 六煞:'东北', 五鬼:'西南', 绝命:'东' } },
  8: { name:'艮', ji: { 伏位:'东北', 生气:'西', 天医:'北', 延年:'西南' }, xiong: { 祸害:'东', 六煞:'南', 五鬼:'西北', 绝命:'东南' } },
  9: { name:'离', ji: { 伏位:'南', 生气:'北', 天医:'东', 延年:'东南' }, xiong: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } }
};

// 大门朝向 → 八宅吉凶
function fsEightZhai(doorDir) {
  var guaNum = FS_MEN_DIR_TO_GUA_NUM[doorDir];
  if (!guaNum) return null;
  var t = FS_GONG_8ZHAI[guaNum];
  return { guaNum: guaNum, guaName: t.name, ji: t.ji, xiong: t.xiong };
}

// 宅命相合判定(S4): 同 group=east/west 为相合;跨为不合
function fsZhaiMingHe(mingGuaResult, eightZhaiResult) {
  if (!mingGuaResult || !eightZhaiResult) return { he: false, reason: 'missing' };
  var same = mingGuaResult.group === (eightZhaiResult.guaNum in { 1:'east', 2:'west', 3:'east', 4:'east', 5:'west', 6:'west', 7:'west', 8:'west', 9:'east' } ? (function(){ var n=eightZhaiResult.guaNum; return n===1||n===3||n===4||n===9 ? 'east' : 'west'; })() : 'west');
  // 简化为:
  var zhaiGroup = (eightZhaiResult.guaNum === 1 || eightZhaiResult.guaNum === 3 ||
                   eightZhaiResult.guaNum === 4 || eightZhaiResult.guaNum === 9) ? 'east' : 'west';
  same = mingGuaResult.group === zhaiGroup;
  return {
    he: same,
    mingGroup: mingGuaResult.group,
    zhaiGroup: zhaiGroup,
    mingGua: mingGuaResult.guaName,
    zhaiGua: eightZhaiResult.guaName,
    summary: same ? '宅命相合 — 吉位可充分发挥,布局顺畅'
                  : '宅命不合 — 跨东四/西四,需结合化解(由 AI 给具体方案)'
  };
}

// 主卧朝向 → 吉凶(同一套八宅表,但把主卧门当作"气口"看)
function fsMainRoomAssess(doorDir, mainRoomDir, mingGroup) {
  var base = fsEightZhai(doorDir);
  if (!base) return null;
  // 看主卧方向在吉/凶方中的位置
  var all = {};
  Object.keys(base.ji).forEach(function (k) { all[base.ji[k]] = { type: 'ji', star: k, level: k === '伏位' ? '小吉' : (k === '生气' || k === '延年' || k === '天医') ? '大吉' : '小吉' }; });
  Object.keys(base.xiong).forEach(function (k) { all[base.xiong[k]] = { type: 'xiong', star: k, level: k === '祸害' ? '小凶' : k === '六煞' ? '中凶' : k === '五鬼' ? '大凶' : '至凶' }; });
  var hit = all[mainRoomDir];
  return hit ? { direction: mainRoomDir, ...hit } : { direction: mainRoomDir, type: 'unknown' };
}

// 24 山向(每卦 3 山,共 24): 壬子/癸 丑艮/寅 甲卯/乙 辰巽/巳 丙午/丁 未坤/申 庚酉/辛 戌乾/亥
// 用于后续玄空飞星(S4);本轮先提供查表函数,不接 UI
var FS_24_SHAN = {
  '北': ['壬', '子', '癸'],
  '西南': ['未', '坤', '申'],
  '东': ['甲', '卯', '乙'],
  '东南': ['辰', '巽', '巳'],
  '南': ['丙', '午', '丁'],
  '西北': ['戌', '乾', '亥'],
  '西': ['庚', '酉', '辛'],
  '东北': ['丑', '艮', '寅']
};

window.fengshui = {
  // 算盘层
  mingGua: fsMingGua,
  eightZhai: fsEightZhai,
  zhaiMingHe: fsZhaiMingHe,
  mainRoomAssess: fsMainRoomAssess,
  // 查表常量(暴露给测试 + 后续玄空飞星用)
  GUA_8: FS_GUA_8,
  GONG_8ZHAI: FS_GONG_8ZHAI,
  MEN_GUA: FS_MEN_GUA,
  SHAN_24: FS_24_SHAN,
  // helper
  zhiIdx: fsZhiIdx,
  ganIdx: fsGanIdx
};