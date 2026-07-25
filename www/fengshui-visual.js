// ========== 风水可视化 SVG 渲染 v3.0.12 ==========
// 提供 3 个函数:
//   - drawLuopan24: 罗盘 24 山向圆盘
//   - drawHouseLayout: 户型方位图(大门/主卧/客厅/厨房/书房 标 8 宫)
//   - drawJiugong: 玄空飞星九宫格(渲染 panByGong 到 9 宫 SVG)
//
// 所有函数返回 SVG 字符串, 由调用方插入 innerHTML

// 8 卦 → 角度(从正北顺时针 0° 起): 北=0, 东北=45, 东=90, ..., 西北=315
// SVG 圆周: 12 点钟方向为正北, 顺时针递增
var FS_DIR_ANGLE = {
  '北': 0, '东北': 45, '东': 90, '东南': 135,
  '南': 180, '西南': 225, '西': 270, '西北': 315
};

// 24 山向 圆周排布(地盘正针, 圆周每 15° 一山, 共 24)
// 参考 fengshui.js SHAN_24: 每卦 3 山, 顺时针分布
var FS_LUOPAN_24 = [
  { dir: '北',  shan: ['壬', '子', '癸'], nature: '水' },
  { dir: '东北', shan: ['丑', '艮', '寅'], nature: '土' },
  { dir: '东',  shan: ['甲', '卯', '乙'], nature: '木' },
  { dir: '东南', shan: ['辰', '巽', '巳'], nature: '木' },
  { dir: '南',  shan: ['丙', '午', '丁'], nature: '火' },
  { dir: '西南', shan: ['未', '坤', '申'], nature: '土' },
  { dir: '西',  shan: ['庚', '酉', '辛'], nature: '金' },
  { dir: '西北', shan: ['戌', '乾', '亥'], nature: '金' }
];

// 罗盘 24 山向圆盘 SVG
// 高亮当前坐向 doorDir
// v3.0.19: 三层罗盘叠加(地盘正针 / 天盘缝针 / 人盘中针)
//   地盘 = 内层,主"立向"
//   天盘 = 外层(左旋7.5°),主"纳水"
//   人盘 = 中层(右旋7.5°),主"消砂"
function drawLuopan24(doorDir) {
  var w = 280, h = 280;
  var cx = w / 2, cy = h / 2;
  var R_OUT = 130, R_MID = 95, R_IN = 60;
  // v3.0.19: 三层罗盘半径分配
  var R_TIAN_OUT = 130, R_TIAN_IN = 108;  // 外层(天盘) 左旋 7.5°
  var R_REN_OUT = 105, R_REN_IN = 84;    // 中层(人盘) 右旋 7.5°
  var R_DI_OUT = 80,  R_DI_IN = 60;       // 内层(地盘) 标准

  function pos(angleDeg, r) {
    // angle 0 = 正北(12 点钟), SVG 中需要 -90°
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;margin:0 auto;max-width:280px;width:100%;background:var(--bg-inner);border-radius:50%;">';

  // 三层圆环(颜色区分:外层天盘金色/中层人盘蓝色/内层地盘红色)
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_TIAN_OUT + '" fill="none" stroke="var(--accent-gold)" stroke-width="1.5"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_TIAN_IN + '" fill="none" stroke="var(--accent-gold)" stroke-width="0.5"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_REN_OUT + '" fill="none" stroke="var(--accent-blue)" stroke-width="1.2"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_REN_IN + '" fill="none" stroke="var(--accent-blue)" stroke-width="0.5"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_DI_OUT + '" fill="none" stroke="var(--accent-red)" stroke-width="1.2"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_DI_IN + '" fill="none" stroke="var(--accent-red)" stroke-width="0.5"/>';

  // 8 卦方向分隔线(3 层都有)
  for (var i = 0; i < 8; i++) {
    var angle = i * 45;
    var p1 = pos(angle, R_DI_IN);
    var p2 = pos(angle, R_TIAN_OUT);
    svg += '<line x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '" stroke="var(--border)" stroke-width="0.5"/>';
  }

  // 24 山向字(每卦 3 字, 地盘标准排布)
  // v3.1.1: 三层罗盘用 sanPan 数据(每山三盘字不同)
  for (var d = 0; d < 8; d++) {
    var dir = FS_LUOPAN_24[d].dir;
    var shans = FS_LUOPAN_24[d].shan;
    var baseAngle = d * 45;
    for (var s = 0; s < 3; s++) {
      var shanName = shans[s];
      var subAngle = baseAngle + (s - 1) * 15;  // 5° 偏移
      // 地盘正针: 内层, 标准角度
      var pDi = pos(subAngle, (R_DI_OUT + R_DI_IN) / 2);
      var isDoor = (dir === doorDir);
      var fill = isDoor ? 'var(--accent-red)' : 'var(--accent-gold)';
      var weight = isDoor ? '700' : '500';
      // v3.1.1: 用 sanPan.di(地盘字)— 多数情况 == shanName,但保留字段
      var diChar = (vis && vis.SHAN_DETAILS && vis.SHAN_DETAILS[shanName] && vis.SHAN_DETAILS[shanName].sanPan)
        ? vis.SHAN_DETAILS[shanName].sanPan.di : shanName;
      svg += '<text x="' + pDi.x.toFixed(1) + '" y="' + pDi.y.toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="' + weight + '" fill="' + fill + '" style="cursor:pointer;" onclick="window.fengshuiVisual.showShanDetail(\'' + shanName + '\')">' + diChar + '</text>';

      // v3.1.1: 天盘缝针 - 左旋 7.5°(纳水),用 sanPan.tian 字
      var tianChar = (vis && vis.SHAN_DETAILS && vis.SHAN_DETAILS[shanName] && vis.SHAN_DETAILS[shanName].sanPan)
        ? vis.SHAN_DETAILS[shanName].sanPan.tian : shanName;
      var pTian = pos(subAngle - 7.5, (R_TIAN_OUT + R_TIAN_IN) / 2);
      svg += '<text x="' + pTian.x.toFixed(1) + '" y="' + pTian.y.toFixed(1) + '" text-anchor="middle" font-size="7" fill="var(--accent-gold)" opacity="0.7">' + tianChar + '</text>';

      // v3.1.1: 人盘中针 - 右旋 7.5°(消砂),用 sanPan.ren 字
      var renChar = (vis && vis.SHAN_DETAILS && vis.SHAN_DETAILS[shanName] && vis.SHAN_DETAILS[shanName].sanPan)
        ? vis.SHAN_DETAILS[shanName].sanPan.ren : shanName;
      var pRen = pos(subAngle + 7.5, (R_REN_OUT + R_REN_IN) / 2);
      svg += '<text x="' + pRen.x.toFixed(1) + '" y="' + pRen.y.toFixed(1) + '" text-anchor="middle" font-size="7" fill="var(--accent-blue)" opacity="0.7">' + renChar + '</text>';

      // 透明命中矩形(只地盘点可点)
      svg += '<rect x="' + (pDi.x - 8).toFixed(1) + '" y="' + (pDi.y - 8).toFixed(1) + '" width="16" height="16" fill="transparent" style="cursor:pointer;" onclick="window.fengshuiVisual.showShanDetail(\'' + shanName + '\')" data-shan="' + shanName + '"/>';
    }
    // 8 卦方向大标(外圈外侧)
    var pDir = pos(baseAngle, R_TIAN_OUT + 14);
    svg += '<text x="' + pDir.x.toFixed(1) + '" y="' + pDir.y.toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-secondary)">' + dir + '</text>';
  }

  // 三层标签(图例, 在 SVG 顶部)
  svg += '<text x="' + (cx - 50) + '" y="' + 14 + '" font-size="7" fill="var(--accent-gold)">天盘·纳水</text>';
  svg += '<text x="' + (cx - 10) + '" y="' + 14 + '" font-size="7" fill="var(--accent-blue)">人盘·消砂</text>';
  svg += '<text x="' + (cx + 30) + '" y="' + 14 + '" font-size="7" fill="var(--accent-red)">地盘·立向</text>';

  // 中心: 天池 + 指针
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--accent-gold)"/>';
  svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="8" fill="#1a1612">☰</text>';

  // 大门方向指示
  if (doorDir && FS_DIR_ANGLE[doorDir] !== undefined) {
    var pDoor = pos(FS_DIR_ANGLE[doorDir], R_TIAN_OUT + 26);
    svg += '<text x="' + pDoor.x.toFixed(1) + '" y="' + pDoor.y.toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="var(--accent-red)">🚪 大门</text>';
  }

  svg += '</svg>';
  return svg;
}

