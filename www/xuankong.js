// ========== 玄空飞星算盘层 v3.0.11 ==========
// 三元九运 + 运盘 + 山向飞星(基础版,不含替卦/中五/零神等进阶)
// 数据来源(联网核实, 2026-07):
//   [S1] 三元九运: 上元 1-3运(1864-1923), 中元 4-6运(1924-1983), 下元 7-9运(1984-2043)
//        每运 20 年, 1运=1864-1883 (一白贪狼), 2运=1884-1903 (二黑巨门)...
//        9运=2024-2043 (九紫右弼), 当前为下元九运
//        https://baike.baidu.com/item/%E4%B8%89%E5%85%83%E4%B9%9D%E8%BF%90/2474138
//   [S2] 洛书九宫序: 5→6→7→8→9→1→2→3→4→5 (顺飞路径)
//        中5 → 乾6 → 兑7 → 艮8 → 离9 → 坎1 → 坤2 → 震3 → 巽4 → 回中5
//   [S3] 运盘: 当运之星入中(5宫), 顺飞至各宫, 形成"运盘九宫图"
//        配合山向飞星: 山星坐方入中顺飞, 向星向方入中顺飞
//   [S4] 旺山旺向判定: 山星到山宫 + 向星到向宫 同为当运旺星 → 上吉
//        上山下水: 山星到向宫凶星 + 向星到山宫凶星 → 大凶
//   [S5] 九星五行/吉凶 (与 fengshui.js 八宅表独立, 但九星名同):
//        一白水(吉) 二黑土(凶) 三碧木(凶) 四绿木(平)
//        五黄土(大凶) 六白金(吉) 七赤金(凶) 八白土(吉) 九紫火(吉)

// 九星 1-9 对应
var XK_STARS = ['一白贪狼','二黑巨门','三碧禄存','四绿文曲','五黄廉贞','六白武曲','七赤破军','八白左辅','九紫右弼'];
var XK_NATURE = ['水','土','木','木','土','金','金','土','火'];  // 按 1-9
var XK_GOOD   = [true, false, false, true,  false, true,  false, true,  true];  // 吉/平/凶 (4 绿算平)
var XK_LV     = ['桃花/智慧','病符','是非','文昌','大煞','偏财','破财','财/旺','喜气/桃花'];
var XK_ZHI    = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];  // v3.0.14 加

// 洛书九宫顺飞路径: 中5→乾6→兑7→艮8→离9→坎1→坤2→震3→巽4→回中
// 即 从 5 起,顺序为 [5,6,7,8,9,1,2,3,4]
var XK_LUO_SHU_PATH = [5, 6, 7, 8, 9, 1, 2, 3, 4];

// 24 山向→九宫数(子=1坎/卯=3震/午=9离/酉=7兑 加上乾坤艮巽+ 12 偏)
// 简化为: 用 8 卦对应 (与 fengshui.MEN_GUA 相同,但需要 24 山粒度)
function xkDirToGuaNum(dir) {
  var map = {
    '东':3,'东南':4,'南':9,'西南':2,'西':7,'西北':6,'北':1,'东北':8
  };
  return map[dir] || null;
}

// 当前运(返回 1-9)
// 1864 起一白运; 1运=1864-1883, ..., 9运=2024-2043, 10运=2044 又是 一白
function xkCurrentYun(year) {
  if (!year || year < 1864 || year > 9999) {
    throw new Error('玄空飞星仅支持 1864 年起的年份: ' + year);
  }
  var n = Math.floor((year - 1864) / 20) + 1;  // 第几运(1-based)
  var yun = ((n - 1) % 9) + 1;                // 1-9 循环
  var yunName = XK_STARS[yun - 1];
  var startYear = 1864 + (n - 1) * 20;
  var endYear = startYear + 19;
  return {
    year: year,
    yun: yun,
    yunStar: yun,  // 入中星的数字
    yunName: yunName,
    nature: XK_NATURE[yun - 1],
    isJi: XK_GOOD[yun - 1],
    level: XK_LV[yun - 1],
    period: yun <= 3 ? '上元' : (yun <= 6 ? '中元' : '下元'),
    startYear: startYear,
    endYear: endYear,
    yearsFromStart: year - startYear  // 当前在运内第几年(0-19)
  };
}

