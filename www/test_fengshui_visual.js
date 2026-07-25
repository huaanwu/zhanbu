/**
 * test_fengshui_visual.js (v3.0.12)
 *
 * SVG 可视化接线检查:
 *   - drawLuopan24 返回 SVG 字符串, 含 24 山字
 *   - drawHouseLayout 返回 SVG, 含大门/主卧/吉凶位
 *   - drawJiugong 9 宫 SVG, 五黄/二黑高亮
 *   - app/fengshui.js 排盘结果含 SVG 字符串
 *   - index.html 加载 fengshui-visual.js
 *
 * 跑法: node www/test_fengshui_visual.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

console.log('\n========================================');
console.log('   风水 SVG 可视化测试 (v3.0.12)');
console.log('========================================');

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('  [OK] ' + name); PASS++; }
  catch (e) { console.log('  [FAIL] ' + name + ' — ' + e.message); FAIL++; }
}

// Stub + 加载算盘层 + 视觉层
globalThis.window = {};
eval(fs.readFileSync('fengshui.js', 'utf-8'));
eval(fs.readFileSync('xuankong.js', 'utf-8'));
eval(fs.readFileSync('fengshui-visual.js', 'utf-8'));
const vis = globalThis.window.fengshuiVisual;

// ============ Case 1: 罗盘 24 山向 ============
check('drawLuopan24 返回含 24 山字(壬/子/癸/丑/艮/寅...)', () => {
  var svg = vis.drawLuopan24('南');
  assert.ok(svg.startsWith('<svg'), '以 <svg 开头');
  assert.ok(svg.indexOf('>🚪 大门<') > 0 || svg.indexOf('🚪') > 0, '大门方向标');
  // 24 山字
  ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'].forEach(function (s) {
    assert.ok(svg.indexOf('>' + s + '<') > 0, '含山字 ' + s);
  });
  // 大门朝向的山字应高亮(红色) — "南"门有 3 山: 丙/午/丁
  assert.ok(svg.indexOf('fill="var(--accent-red)"') > 0, '大门山字红色高亮');
});

check('drawLuopan24 不传 doorDir 也能渲染(无 🚪)', () => {
  var svg = vis.drawLuopan24();
  assert.ok(svg.indexOf('<svg') >= 0);
  // 仍含 24 山字
  ['壬','甲','丙','庚'].forEach(function (s) {
    assert.ok(svg.indexOf('>' + s + '<') > 0);
  });
});

// ============ Case 2: 户型方位图 ============
check('drawHouseLayout 含 🚪 大门 + 🛏 主卧', () => {
  var svg = vis.drawHouseLayout({ doorDir: '南', mainRoomDir: '北' });
  assert.ok(svg.indexOf('🚪') >= 0, '含大门 emoji');
  assert.ok(svg.indexOf('🛏') >= 0, '含主卧 emoji');
  // 8 卦方位标
  ['北','东北','东','东南','南','西南','西','西北'].forEach(function (d) {
    assert.ok(svg.indexOf('>' + d + '<') > 0, '含方位 ' + d);
  });
});

check('drawHouseLayout 传 ji/xiong 在对应方位标吉凶', () => {
  var ji = { 伏位:'北', 生气:'东南', 天医:'东', 延年:'南' };
  var xiong = { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' };
  var svg = vis.drawHouseLayout({ doorDir: '南', mainRoomDir: '北', ji: ji, xiong: xiong });
  // 4 吉位文字
  ['伏位','生气','天医','延年'].forEach(function (k) {
    assert.ok(svg.indexOf('>' + k + '<') > 0, '含吉位 ' + k);
  });
  // 4 凶位
  ['祸害','六煞','五鬼','绝命'].forEach(function (k) {
    assert.ok(svg.indexOf('>' + k + '<') > 0, '含凶位 ' + k);
  });
  // 吉位绿色 (var(--accent-green))
  assert.ok(svg.indexOf('var(--accent-green)') > 0, '吉位绿色');
  // 凶位红色
  assert.ok(svg.indexOf('var(--accent-red)') > 0, '凶位红色');
});

check('drawHouseLayout 不传 doorDir 也能渲染(图例仍含 emoji 提示)', () => {
  var svg = vis.drawHouseLayout();
  assert.ok(svg.indexOf('<svg') >= 0);
  // 仍含 8 方位标
  ['北','东','南','西'].forEach(function (d) {
    assert.ok(svg.indexOf('>' + d + '<') > 0);
  });
  // 不含"🚪 大门"圆点(只在 doorDir 存在时画)
  // 区分: 圆点是 <circle ... fill="rgba(220,80,80,0.2)", 图例是纯文本
  var hasDoorCircle = /<circle[^>]*fill="rgba\(220,80,80/.test(svg);
  assert.ok(!hasDoorCircle, '无 doorDir 时不画大门圆点');
});

// ============ Case 3: 玄空九宫格 ============
check('drawJiugong 9 宫 SVG 2026 运盘', () => {
  // 2026 运盘: 5宫=9, 6=1, 7=2, 8=3, 9=4, 1=5, 2=6, 3=7, 4=8
  var yp = globalThis.window.xuankong.yunPan(2026);
  var svg = vis.drawJiugong(yp.panByGong, yp.yunName);
  assert.ok(svg.indexOf('<svg') >= 0);
  // 9 个宫位号都出现
  for (var g = 1; g <= 9; g++) {
    assert.ok(svg.indexOf('>' + g + '宫<') > 0, '含 ' + g + '宫');
  }
  // 5宫(中)入 9(九紫), 9 字 SVG 文本应出现
  assert.ok(svg.indexOf('>9<') > 0, '5 宫入 9');
});

check('drawJiugong 五黄高亮红色', () => {
  // 2026 运盘: 1 宫=5(五黄) — 应该标红
  var yp = globalThis.window.xuankong.yunPan(2026);
  var svg = vis.drawJiugong(yp.panByGong, yp.yunName);
  assert.ok(svg.indexOf('rgba(220,80,80,0.2)') > 0, '五黄红底色');
  // 二黑 7 宫 颜色稍淡
  assert.ok(svg.indexOf('rgba(220,80,80,0.08)') > 0, '二黑红底色');
});

check('drawJiugong 一白/六白/八白/九紫高亮绿色', () => {
  // 2026 运盘: 1宫=5(红), 6宫=1(绿), 7宫=2(红), 8宫=3, ...
  var yp = globalThis.window.xuankong.yunPan(2026);
  var svg = vis.drawJiugong(yp.panByGong, yp.yunName);
  assert.ok(svg.indexOf('rgba(120,180,120,0.1)') > 0, '吉星绿底色');
});

check('drawJiugong 接受数字键或字符串键 panByGong', () => {
  var panNum = { 1: 1, 5: 6 };
  var panStr = { '1': 1, '5': 6 };
  var svg1 = vis.drawJiugong(panNum, 'test');
  var svg2 = vis.drawJiugong(panStr, 'test');
  assert.ok(svg1.indexOf('>1<') > 0);
  assert.ok(svg2.indexOf('>1<') > 0);
});

// ============ Case 4: app/fengshui.js 排盘结果含 SVG ============
check('app/fengshui.js 八宅排盘调 drawLuopan24 + drawHouseLayout', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/drawLuopan24\(/.test(src), '调 drawLuopan24');
  assert.ok(/drawHouseLayout\(/.test(src), '调 drawHouseLayout');
});

check('app/fengshui.js 玄空排盘 3 个 drawJiugong(运/山/向)', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  var matches = src.match(/drawJiugong\(/g);
  assert.ok(matches && matches.length >= 3, '至少 3 次 drawJiugong 调用');
});

// ============ Case 5: index.html 加载 fengshui-visual.js ============
check('index.html 加载 fengshui-visual.js', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/<script src="fengshui-visual\.js/.test(src), 'fengshui-visual.js 已加载');
});

// ============ Case 6: fengshui-visual.js 暴露 ============
check('window.fengshuiVisual 暴露 3 个函数', () => {
  assert.ok(typeof vis.drawLuopan24 === 'function');
  assert.ok(typeof vis.drawHouseLayout === 'function');
  assert.ok(typeof vis.drawJiugong === 'function');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);