// 户型方位图: 八宫定位 + 用户标记大门/主卧/客厅/厨房/书房
// options = { doorDir, mainRoomDir, sitDir?, ji?, xiong? }
function drawHouseLayout(options) {
  options = options || {};
  var w = 280, h = 280;
  var cx = w / 2, cy = h / 2;
  var R_OUT = 130;
  function pos(angleDeg, r) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // 9 宫位排布(玄空飞星常用, 但也兼容八宅)
  // 中心=5, 八个方向按洛书序: 5→6→7→8→9→1→2→3→4
  // SVG 中: 1=下, 2=西南, 3=东, 4=东南, 5=中, 6=西北, 7=西, 8=东北, 9=南
  var JIUGONG_POS = {
    1: pos(180, R_OUT * 0.75),  // 下(北)
    2: pos(225, R_OUT * 0.75),
    3: pos(135, R_OUT * 0.75),
    4: pos(45, R_OUT * 0.75),
    5: { x: cx, y: cy },          // 中
    6: pos(315, R_OUT * 0.75),
    7: pos(270, R_OUT * 0.75),    // 西
    8: pos(0, R_OUT * 0.75),       // 东北(实际为 1 宫方向, 北略偏东)
    9: pos(90, R_OUT * 0.75)       // 南(实际偏东, 简化为上)
  };

  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;margin:0 auto;max-width:280px;width:100%;">';

  // 大圆
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_OUT + '" fill="var(--bg-inner)" stroke="var(--border)" stroke-width="1.5"/>';

  // 8 卦方位标
  var dirs8 = [
    { dir: '北', angle: 0 },
    { dir: '东北', angle: 45 },
    { dir: '东', angle: 90 },
    { dir: '东南', angle: 135 },
    { dir: '南', angle: 180 },
    { dir: '西南', angle: 225 },
    { dir: '西', angle: 270 },
    { dir: '西北', angle: 315 }
  ];
  dirs8.forEach(function (d) {
    var p = pos(d.angle, R_OUT + 14);
    svg += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text-secondary)">' + d.dir + '</text>';
  });

  // 大门(高亮圆点 + 标签)
  if (options.doorDir && FS_DIR_ANGLE[options.doorDir] !== undefined) {
    var pd = pos(FS_DIR_ANGLE[options.doorDir], R_OUT * 0.85);
    svg += '<circle cx="' + pd.x.toFixed(1) + '" cy="' + pd.y.toFixed(1) + '" r="14" fill="rgba(220,80,80,0.2)" stroke="var(--accent-red)" stroke-width="2"/>';
    svg += '<text x="' + pd.x.toFixed(1) + '" y="' + (pd.y + 4).toFixed(1) + '" text-anchor="middle" font-size="14">🚪</text>';
  }

  // 主卧(床 icon)
  if (options.mainRoomDir && FS_DIR_ANGLE[options.mainRoomDir] !== undefined) {
    var pm = pos(FS_DIR_ANGLE[options.mainRoomDir], R_OUT * 0.65);
    svg += '<circle cx="' + pm.x.toFixed(1) + '" cy="' + pm.y.toFixed(1) + '" r="12" fill="rgba(120,180,120,0.2)" stroke="var(--accent-green)" stroke-width="2"/>';
    svg += '<text x="' + pm.x.toFixed(1) + '" y="' + (pm.y + 4).toFixed(1) + '" text-anchor="middle" font-size="12">🛏</text>';
  }

  // 八宅吉凶标(若传 ji/xiong)
  if (options.ji && options.xiong) {
    Object.keys(options.ji).forEach(function (k) {
      var dir = options.ji[k];
      if (FS_DIR_ANGLE[dir] === undefined) return;
      var p = pos(FS_DIR_ANGLE[dir], R_OUT * 0.45);
      var color = k === '伏位' ? 'var(--accent-gold)' : 'var(--accent-green)';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + color + '">' + k + '</text>';
    });
    Object.keys(options.xiong).forEach(function (k) {
      var dir = options.xiong[k];
      if (FS_DIR_ANGLE[dir] === undefined) return;
      var p = pos(FS_DIR_ANGLE[dir], R_OUT * 0.3);
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--accent-red)">' + k + '</text>';
    });
  }

  // 中心提示
  svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">户型方位</text>';

  // 图例
  svg += '<text x="' + cx + '" y="' + (h - 4) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">🚪 大门  🛏 主卧  吉位(绿)/凶位(红)</text>';

  svg += '</svg>';
  return svg;
}