// 运盘: 当运星入中, 顺飞九宫
// 返回数组 [c1, c2, ..., c9] 表示 1-9 宫所入之星
// 洛书路径: path[0]=5宫, path[1]=6宫, ..., path[8]=4宫
// 公式: panByGong[path[i]] = centerStar + i (1-9循环)
function xkYunPan(year) {
  var y = xkCurrentYun(year);
  var centerStar = y.yunStar;  // 入中星
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];   // 5,6,7,8,9,1,2,3,4
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    yun: y.yun,
    yunName: y.yunName,
    period: y.period,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    },
    isJi: function (gong) {
      var star = panByGong[gong];
      return XK_GOOD[star - 1];
    },
    isJiHuang: function (gong) {
      return panByGong[gong] === 5;  // 五黄到宫大凶
    }
  };
}

// 山盘: 坐方所属卦宫入中, 顺飞九宫
// sitDir: '东'|'南'|'西'|'北'|'东南'|'西南'|'西北'|'东北'
// 入中星 = 坐卦对应的元旦盘原位星(简化版: 即坐卦本身)
// 顺飞: 入中后沿洛书轨迹顺飞
function xkMountainPan(year, sitDir) {
  var sitGong = xkDirToGuaNum(sitDir);
  if (!sitGong) throw new Error('玄空山盘: 未知坐向 ' + sitDir);
  var centerStar = sitGong;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    sitDir: sitDir,
    sitGong: sitGong,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// 向盘: 向方所属卦宫入中
function xkFacePan(year, faceDir) {
  var faceGong = xkDirToGuaNum(faceDir);
  if (!faceGong) throw new Error('玄空向盘: 未知向方 ' + faceDir);
  var centerStar = faceGong;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    faceDir: faceDir,
    faceGong: faceGong,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// 旺山旺向判定(S4)
function xkWangShanWangXiang(yunPan, mPan, fPan, sitDir, faceDir) {
  var sitGong = xkDirToGuaNum(sitDir);
  var faceGong = xkDirToGuaNum(faceDir);
  var yunStar = yunPan.centerStar;
  // 山星到坐 = 旺山; 向星到向 = 旺向
  var mountainStarAtSit = mPan.panByGong[sitGong];  // 山盘在坐宫所入星
  var faceStarAtFace = fPan.panByGong[faceGong];     // 向盘在向宫所入星
  // 当运星=yunStar; 山/向 旺需 = yunStar
  return {
    sitDir: sitDir,
    faceDir: faceDir,
    yunStar: yunStar,
    mountainStarAtSit: mountainStarAtSit,
    faceStarAtFace: faceStarAtFace,
    wangShan: mountainStarAtSit === yunStar,
    wangXiang: faceStarAtFace === yunStar,
    verdict: (mountainStarAtSit === yunStar && faceStarAtFace === yunStar)
      ? '旺山旺向 — 上吉(山向皆得当运旺星,财丁皆旺)'
      : (mountainStarAtSit === yunStar && faceStarAtFace !== yunStar)
      ? '旺山不旺向 — 主丁财一般,主丁不旺财'
      : (mountainStarAtSit !== yunStar && faceStarAtFace === yunStar)
      ? '旺向不旺山 — 旺财不旺丁'
      : '上山下水 — 山向皆不当运,需化解(由 AI 给具体方案)'
  };
}

// 五黄煞 / 二黑病符 定位(简化)
function xkWuhuangAndErhei(yunPan) {
  var wuAt = null, erAt = null;
  for (var g = 1; g <= 9; g++) {
    if (yunPan.panByGong[g] === 5) wuAt = g;
    if (yunPan.panByGong[g] === 2) erAt = g;
  }
  return { wuhuangAt: wuAt, erheiAt: erAt };
}

// 组装给 AI 的确定性事实 prompt
function xkFormatPrompt(year, sitDir, faceDir) {
  var y = xkCurrentYun(year);
  var yp = xkYunPan(year);
  var mp = xkMountainPan(year, sitDir);
  var fp = xkFacePan(year, faceDir);
  var verdict = xkWangShanWangXiang(yp, mp, fp, sitDir, faceDir);
  var wswh = xkWuhuangAndErhei(yp);
  var s = '【玄空飞星·' + y.period + '·第' + y.yun + '运 (' + y.yunName + ')】\n';
  s += '年份:' + year + '年(本运:' + y.startYear + '-' + y.endYear + '年,当前已过' + (y.yearsFromStart + 1) + '年)\n';
  s += '坐方:' + sitDir + '(坐卦' + xkDirToGuaNum(sitDir) + '宫)\n';
  s += '向方:' + faceDir + '(向卦' + xkDirToGuaNum(faceDir) + '宫)\n\n';
  s += '运盘(当运' + y.yunName + '入中,洛书顺飞):\n';
  for (var g = 1; g <= 9; g++) {
    var star = yp.panByGong[g];
    s += '  ' + g + '宫:' + star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')\n';
  }
  s += '\n山盘(坐卦' + mp.sitGong + '入中,顺飞):\n';
  for (var g2 = 1; g2 <= 9; g2++) {
    var s2 = mp.panByGong[g2];
    s += '  ' + g2 + '宫:' + s2 + '(' + XK_STARS[s2 - 1].slice(2) + ')\n';
  }
  s += '\n向盘(向卦' + fp.faceGong + '入中,顺飞):\n';
  for (var g3 = 1; g3 <= 9; g3++) {
    var s3 = fp.panByGong[g3];
    s += '  ' + g3 + '宫:' + s3 + '(' + XK_STARS[s3 - 1].slice(2) + ')\n';
  }
  s += '\n旺山旺向判定:山星到坐=' + verdict.mountainStarAtSit + ' (' + (verdict.wangShan ? '旺' : '不旺') + '),';
  s += '向星到向=' + verdict.faceStarAtFace + ' (' + (verdict.wangXiang ? '旺' : '不旺') + ')\n';
  s += '结论:' + verdict.verdict + '\n';
  s += '五黄到' + wswh.wuhuangAt + '宫,二黑到' + wswh.erheiAt + '宫(化解要点)\n';
  return s;
}

// ============ v3.0.14 流年飞星 ============
// 流年地支 → 后天八卦宫号
// 子=1坎 丑=8艮 寅=8艮(同上) 卯=3震 辰=4巽 巳=4巽
// 午=9离 未=2坤 申=2坤 酉=7兑 戌=6乾 亥=6乾
var XK_ZHI_TO_GONG = {
  '子': 1, '丑': 8, '寅': 8,
  '卯': 3, '辰': 4, '巳': 4,
  '午': 9, '未': 2, '申': 2,
  '酉': 7, '戌': 6, '亥': 6
};

// 12 月份地支(农历正月寅、二月卯...十二月丑)
var XK_MONTH_ZHI = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
var XK_MONTH_CN = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

// 流年飞星: 流年地支所在宫入中, 顺飞
// year: 公历年(4 位)
function xkLiunianPan(year) {
  if (!year || year < 1864 || year > 9999) {
    throw new Error('流年飞星: 年份超出范围: ' + year);
  }
  // 流年地支: ((year - 4) % 12 + 12) % 12
  var zhiIdx = ((year - 4) % 12 + 12) % 12;
  var zhi = XK_ZHI[zhiIdx];  // 0=子,1=丑,...,11=亥
  var centerGong = XK_ZHI_TO_GONG[zhi];
  var centerStar = centerGong;  // 起中星=起中宫
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    yearZhi: zhi,
    centerGong: centerGong,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// 流月飞星: 月份地支所在宫入中, 顺飞
// month: 1-12 (农历月, 1=正月寅)
// v3.0.15: 也支持 month='乙未' 这种干支纪月(直接取地支),或 monthGZ 参数
function xkLiuyuePan(year, month) {
  var monthZhi, monthCN, monthNum;
  if (typeof month === 'string' && month.length >= 1) {
    // 干支纪月(乙未/丙申...) → 取最后一位地支
    var last = month.charAt(month.length - 1);
    if (XK_ZHI_TO_GONG[last] === undefined) {
      throw new Error('流月飞星: 未知干支地支: ' + month);
    }
    monthZhi = last;
    monthNum = XK_MONTH_ZHI.indexOf(last) + 1;
    monthCN = monthNum > 0 ? XK_MONTH_CN[monthNum - 1] : month;
  } else if (typeof month === 'number' && month >= 1 && month <= 12) {
    monthZhi = XK_MONTH_ZHI[month - 1];
    monthNum = month;
    monthCN = XK_MONTH_CN[month - 1];
  } else {
    throw new Error('流月飞星: 月份须为 1-12 或干支纪月: ' + month);
  }
  var centerGong = XK_ZHI_TO_GONG[monthZhi];
  var centerStar = centerGong;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    month: monthNum,
    monthZhi: monthZhi,
    monthCN: monthCN,
    centerGong: centerGong,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// v3.0.15: 农历月干支查询(从公历日期反推)
// 返回 { yearGZ, monthGZ, monthZhi } — monthGZ 含天干地支(如 "乙未")
// 需要 lunar 引擎(window.Solar / window.LunarLib.Solar)已加载
function xkLunarMonthGZ(date) {
  var dt = date || new Date();
  var Solar = (typeof window !== 'undefined' && window.Solar)
    || (typeof window !== 'undefined' && window.LunarLib && window.LunarLib.Solar);
  if (!Solar || typeof Solar.fromYmd !== 'function') {
    throw new Error('xkLunarMonthGZ: 需要 lunar 引擎(window.Solar)');
  }
  var s = Solar.fromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  var l = s.getLunar();
  return {
    yearGZ: l.getYearInGanZhi(),
    monthGZ: l.getMonthInGanZhi(),
    monthZhi: l.getMonthInGanZhi().slice(-1),
    monthNum: l.getMonth()  // 1-12(负数=闰月)
  };
}

// 流年/流月 五黄定位(用于叠加化解提示)
function xkLiunianAndLiuyueWuhuang(year, month) {
  var ln = xkLiunianPan(year);
  var ly = month ? xkLiuyuePan(year, month) : null;
  var lnWh = null, lnEr = null, lyWh = null, lyEr = null;
  for (var g = 1; g <= 9; g++) {
    if (ln.panByGong[g] === 5) lnWh = g;
    if (ln.panByGong[g] === 2) lnEr = g;
    if (ly && ly.panByGong[g] === 5) lyWh = g;
    if (ly && ly.panByGong[g] === 2) lyEr = g;
  }
  return {
    liunianWuhuang: lnWh,
    liunianErhei: lnEr,
    liuyueWuhuang: lyWh,
    liuyueErhei: lyEr,
    // 双五黄叠加标记
    doubleWu: (lnWh !== null && lyWh !== null && lnWh === lyWh)
  };
}

// ============ v3.0.16 替卦(替星起法) ============
// 八宫卦对应替星表(传统玄空本义 + 沈氏玄空学):
//   坎(1) 替星 = 7  (坤/震/巽/中/乾/兑/艮/离 类似)
// 派别分歧: [A]坎=1,[B]坎=7。主流派 [B] 因 "子午卯酉挨星" 替换规则
//   巽(4) 替星 = 6
//   乾(6) 替星 = 9
//   兑(7) 替星 = 3
//   艮(8) 替星 = 8 (本宫, 不替)
//   离(9) 替星 = 4
//   坤(2) = 2 (本宫)
//   震(3) = 5 (本宫)
var XK_TI_GUA = { 1: 7, 2: 2, 3: 5, 4: 6, 6: 9, 7: 3, 8: 8, 9: 4 };

// 替卦山盘: 坐卦找替星,替星入中,顺飞
function xkTiGuaMountainPan(year, sitDir) {
  var sitGong = xkDirToGuaNum(sitDir);
  if (!sitGong) throw new Error('玄空替卦山盘: 未知坐向 ' + sitDir);
  var tiStar = XK_TI_GUA[sitGong];
  if (!tiStar) throw new Error('玄空替卦山盘: 坐卦' + sitGong + '无替星映射');
  var centerStar = tiStar;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    sitDir: sitDir,
    sitGong: sitGong,
    tiStar: tiStar,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// 替卦向盘: 向卦找替星
function xkTiGuaFacePan(year, faceDir) {
  var faceGong = xkDirToGuaNum(faceDir);
  if (!faceGong) throw new Error('玄空替卦向盘: 未知向方 ' + faceDir);
  var tiStar = XK_TI_GUA[faceGong];
  if (!tiStar) throw new Error('玄空替卦向盘: 向卦' + faceGong + '无替星映射');
  var centerStar = tiStar;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    faceDir: faceDir,
    faceGong: faceGong,
    tiStar: tiStar,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// ============ v3.0.17 流日飞星 ============
// 60 日干支(天干地支组合)→ 后天八卦宫号
// 天干映射: 甲=1 乙=2 ...(天干无宫,只用日地支)
// 实际上"日飞星"用的是日地支(60 甲子循环的地支部分)
// 地支→宫号同 XK_ZHI_TO_GONG

// 流日飞星: 日干支的地支入中, 顺飞
// dayGZ: 干支纪日(如 '甲子'/'乙丑'/...)
function xkLiuriPan(year, dayGZ) {
  if (typeof dayGZ !== 'string' || dayGZ.length < 1) {
    throw new Error('流日飞星: dayGZ 须为干支纪日: ' + dayGZ);
  }
  var last = dayGZ.charAt(dayGZ.length - 1);  // 取最后一位地支
  if (XK_ZHI_TO_GONG[last] === undefined) {
    throw new Error('流日飞星: 未知干支地支: ' + dayGZ);
  }
  var centerGong = XK_ZHI_TO_GONG[last];
  var centerStar = centerGong;
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var gong = XK_LUO_SHU_PATH[i];
    var star = ((centerStar - 1 + i) % 9) + 1;
    panByGong[gong] = star;
  }
  return {
    year: year,
    dayGZ: dayGZ,
    dayZhi: last,
    centerGong: centerGong,
    centerStar: centerStar,
    panByGong: panByGong,
    starName: function (gong) {
      var star = panByGong[gong];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// 替卦流日: 用日干支的地支找替星入中
function xkTiGuaLiuriPan(year, dayGZ) {
  if (typeof dayGZ !== 'string' || dayGZ.length < 1) {
    throw new Error('替卦流日飞星: dayGZ 须为干支纪日: ' + dayGZ);
  }
  var last = dayGZ.charAt(dayGZ.length - 1);
  if (XK_ZHI_TO_GONG[last] === undefined) {
    throw new Error('替卦流日飞星: 未知干支地支: ' + dayGZ);
  }
  var gong = XK_ZHI_TO_GONG[last];
  var tiStar = XK_TI_GUA[gong];
  if (!tiStar) throw new Error('替卦流日飞星: ' + gong + '宫无替星');
  var panByGong = {};
  for (var i = 0; i < 9; i++) {
    var pathGong = XK_LUO_SHU_PATH[i];
    var star = ((tiStar - 1 + i) % 9) + 1;
    panByGong[pathGong] = star;
  }
  return {
    year: year,
    dayGZ: dayGZ,
    dayZhi: last,
    tiStar: tiStar,
    centerStar: tiStar,
    panByGong: panByGong,
    starName: function (g) {
      var star = panByGong[g];
      return star + '(' + XK_STARS[star - 1].slice(2) + '/' + XK_NATURE[star - 1] + ')';
    }
  };
}

// v3.0.17: 从公历日期取日干支(用 lunar 引擎)
function xkLunarDayGZ(date) {
  var dt = date || new Date();
  var Solar = (typeof window !== 'undefined' && window.Solar)
    || (typeof window !== 'undefined' && window.LunarLib && window.LunarLib.Solar);
  if (!Solar || typeof Solar.fromYmd !== 'function') {
    throw new Error('xkLunarDayGZ: 需要 lunar 引擎(window.Solar)');
  }
  var s = Solar.fromYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  var l = s.getLunar();
  return {
    yearGZ: l.getYearInGanZhi(),
    monthGZ: l.getMonthInGanZhi(),
    dayGZ: l.getDayInGanZhi()
  };
}

window.xuankong = {
  // 算盘层
  currentYun: xkCurrentYun,
  yunPan: xkYunPan,
  mountainPan: xkMountainPan,
  facePan: xkFacePan,
  wangShanWangXiang: xkWangShanWangXiang,
  wuhuangAndErhei: xkWuhuangAndErhei,
  formatPrompt: xkFormatPrompt,
  // v3.0.14:流年/流月飞星
  liunianPan: xkLiunianPan,
  liuyuePan: xkLiuyuePan,
  liunianAndLiuyueWuhuang: xkLiunianAndLiuyueWuhuang,
  lunarMonthGZ: xkLunarMonthGZ,
  // v3.0.16:替卦
  tiGuaMountainPan: xkTiGuaMountainPan,
  tiGuaFacePan: xkTiGuaFacePan,
  TI_GUA: XK_TI_GUA,
  // v3.0.17:流日飞星
  liuriPan: xkLiuriPan,
  tiGuaLiuriPan: xkTiGuaLiuriPan,
  lunarDayGZ: xkLunarDayGZ,
  // 查表常量
  STARS: XK_STARS,
  NATURE: XK_NATURE,
  GOOD: XK_GOOD,
  LUO_SHU_PATH: XK_LUO_SHU_PATH,
  ZHI_TO_GONG: XK_ZHI_TO_GONG,
  MONTH_ZHI: XK_MONTH_ZHI,
  MONTH_CN: XK_MONTH_CN,
  dirToGuaNum: xkDirToGuaNum
};