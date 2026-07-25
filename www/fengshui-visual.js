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
function drawLuopan24(doorDir) {
  var w = 280, h = 280;
  var cx = w / 2, cy = h / 2;
  var R_OUT = 130, R_MID = 95, R_IN = 60;

  function pos(angleDeg, r) {
    // angle 0 = 正北(12 点钟), SVG 中需要 -90°
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;margin:0 auto;max-width:280px;width:100%;background:var(--bg-inner);border-radius:50%;">';

  // 三层圆环
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_OUT + '" fill="none" stroke="var(--accent-gold)" stroke-width="2"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_MID + '" fill="none" stroke="var(--border)" stroke-width="1"/>';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R_IN + '" fill="none" stroke="var(--border)" stroke-width="1"/>';

  // 8 卦方向分隔线
  for (var i = 0; i < 8; i++) {
    var angle = i * 45;
    var p1 = pos(angle, R_IN);
    var p2 = pos(angle, R_OUT);
    svg += '<line x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '" stroke="var(--border)" stroke-width="0.5"/>';
  }

  // 24 山向字(每卦 3 字, 等分)
  for (var d = 0; d < 8; d++) {
    var dir = FS_LUOPAN_24[d].dir;
    var shans = FS_LUOPAN_24[d].shan;
    var baseAngle = d * 45;
    for (var s = 0; s < 3; s++) {
      var subAngle = baseAngle + (s - 1) * 15;  // 5° 偏移
      var p = pos(subAngle, R_MID + (R_OUT - R_MID) / 2);
      var isDoor = (dir === doorDir);
      var fill = isDoor ? 'var(--accent-red)' : 'var(--accent-gold)';
      var weight = isDoor ? '700' : '500';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="' + weight + '" fill="' + fill + '">' + shans[s] + '</text>';
    }
    // 8 卦方向大标(外圈)
    var pDir = pos(baseAngle, R_OUT + 14);
    svg += '<text x="' + pDir.x.toFixed(1) + '" y="' + pDir.y.toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-secondary)">' + dir + '</text>';
  }

  // 中心: 天池 + 指针
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--accent-gold)"/>';
  svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" font-size="8" fill="#1a1612">☰</text>';

  // 24 山向总环注
  svg += '<text x="' + cx + '" y="' + (h - 6) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">24 山向圆盘 · 地盘正针</text>';

  // 大门方向指示
  if (doorDir && FS_DIR_ANGLE[doorDir] !== undefined) {
    var pDoor = pos(FS_DIR_ANGLE[doorDir], R_OUT + 26);
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
    var html = '<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" fill="' + bg + '" stroke="var(--border)" stroke-width="0.5"/>';
    html += '<text x="' + (x + 6) + '" y="' + (y + 12) + '" font-size="9" fill="var(--text-muted)">' + g + '宫</text>';
    html += '<text x="' + (x + cellW / 2) + '" y="' + (y + cellH / 2 + 6) + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + color + '">' + star + '</text>';
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

// 暴露
window.fengshuiVisual = {
  drawLuopan24: drawLuopan24,
  drawHouseLayout: drawHouseLayout,
  drawJiugong: drawJiugong,
  // helper 暴露给测试
  DIR_ANGLE: FS_DIR_ANGLE,
  LUOPAN_24: FS_LUOPAN_24
};