// 玄空飞星九宫格
// panByGong: { 1: star, ..., 9: star } 或 panByGong: { '1': ..., '9': ... }
// yunName: 运盘入中星描述, 用于标题
function drawJiugong(panByGong, yunName) {
  var w = 280, h = 280;
  var cx = w / 2, cy = h / 2;
  // 9 宫布局(井字 3x3): 中5在中央
  // 7 8 9(上排: 西 东北 南)
  // 4 5 6(中排: 东南 中 西北)
  // 1 2 3(下排: 北 西南 东)
  var cellW = (w - 40) / 3;
  var cellH = (h - 60) / 3;
  var x0 = 20, y0 = 30;

  function cell(g, x, y) {
    var star = panByGong[g] || panByGong[String(g)];
    if (!star) return '';
    var isJi = star === 1 || star === 6 || star === 8 || star === 9;
    var isWu = star === 5;
    var isEr = star === 2;
    var color = isWu ? 'var(--accent-red)' : (isEr ? 'var(--accent-red)' : (isJi ? 'var(--accent-green)' : 'var(--text-primary)'));
    var bg = isWu ? 'rgba(220,80,80,0.2)' : (isEr ? 'rgba(220,80,80,0.08)' : (isJi ? 'rgba(120,180,120,0.1)' : 'var(--bg-inner)'));
    // v3.0.13: 整格可点击,onclick 调用 showStarDetail
    var html = '<g style="cursor:pointer;" onclick="window.fengshuiVisual.showStarDetail(' + star + ')">';
    html += '<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="' + bg + '" stroke="var(--border)" stroke-width="0.5"/>';
    html += '<text x="' + (x + 6) + '" y="' + (y + 12) + '" font-size="9" fill="var(--text-muted)">' + g + '宫</text>';
    html += '<text x="' + (x + cellW / 2) + '" y="' + (y + cellH / 2 + 6) + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + color + '">' + star + '</text>';
    html += '</g>';
    return html;
  }

  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;margin:0 auto;max-width:280px;width:100%;">';

  // 标题
  if (yunName) {
    svg += '<text x="' + cx + '" y="' + 16 + '" text-anchor="middle" font-size="11" fill="var(--accent-gold)">玄空九宫 · ' + yunName + ' 入中</text>';
  }

  // 上排: 7 8 9
  svg += cell(7, x0, y0);
  svg += cell(8, x0 + cellW, y0);
  svg += cell(9, x0 + cellW * 2, y0);
  // 中排: 4 5 6
  svg += cell(4, x0, y0 + cellH);
  svg += cell(5, x0 + cellW, y0 + cellH);
  svg += cell(6, x0 + cellW * 2, y0 + cellH);
  // 下排: 1 2 3
  svg += cell(1, x0, y0 + cellH * 2);
  svg += cell(2, x0 + cellW, y0 + cellH * 2);
  svg += cell(3, x0 + cellW * 2, y0 + cellH * 2);

  svg += '</svg>';
  return svg;
}

// ============ v3.0.13: 24 山简表 + 9 星简表 + 详情 modal ============

// 24 山简表(地盘正针): 五行/纳音/简述/吉凶
// 来源: 传统罗盘基础 + KB fengshui_base_kb + fengshui_luopan_kb 综合
// v3.1.1: 加 sanPan(人盘+天盘)字段 — 72 龙简化(每山带 3 盘数据)
//   renZhong(人盘中针,消砂) + tianPan(天盘缝针,纳水) — 业内各派字不同,
//   本轮取常见派别(沈氏玄空 + 三合派 兼用),以五行为主
var FS_SHAN_DETAILS = {
  '壬': { wuxing: '水', nayin: '癸山', jiXiong: '阳水',
    sanPan: { di: '壬', ren: '子', tian: '天壬' },
    desc: '壬山为天干阳水,五行属水,主智谋、流动性。', use: '宜水景/动位/通道' },
  '子': { wuxing: '水', nayin: '壬山', jiXiong: '阳水',
    sanPan: { di: '子', ren: '癸', tian: '缝壬' },
    desc: '子山为地支阳水,正北方,主暗动、潜伏。', use: '宜静不宜动,可放鱼缸/水种' },
  '癸': { wuxing: '水', nayin: '辛山', jiXiong: '阴水',
    sanPan: { di: '癸', ren: '壬', tian: '缝子' },
    desc: '癸山为天干阴水,主收敛、内向。', use: '宜暗色/封闭空间' },
  '丑': { wuxing: '土', nayin: '丁山', jiXiong: '阴土',
    sanPan: { di: '丑', ren: '艮', tian: '缝艮' },
    desc: '丑山为地支阴土,东北偏北,主厚重、收藏。', use: '宜储藏室/杂物间' },
  '艮': { wuxing: '土', nayin: '丙山', jiXiong: '阳土',
    sanPan: { di: '艮', ren: '丑', tian: '缝丁' },
    desc: '艮山为八卦阳土,主止、稳、青少年。', use: '宜书房/子女房' },
  '寅': { wuxing: '木', nayin: '庚山', jiXiong: '阳木',
    sanPan: { di: '寅', ren: '甲', tian: '缝庚' },
    desc: '寅山为地支阳木,东北偏东,主生发、动。', use: '宜运动/早起步' },
  '甲': { wuxing: '木', nayin: '丁山', jiXiong: '阳木',
    sanPan: { di: '甲', ren: '寅', tian: '缝寅' },
    desc: '甲山为天干阳木,正东,主高大、首领。', use: '宜主梁/主柱/书桌向' },
  '卯': { wuxing: '木', nayin: '乙山', jiXiong: '阴木',
    sanPan: { di: '卯', ren: '乙', tian: '缝甲' },
    desc: '卯山为地支阴木,正东偏南,主柔美、文昌。', use: '宜文昌位/学业' },
  '乙': { wuxing: '木', nayin: '癸山', jiXiong: '阴木',
    sanPan: { di: '乙', ren: '卯', tian: '缝乙' },
    desc: '乙山为天干阴木,主花草、柔顺。', use: '宜花草/玄关' },
  '辰': { wuxing: '土', nayin: '壬山', jiXiong: '阳土',
    sanPan: { di: '辰', ren: '巽', tian: '缝巽' },
    desc: '辰山为地支阳土,东南偏东,主水库、聚财。', use: '宜鱼缸/水景' },
  '巽': { wuxing: '木', nayin: '辛山', jiXiong: '阴木',
    sanPan: { di: '巽', ren: '辰', tian: '缝辰' },
    desc: '巽山为八卦阴木,主文曲、长女、利学业。', use: '宜文昌位/书房' },
  '巳': { wuxing: '火', nayin: '庚山', jiXiong: '阴火',
    sanPan: { di: '巳', ren: '丙', tian: '缝丙' },
    desc: '巳山为地支阴火,东南偏南,主文明、礼仪。', use: '宜厅堂/待客' },
  '丙': { wuxing: '火', nayin: '己山', jiXiong: '阳火',
    sanPan: { di: '丙', ren: '巳', tian: '缝巳' },
    desc: '丙山为天干阳火,正南,主文明、礼仪、名声。', use: '宜主厅/采光/灯火' },
  '午': { wuxing: '火', nayin: '丁山', jiXiong: '阳火',
    sanPan: { di: '午', ren: '丁', tian: '缝午' },
    desc: '午山为地支阳火,正南偏西,主大礼、礼堂。', use: '宜采光/红灯笼' },
  '丁': { wuxing: '火', nayin: '壬山', jiXiong: '阴火',
    sanPan: { di: '丁', ren: '午', tian: '缝丁' },
    desc: '丁山为天干阴火,主文昌、礼花。', use: '宜香薰/灯火/文昌' },
  '未': { wuxing: '土', nayin: '癸山', jiXiong: '阴土',
    sanPan: { di: '未', ren: '坤', tian: '缝坤' },
    desc: '未山为地支阴土,西南偏南,主花园、情义。', use: '宜花园/客厅' },
  '坤': { wuxing: '土', nayin: '甲山', jiXiong: '阴土',
    sanPan: { di: '坤', ren: '未', tian: '缝未' },
    desc: '坤山为八卦阴土,主柔、母、主妇。', use: '宜主卧(女主人)/餐厅' },
  '申': { wuxing: '金', nayin: '乙山', jiXiong: '阳金',
    sanPan: { di: '申', ren: '庚', tian: '缝庚' },
    desc: '申山为地支阳金,西南偏西,主刀兵、肃杀。', use: '宜刀具/金属器械' },
  '庚': { wuxing: '金', nayin: '丙山', jiXiong: '阳金',
    sanPan: { di: '庚', ren: '申', tian: '缝辛' },
    desc: '庚山为天干阳金,正西,主刚、武。', use: '宜大型金属/车房' },
  '酉': { wuxing: '金', nayin: '丁山', jiXiong: '阴金',
    sanPan: { di: '酉', ren: '辛', tian: '缝庚' },
    desc: '酉山为地支阴金,正西偏北,主珠宝、首饰。', use: '宜珠宝/首饰盒' },
  '辛': { wuxing: '金', nayin: '戊山', jiXiong: '阴金',
    sanPan: { di: '辛', ren: '酉', tian: '缝酉' },
    desc: '辛山为天干阴金,主小金属、颗粒。', use: '宜小金属饰物' },
  '戌': { wuxing: '土', nayin: '己山', jiXiong: '阳土',
    sanPan: { di: '戌', ren: '乾', tian: '缝乾' },
    desc: '戌山为地支阳土,西北偏西,主收藏、库房。', use: '宜储藏/酒窖' },
  '乾': { wuxing: '金', nayin: '甲山', jiXiong: '阳金',
    sanPan: { di: '乾', ren: '戌', tian: '缝戌' },
    desc: '乾山为八卦阳金,主天、父、首创。', use: '宜主卧(男主人)/书房' },
  '亥': { wuxing: '水', nayin: '壬山', jiXiong: '阴水',
    sanPan: { di: '亥', ren: '壬', tian: '缝亥' },
    desc: '亥山为地支阴水,西北偏北,主收藏、终结。', use: '宜静室/收尾' }
};

// 9 星简表: 五行/特性/吉凶/化解
var FS_STAR_DETAILS = {
  1: { name: '一白贪狼', wuxing: '水', jiXiong: '吉', desc: '桃花/智慧/官运。', apply: '利读书、考试、升职、人缘。', huaJie: '无需化解,可适度催旺(放水种/水晶)' },
  2: { name: '二黑巨门', wuxing: '土', jiXiong: '凶', desc: '病符/孕妇/腹部疾病。', apply: '主疾病、流产、不利孕妇。', huaJie: '铜器/六帝钱/灰色地毯/避免红色黄色' },
  3: { name: '三碧禄存', wuxing: '木', jiXiong: '凶', desc: '是非/口舌/官非。', apply: '主争执、诉讼、争吵。', huaJie: '红色物品/火土通关/避免绿色' },
  4: { name: '四绿文曲', wuxing: '木', jiXiong: '平', desc: '文昌/学业/桃花(中性偏吉)。', apply: '利读书、考试、文艺。', huaJie: '可适度催旺(文昌塔/四支笔);不宜过度催动' },
  5: { name: '五黄廉贞', wuxing: '土', jiXiong: '大凶', desc: '大煞/至毒/病灾。', apply: '最凶之星,所到之处宜静不宜动。', huaJie: '铜铃/铜葫芦/灰色地毯/避免动土/避免红色黄色' },
  6: { name: '六白武曲', wuxing: '金', jiXiong: '吉', desc: '偏财/权威/武贵。', apply: '利偏财、权威、决断。', huaJie: '可适度催旺(金属/水晶球);无大碍' },
  7: { name: '七赤破军', wuxing: '金', jiXiong: '凶', desc: '破财/口舌/桃花劫。', apply: '主破财、纠纷、桃花劫。', huaJie: '红色/火通关/避免放金属/远离炉灶' },
  8: { name: '八白左辅', wuxing: '土', jiXiong: '吉', desc: '财帛/丁财/旺气。', apply: '利正财、人丁、家业。', huaJie: '可适度催旺(财神位/黄色物品)' },
  9: { name: '九紫右弼', wuxing: '火', jiXiong: '吉', desc: '喜气/桃花/姻缘/文昌。', apply: '利喜事、姻缘、子女、文昌。', huaJie: '可适度催旺(红花/紫水晶/灯具);避免黑色' }
};

// 详情 modal HTML(返回后由 app/fengshui.js 注入 #fengshuiModal)
// type: 'shan' | 'star', data: 详情对象
function renderDetailModal(type, data) {
  var html = '<div style="background:var(--bg-card);padding:1rem;border-radius:8px;max-width:480px;margin:0 auto;">';
  if (type === 'shan') {
    html += '<h3 style="color:var(--accent-gold);margin-top:0;">🧭 24 山 · ' + data.shan + ' 山</h3>';
    html += '<div style="font-size:0.85rem;line-height:1.7;color:var(--text-secondary);">';
    html += '<div><strong>五行：</strong>' + data.wuxing + '</div>';
    html += '<div><strong>纳音：</strong>' + data.nayin + '</div>';
    html += '<div><strong>阴阳：</strong>' + data.jiXiong + '</div>';
    html += '<div style="margin-top:0.5rem;">' + data.desc + '</div>';
    html += '<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-inner);border-left:3px solid var(--accent-gold);border-radius:4px;">';
    html += '<strong>💡 应用：</strong>' + data.use;
    html += '</div>';
    html += '</div>';
  } else if (type === 'star') {
    var color = data.jiXiong === '吉' ? 'var(--accent-green)' : (data.jiXiong === '大凶' ? 'var(--accent-red)' : 'var(--accent-gold)');
    html += '<h3 style="color:' + color + ';margin-top:0;">⭐ 玄空九星 · ' + data.name + '</h3>';
    html += '<div style="font-size:0.85rem;line-height:1.7;color:var(--text-secondary);">';
    html += '<div><strong>五行：</strong>' + data.wuxing + '</div>';
    html += '<div><strong>吉凶：</strong><span style="color:' + color + ';">' + data.jiXiong + '</span></div>';
    html += '<div style="margin-top:0.5rem;">' + data.desc + '</div>';
    html += '<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:var(--bg-inner);border-left:3px solid var(--accent-gold);border-radius:4px;">';
    html += '<strong>💡 应用：</strong>' + data.apply;
    html += '</div>';
    html += '<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(220,80,80,0.08);border-left:3px solid var(--accent-red);border-radius:4px;">';
    html += '<strong>🛡 化解：</strong>' + data.huaJie;
    html += '</div>';
    html += '</div>';
  }
  html += '<div style="text-align:center;margin-top:0.8rem;">';
  html += '<button class="divine-btn" onclick="closeFengshuiModal()" style="background:var(--bg-secondary);color:var(--text-primary);">关闭</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

function showShanDetail(shan) {
  var data = FS_SHAN_DETAILS[shan];
  if (!data) { data = { shan: shan, wuxing: '?', nayin: '?', jiXiong: '?', desc: '该山数据待补充', use: '可参考相邻山' }; }
  else { data = Object.assign({ shan: shan }, data); }
  openFengshuiModal(renderDetailModal('shan', data));
}
function showStarDetail(star) {
  var data = FS_STAR_DETAILS[star];
  if (!data) { data = { name: star + '星', wuxing: '?', jiXiong: '?', desc: '数据待补充', apply: '', huaJie: '' }; }
  openFengshuiModal(renderDetailModal('star', data));
}

function openFengshuiModal(htmlContent) {
  var modal = document.getElementById('fengshuiModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'fengshuiModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = '<div style="width:100%;max-width:520px;">' + htmlContent + '</div>';
    document.body.appendChild(modal);
    // 背景点击关闭
    modal.addEventListener('click', function (e) { if (e.target === modal) window.closeFengshuiModal(); });
  } else {
    modal.innerHTML = '<div style="width:100%;max-width:520px;">' + htmlContent + '</div>';
    modal.style.display = 'flex';
  }
}
function closeFengshuiModal() {
  var modal = document.getElementById('fengshuiModal');
  if (modal) modal.style.display = 'none';
}

// ============ v3.1.3 大六壬 SVG 渲染 ============
// 12 天将颜色(简化:吉/中性/凶分色)
var DLR_JIANG_COLORS = {
  '贵人': '#2a7', '螣蛇': '#a37', '朱雀': '#d44', '六合': '#2a7',
  '勾陈': '#888', '青龙': '#2a7', '天空': '#888', '白虎': '#d44',
  '太常': '#888', '玄武': '#d44', '太阴': '#2a7', '天后': '#888'
};

// ============ v3.1.6 大六壬九宗门课式数据 ============
// 九宗门口诀(传统六壬学标准, 联网核实 2026-07):
//   [1] 贼克法: 上神克下神取上神(元首课); 下贼上取被贼者(重审课)
//   [2] 比用法: 多克者取与日干比和者
//   [3] 涉害法: 从本家数至临宫计受克数, 等深取孟仲季, 复等刚柔
//   [4] 遥克法: 四课无克号为遥, 蒿矢(神克日)/ 弹射(日克神)
//   [5] 昴星法: 四课全备无克取阳星, 阴柔取干合上神
//   [6] 别责法: 八课四课三课或二课, 干支前一位别立三传
//   [7] 八专法: 干支同位(甲寅/丁未/己未/庚申/癸丑五日)
//   [8] 伏吟法: 月将=占时, 诸神归本位
//   [9] 返吟法: 月将冲占时, 天地盘相冲
// 取不出三传 → 显式报错(见 www/daliuren.js 实现)
var DLR_ZONGMEN_DETAILS = {
  '贼克法': { name: '贼克课', desc: '上神克下神 → 元首课(吉); 下贼上 → 重审课(凶)', color: '#d44', meaning: '冲突/克制的起始,主事件爆发点' },
  '比用法': { name: '比用课', desc: '多克者取与日干比和者(同类相聚)', color: '#2a7', meaning: '同类相聚,主事件可与人协商/合作' },
  '涉害法': { name: '涉害课', desc: '从本家数至临宫计受克数, 等深取孟仲季, 复等刚柔', color: '#888', meaning: '审时度势, 看事件受损/受阻程度' },
  '遥克法': { name: '遥克课', desc: '四课无克号为遥, 蒿矢(神克日)/ 弹射(日克神)', color: '#d44', meaning: '隔空相冲, 主暗中阻力/远距离变故' },
  '昴星法': { name: '昴星课', desc: '四课全备无克取阳星, 阴柔取干合上神', color: '#a37', meaning: '无物时借力, 主意外助力/贵人' },
  '别责法': { name: '别责课', desc: '八课四课三课或二课, 干支前一位别立三传', color: '#888', meaning: '时机未到, 主延迟/调整' },
  '八专法': { name: '八专课', desc: '干支同位(甲寅/丁未/己未/庚申/癸丑五日)', color: '#d44', meaning: '干支合一, 主自我意识强/专断' },
  '伏吟法': { name: '伏吟课', desc: '月将=占时, 诸神归本位', color: '#888', meaning: '静止守中, 主事体无变化/守旧' },
  '返吟法': { name: '返吟课', desc: '月将冲占时, 天地盘相冲', color: '#d44', meaning: '相冲动, 主事体翻覆/反复/有克变吉' }
};

// 大六壬干支神煞(简化版, 只保留主要神煞)
// 用于 v3.1.6 渲染神煞表
// 13 神煞: 天乙贵人 + 十二长生(长生/沐浴/冠带/临官/帝旺/衰/病/死/墓/绝/胎/养)
// 简化: 每干一样, 不再区分阳顺阴逆(传统阴干长生起点不同,需十二宫对齐;本轮只做主要神煞提示)
var DLR_GAN_SHA = {};
['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].forEach(function (g) {
  DLR_GAN_SHA[g] = ['天乙贵人','长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
});

// 九宗门课式展开渲染(SVG)
function drawDaliurenZongmen(pan) {
  if (!pan || !pan.faYong) return '<div style="color:var(--text-muted);">无发用数据</div>';
  var zongmen = pan.faYong.zongmen;
  var keti = pan.faYong.keti;
  var detail = DLR_ZONGMEN_DETAILS[zongmen] || { name: zongmen, desc: '无详情', color: '#888', meaning: '数据待补充' };
  var w = 280;
  var svg = '<svg viewBox="0 0 ' + w + ' 110" style="display:block;margin:0 auto;max-width:280px;width:100%;">';
  svg += '<rect x="10" y="5" width="260" height="100" fill="' + detail.color.replace('#','rgba(0,0,0,0.05)') + '" stroke="' + detail.color + '" stroke-width="1.5" rx="6"/>';
  // 宗门名
  svg += '<text x="' + (w/2) + '" y="30" text-anchor="middle" font-size="14" font-weight="700" fill="' + detail.color + '">' + detail.name + '(' + zongmen + ')</text>';
  // 课体
  svg += '<text x="' + (w/2) + '" y="50" text-anchor="middle" font-size="10" fill="var(--accent-gold)">' + keti + '</text>';
  // 描述
  svg += '<text x="' + (w/2) + '" y="70" text-anchor="middle" font-size="9" fill="var(--text-secondary)">' + detail.desc + '</text>';
  // 意义
  svg += '<text x="' + (w/2) + '" y="90" text-anchor="middle" font-size="8" fill="var(--text-muted)">💡 ' + detail.meaning + '</text>';
  svg += '</svg>';
  return svg;
}

// 干支神煞表(渲染日干对应的 12 宫神煞)
function drawDaliurenGanSha(pan) {
  if (!pan || !pan.dayGan) return '<div style="color:var(--text-muted);">无日干数据</div>';
  var shaList = DLR_GAN_SHA[pan.dayGan];
  if (!shaList) return '<div style="color:var(--text-muted);">日干 ' + pan.dayGan + ' 无对应神煞表</div>';
  var w = 280;
  var svg = '<svg viewBox="0 0 ' + w + ' 60" style="display:block;margin:0 auto;max-width:280px;width:100%;">';
  // 简化: 横向 12 格(只标重要的 4 个:天乙贵人/长生/临官/帝旺)
  var keyIdx = { '天乙贵人': 0, '长生': 1, '临官': 3, '帝旺': 4 };
  var cells = [];
  for (var i = 0; i < 12; i++) {
    var sha = shaList[i] || '';
    var isKey = (sha === '天乙贵人' || sha === '长生' || sha === '临官' || sha === '帝旺');
    var color = isKey ? 'var(--accent-gold)' : 'var(--text-muted)';
    var x = 10 + i * 22;
    svg += '<rect x="' + x + '" y="10" width="20" height="40" fill="' + (isKey ? 'rgba(201,168,76,0.1)' : 'transparent') + '" stroke="' + color + '" stroke-width="0.5" rx="2"/>';
    svg += '<text x="' + (x + 10) + '" y="30" text-anchor="middle" font-size="8" fill="' + color + '">' + sha + '</text>';
  }
  svg += '</svg>';
  return svg;
}

// 四课 SVG: 4 列卡(第一/二/三/四课),每列上神/下神/天将
function drawDaliurenSike(pan) {
  if (!pan || !pan.siKe) return '<div style="color:var(--text-muted);">无四课数据</div>';
  var w = 320, cardH = 100, cardW = 72;
  var svg = '<svg viewBox="0 0 ' + w + ' ' + (cardH + 10) + '" style="display:block;margin:0 auto;max-width:320px;width:100%;">';
  var x0 = 8;
  for (var i = 0; i < pan.siKe.length; i++) {
    var k = pan.siKe[i];
    var x = x0 + i * (cardW + 4);
    var bg = '#f9f9f9';
    svg += '<rect x="' + x + '" y="5" width="' + cardW + '" height="' + cardH + '" fill="' + bg + '" stroke="var(--accent-gold)" stroke-width="1" rx="4"/>';
    svg += '<text x="' + (x + cardW/2) + '" y="20" text-anchor="middle" font-size="10" fill="var(--text-muted)">第' + k.idx + '课</text>';
    // 上神(大字)
    svg += '<text x="' + (x + cardW/2) + '" y="50" text-anchor="middle" font-size="22" font-weight="700" fill="var(--accent-gold)">' + k.shang + '</text>';
    // 下神(小字)
    svg += '<text x="' + (x + cardW/2) + '" y="68" text-anchor="middle" font-size="9" fill="var(--text-secondary)">' + k.xia + '上</text>';
    // 天将(底部)
    var jiangColor = DLR_JIANG_COLORS[k.shangJiang] || '#888';
    svg += '<text x="' + (x + cardW/2) + '" y="88" text-anchor="middle" font-size="9" font-weight="600" fill="' + jiangColor + '">' + k.shangJiang + '</text>';
  }
  svg += '</svg>';
  return svg;
}

// 三传 SVG: 3 列卡(初/中/末),含天将+遁干
function drawDaliurenSanChuan(pan) {
  if (!pan || !pan.sanChuan) return '<div style="color:var(--text-muted);">无三传数据</div>';
  var w = 240, cardH = 80, cardW = 72;
  var svg = '<svg viewBox="0 0 ' + w + ' ' + (cardH + 10) + '" style="display:block;margin:0 auto;max-width:240px;width:100%;">';
  var names = ['初传', '中传', '末传'];
  for (var i = 0; i < pan.sanChuan.length; i++) {
    var c = pan.sanChuan[i];
    var x = 8 + i * (cardW + 4);
    svg += '<rect x="' + x + '" y="5" width="' + cardW + '" height="' + cardH + '" fill="#fff8e1" stroke="var(--accent-red)" stroke-width="1" rx="4"/>';
    svg += '<text x="' + (x + cardW/2) + '" y="20" text-anchor="middle" font-size="10" fill="var(--text-muted)">' + names[i] + '</text>';
    svg += '<text x="' + (x + cardW/2) + '" y="48" text-anchor="middle" font-size="22" font-weight="700" fill="var(--accent-red)">' + c.shen + '</text>';
    var jiangColor = DLR_JIANG_COLORS[c.jiang] || '#888';
    var dunGanText = c.dunGan ? ' 遁' + c.dunGan : '';
    svg += '<text x="' + (x + cardW/2) + '" y="68" text-anchor="middle" font-size="8" fill="' + jiangColor + '">' + c.jiang + dunGanText + '</text>';
  }
  svg += '</svg>';
  return svg;
}

// 天盘 SVG: 12 地支外圈 + 12 宫(地盘) + 天将 标注
// 简化版: 12 宫轮盘,每格标"地盘+天盘+天将"
function drawDaliurenTianPan(pan) {
  if (!pan || !pan.tianPan || !pan.tianJiang) return '<div style="color:var(--text-muted);">无天盘数据</div>';
  var w = 320, h = 320, cx = w/2, cy = h/2;
  var R = 130;
  // 12 地支从正北顺时针: 子丑寅卯辰巳午未申酉戌亥
  var zhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  // 角度: 子=0, 丑=30, 寅=60... 顺时针
  function pos(angleDeg, r) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;margin:0 auto;max-width:320px;width:100%;background:var(--bg-inner);border-radius:50%;">';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--accent-gold)" stroke-width="2"/>';
  // 12 宫分隔线
  for (var i = 0; i < 12; i++) {
    var a1 = pos(i * 30, 0);
    var a2 = pos(i * 30, R);
    svg += '<line x1="' + a1.x.toFixed(1) + '" y1="' + a1.y.toFixed(1) + '" x2="' + a2.x.toFixed(1) + '" y2="' + a2.y.toFixed(1) + '" stroke="var(--border)" stroke-width="0.5"/>';
  }
  // 每宫标: 地盘(大)+ 天盘(中)+ 天将(小)
  for (var j = 0; j < 12; j++) {
    var diZhi = zhi[j];
    var tianZhi = pan.tianPan[diZhi];
    var jiang = pan.tianJiang[diZhi] || '';
    var jiangColor = DLR_JIANG_COLORS[jiang] || '#888';
    var angle = j * 30;
    // 地盘 (大字, 中)
    var p1 = pos(angle, R * 0.45);
    svg += '<text x="' + p1.x.toFixed(1) + '" y="' + p1.y.toFixed(1) + '" text-anchor="middle" font-size="20" font-weight="700" fill="var(--accent-gold)">' + diZhi + '</text>';
    // 天盘 (中字)
    var p2 = pos(angle, R * 0.7);
    svg += '<text x="' + p2.x.toFixed(1) + '" y="' + p2.y.toFixed(1) + '" text-anchor="middle" font-size="14" fill="var(--text-secondary)">' + tianZhi + '</text>';
    // 天将 (小字, 圈外)
    var p3 = pos(angle, R * 0.88);
    svg += '<text x="' + p3.x.toFixed(1) + '" y="' + p3.y.toFixed(1) + '" text-anchor="middle" font-size="8" fill="' + jiangColor + '">' + jiang + '</text>';
  }
  // 中心提示
  svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">天盘·地盘·天将</text>';
  svg += '</svg>';
  return svg;
}

window.fengshuiVisual = {
  drawLuopan24: drawLuopan24,
  drawHouseLayout: drawHouseLayout,
  drawJiugong: drawJiugong,
  // v3.1.3:大六壬排盘 SVG
  drawDaliurenSike: drawDaliurenSike,
  drawDaliurenSanChuan: drawDaliurenSanChuan,
  drawDaliurenTianPan: drawDaliurenTianPan,
  // v3.1.6:九宗门 + 神煞
  drawDaliurenZongmen: drawDaliurenZongmen,
  drawDaliurenGanSha: drawDaliurenGanSha,
  // v3.0.13:详情
  showShanDetail: showShanDetail,
  showStarDetail: showStarDetail,
  openFengshuiModal: openFengshuiModal,
  closeFengshuiModal: closeFengshuiModal,
  // 数据暴露给测试
  SHAN_DETAILS: FS_SHAN_DETAILS,
  STAR_DETAILS: FS_STAR_DETAILS,
  DLR_JIANG_COLORS: DLR_JIANG_COLORS,
  DLR_ZONGMEN_DETAILS: DLR_ZONGMEN_DETAILS,
  DLR_GAN_SHA: DLR_GAN_SHA,
  DIR_ANGLE: FS_DIR_ANGLE,
  LUOPAN_24: FS_LUOPAN_24
};