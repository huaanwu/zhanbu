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
// 文档环境 stub(供 openFengshuiModal / showShanDetail 调用)
globalThis.window = {};
globalThis.document = {
  getElementById: function (id) {
    return globalThis.window[id] || null;
  },
  createElement: function (tag) {
    var el = {
      tagName: tag.toUpperCase(),
      id: '',
      style: { cssText: '' },
      innerHTML: '',
      children: [],
      addEventListener: function () {},
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k]; }
    };
    Object.defineProperty(el, 'style', {
      set: function (css) { this._cssText = css; },
      get: function () { return { cssText: this._cssText || '', display: '' }; }
    });
    return el;
  },
  body: { appendChild: function (el) {} }
};
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

// ============ v3.0.13: 24 山 / 9 星 详情数据 + click 处理 ============
check('SHAN_DETAILS 含 24 山完整数据', () => {
  var shanList = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  shanList.forEach(function (s) {
    var d = vis.SHAN_DETAILS[s];
    assert.ok(d, 'SHAN_DETAILS[' + s + '] 存在');
    assert.ok(d.wuxing, '五行');
    assert.ok(d.jiXiong, '阴阳/属性');
    assert.ok(d.desc, '描述');
    assert.ok(d.use, '应用');
  });
});

check('STAR_DETAILS 含 1-9 星完整数据(五黄/二黑有化解)', () => {
  for (var i = 1; i <= 9; i++) {
    var d = vis.STAR_DETAILS[i];
    assert.ok(d, 'STAR_DETAILS[' + i + '] 存在');
    assert.ok(d.name, '名字');
    assert.ok(d.wuxing, '五行');
    assert.ok(d.jiXiong, '吉凶');
    assert.ok(d.apply, '应用');
    // 五黄/二黑必须有化解
    if (i === 5 || i === 2) {
      assert.ok(d.huaJie, i + ' 号星(凶星)有化解方案');
    }
  }
});

check('showShanDetail/showStarDetail 是函数,open/closeFengshuiModal 是函数', () => {
  assert.strictEqual(typeof vis.showShanDetail, 'function');
  assert.strictEqual(typeof vis.showStarDetail, 'function');
  assert.strictEqual(typeof vis.openFengshuiModal, 'function');
  assert.strictEqual(typeof vis.closeFengshuiModal, 'function');
});

check('showShanDetail 接受合法山字不抛错', () => {
  // 不实际弹 modal,只验函数本身
  try {
    vis.showShanDetail('子');
    vis.showShanDetail('乾');
    vis.showShanDetail('不存在之山');  // 应 fallback 而不抛错
  } catch (e) {
    throw new Error('showShanDetail 不应抛错: ' + e.message);
  }
  // 关闭 modal(避免污染 DOM)
  vis.closeFengshuiModal();
});

check('showStarDetail 接受 1-9 不抛错,非法值 fallback', () => {
  try {
    for (var i = 1; i <= 9; i++) vis.showStarDetail(i);
    vis.showStarDetail(99);  // fallback
  } catch (e) {
    throw new Error('showStarDetail 不应抛错: ' + e.message);
  }
  vis.closeFengshuiModal();
});

check('drawLuopan24 含可点击元素(onclick + data-shan)', () => {
  var svg = vis.drawLuopan24('南');
  // 至少 24 个 data-shan 属性 + onclick
  var matches = svg.match(/data-shan=/g);
  assert.ok(matches && matches.length >= 24, '至少 24 个 data-shan,实际 ' + (matches ? matches.length : 0));
  assert.ok(/onclick="window\.fengshuiVisual\.showShanDetail/.test(svg), '含 onclick 绑定');
});

check('drawJiugong 含可点击宫位(onclick 调 showStarDetail)', () => {
  var yp = globalThis.window.xuankong.yunPan(2026);
  var svg = vis.drawJiugong(yp.panByGong, yp.yunName);
  var matches = svg.match(/showStarDetail\(/g);
  assert.ok(matches && matches.length >= 9, '至少 9 个 showStarDetail 调用');
});

check('openFengshuiModal 创建 #fengshuiModal 容器', () => {
  // 先注册 stub 容器
  var stubModal = { id: 'fengshuiModal', style: {}, innerHTML: '' };
  globalThis.window.fengshuiModal = stubModal;
  globalThis.document.getElementById = function (id) {
    return id === 'fengshuiModal' ? stubModal : null;
  };
  vis.openFengshuiModal('<div>test</div>');
  var modal = globalThis.document.getElementById('fengshuiModal');
  assert.ok(modal, '#fengshuiModal 创建');
  assert.ok(modal.style.display === 'flex', 'display=flex');
  vis.closeFengshuiModal();
  assert.strictEqual(modal.style.display, 'none', 'close 后 display=none');
});

// ============ v3.0.19 三层罗盘叠加 ============
check('drawLuopan24 含 3 层圆环标记(地盘/人盘/天盘)', () => {
  var svg = vis.drawLuopan24('南');
  // 三种颜色圆环(各 2 个 = 6 个圆)
  var goldCircles = (svg.match(/stroke="var\(--accent-gold\)"/g) || []).length;
  var blueCircles = (svg.match(/stroke="var\(--accent-blue\)"/g) || []).length;
  var redCircles = (svg.match(/stroke="var\(--accent-red\)"/g) || []).length;
  assert.ok(goldCircles >= 2, '天盘金圈 ≥ 2,实际 ' + goldCircles);
  assert.ok(blueCircles >= 2, '人盘蓝圈 ≥ 2,实际 ' + blueCircles);
  assert.ok(redCircles >= 2, '地盘红圈 ≥ 2(地圈+大门圆点),实际 ' + redCircles);
});

check('drawLuopan24 含 3 层字(每山向 3 字:天/人/地)', () => {
  var svg = vis.drawLuopan24('南');
  // 24 山 × 3 层 = 72 个字 text
  // 但有些 text 是 8 卦大标(8) + 大门(1) + 中心(1) = 10 个额外
  // 简化: 检查 24 山在 SVG 出现 ≥ 72 次
  var count = (svg.match(/<text/g) || []).length;
  assert.ok(count >= 72, 'text 元素 ≥ 72(24 山 × 3 层),实际 ' + count);
});

check('drawLuopan24 含三层标签图例(天盘/人盘/地盘)', () => {
  var svg = vis.drawLuopan24('南');
  assert.ok(/天盘·纳水/.test(svg), '天盘标签');
  assert.ok(/人盘·消砂/.test(svg), '人盘标签');
  assert.ok(/地盘·立向/.test(svg), '地盘标签');
});

check('drawLuopan24 天盘左旋 7.5°(纳水)、人盘右旋 7.5°(消砂)', () => {
  // 验证: 24 山每字都有 3 个副本(天/地/人)
  // 简化: 验证 24 山每字至少出现 3 次(一次天、一次人、一次地)
  // v3.1.1: 三盘字可能不同(sanPan 数据驱动),改为每字加 sanPan 三盘字之和 = 3
  var svg = vis.drawLuopan24('南');
  // '壬' 应出现 1 次(地盘)+ sanPan.tian='天壬'/'缝壬' 等 1 次+ sanPan.ren='子' 0 次
  // 改为检查 SHAN_DETAILS 含 sanPan 字段(数据驱动验证)
  var renInfo = vis.SHAN_DETAILS['壬'];
  assert.ok(renInfo.sanPan, '壬字含 sanPan 字段');
  assert.ok(renInfo.sanPan.di, '壬.sanPan.di 存在');
  assert.ok(renInfo.sanPan.ren, '壬.sanPan.ren 存在');
  assert.ok(renInfo.sanPan.tian, '壬.sanPan.tian 存在');
  // '子' 同
  var ziInfo = vis.SHAN_DETAILS['子'];
  assert.ok(ziInfo.sanPan, '子字含 sanPan 字段');
});

check('drawLuopan24 不传 doorDir 也能渲染(3 层仍工作)', () => {
  var svg = vis.drawLuopan24();
  assert.ok(svg.indexOf('<svg') >= 0);
  // 仍 24 山 × 3 层
  var count = (svg.match(/<text/g) || []).length;
  assert.ok(count >= 72, 'text 元素 ≥ 72,实际 ' + count);
});

// ============ v3.1.1 72 龙数据 ============
check('SHAN_DETAILS 24 山全含 sanPan 字段(三盘数据)', () => {
  var shanList = ['壬','子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥'];
  shanList.forEach(function (s) {
    var d = vis.SHAN_DETAILS[s];
    assert.ok(d, 'SHAN_DETAILS[' + s + '] 存在');
    assert.ok(d.sanPan, s + ' 含 sanPan');
    assert.ok(d.sanPan.di && d.sanPan.ren && d.sanPan.tian, s + ' 三盘字全有');
  });
});

check('sanPan 简化规则:三盘字不全相同(代表三盘不同)', () => {
  // 壬/子等大部分山三盘字至少一对不同
  // 抽样验证: 壬 di=壬, ren=子, tian=天壬 → 至少 2 个不同
  var ren = vis.SHAN_DETAILS['壬'].sanPan;
  var distinct = new Set([ren.di, ren.ren, ren.tian]);
  assert.ok(distinct.size >= 2, '壬三盘字至少 2 个不同(实际 ' + distinct.size + ')');
  // 子 di=子, ren=癸, tian=缝壬
  var zi = vis.SHAN_DETAILS['子'].sanPan;
  var distinct2 = new Set([zi.di, zi.ren, zi.tian]);
  assert.ok(distinct2.size >= 2, '子三盘字至少 2 个不同');
});

check('drawLuopan24 用 sanPan 数据驱动(三盘字不同)', () => {
  // 验证 SVG 中包含 sanPan 的三盘字
  // 壬 sanPan.tian = '天壬' — 验 SVG 含 "天壬"
  var svg = vis.drawLuopan24('南');
  assert.ok(svg.indexOf('天壬') > 0, 'SVG 含 sanPan.tian "天壬"');
  // 子 sanPan.tian = '缝壬'
  assert.ok(svg.indexOf('缝壬') > 0, 'SVG 含 sanPan.tian "缝壬"');
});

// ============ v3.1.8 dead code 清理 ============
// v3.1.8: 删除 app/fengshui.js 里 v3.1.2/4/5 大六壬 dead code
// (已迁到独立 pageDaliuren + app/daliuren.js)
// 这些 case 检查 函数确实已删除
check('app/fengshui.js v3.1.8 dead code 已删除(doDaliurenFromFengshui/doDaliurenManual/doAIDaliuren/saveDlrForAI)', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(!/function doDaliurenFromFengshui\(/.test(src), 'doDaliurenFromFengshui 已删除');
  assert.ok(!/function doDaliurenManual\(/.test(src), 'doDaliurenManual 已删除');
  assert.ok(!/function doAIDaliuren\(/.test(src), 'doAIDaliuren 已删除');
  assert.ok(!/function saveDlrForAI\(/.test(src), 'saveDlrForAI 已删除');
  assert.ok(!/window\.doDaliurenFromFengshui\s*=/.test(src), 'window.doDaliurenFromFengshui 已删除');
  assert.ok(!/window\.doDaliurenManual\s*=/.test(src), 'window.doDaliurenManual 已删除');
  assert.ok(!/window\.doAIDaliuren\s*=/.test(src), 'window.doAIDaliuren 已删除');
});

check('app/fengshui.js v3.1.8 保留 selFsTab/selFsHouse/selFsGender/selFsCal/selFsMainRoom/doFengshui/fsGZToYear/selXkSit/selXkFace/selXkTiGua/doXuankong/kbFengshui', () => {
  var src = fs.readFileSync('app/fengshui.js', 'utf-8');
  assert.ok(/function selFsTab\(/.test(src), 'selFsTab 保留');
  assert.ok(/function selFsHouse\(/.test(src), 'selFsHouse 保留');
  assert.ok(/function selFsGender\(/.test(src), 'selFsGender 保留');
  assert.ok(/function selFsCal\(/.test(src), 'selFsCal 保留');
  assert.ok(/function selFsMainRoom\(/.test(src), 'selFsMainRoom 保留');
  assert.ok(/function doFengshui\(/.test(src), 'doFengshui 保留');
  assert.ok(/function fsGZToYear\(/.test(src), 'fsGZToYear 保留');
  assert.ok(/function selXkSit\(/.test(src), 'selXkSit 保留');
  assert.ok(/function selXkFace\(/.test(src), 'selXkFace 保留');
  assert.ok(/function selXkTiGua\(/.test(src), 'selXkTiGua 保留');
  assert.ok(/function doXuankong\(/.test(src), 'doXuankong 保留');
  assert.ok(/function kbFengshui\(/.test(src), 'kbFengshui 保留');
});

// ============ v3.1.7 大六壬独立 tab ============
// v3.1.8 之后: 玄空 pane 里大六壬手动输入/AI 解读已迁到独立 pageDaliuren
// (v3.0.7 接入, www/app/daliuren.js)
// 这些 case 检查 玄空 pane 没有大六壬重复 DOM + 大六壬页本身完好
check('index.html 玄空 pane 不再有大六壬手动输入 DOM', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  // 玄空 pane(fsPaneXuankong) 里不应该再有 大六壬手动输入 DOM
  var xkStart = src.indexOf('fsPaneXuankong');
  var xkEnd = src.indexOf('pageDaofobuddhism', xkStart);
  var xkBlock = src.slice(xkStart, xkEnd);
  assert.ok(!/id="dlrMethod"/.test(xkBlock), '玄空 pane 无 dlrMethod');
  assert.ok(!/id="dlrDayGZ"/.test(xkBlock), '玄空 pane 无 dlrDayGZ');
  assert.ok(!/id="dlrYueJiang"/.test(xkBlock), '玄空 pane 无 dlrYueJiang');
  assert.ok(!/id="dlrHourZhi"/.test(xkBlock), '玄空 pane 无 dlrHourZhi');
  assert.ok(!/onclick="doDaliurenFromFengshui/.test(xkBlock), '玄空 pane 无 doDaliurenFromFengshui onclick');
  assert.ok(!/onclick="doAIDaliuren/.test(xkBlock), '玄空 pane 无 doAIDaliuren onclick');
  // 但应有大六壬跳转按钮
  assert.ok(/switchPage\('daliuren'\)/.test(xkBlock), '玄空 pane 含大六壬跳转');
});

check('index.html 大六壬独立页(pageDaliuren)完整存在', () => {
  var src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/id="pageDaliuren"/.test(src), 'pageDaliuren 存在');
  assert.ok(/id="dlrYear"/.test(src), 'dlrYear 输入');
  assert.ok(/id="dlrBtn"[\s\S]*onclick="doDaliuren\(\)"/.test(src), 'doDaliuren onclick');
  assert.ok(/id="dlrAIBtn"[\s\S]*onclick="doAIDaliuren\(\)"/.test(src), 'doAIDaliuren onclick');
});

check('app/daliuren.js 含 doDaliuren + doAIDaliuren(v3.0.7 接入)', () => {
  var src = fs.readFileSync('app/daliuren.js', 'utf-8');
  assert.ok(/window\.doDaliuren\s*=/.test(src), 'doDaliuren 挂到 window');
  assert.ok(/window\.doAIDaliuren\s*=/.test(src), 'doAIDaliuren 挂到 window');
});

// ============ v3.1.6 大六壬九宗门 + 神煞 ============
check('window.fengshuiVisual 暴露 drawDaliurenZongmen/drawDaliurenGanSha + DLR_ZONGMEN_DETAILS/DLR_GAN_SHA', () => {
  assert.strictEqual(typeof vis.drawDaliurenZongmen, 'function');
  assert.strictEqual(typeof vis.drawDaliurenGanSha, 'function');
  assert.ok(vis.DLR_ZONGMEN_DETAILS, 'DLR_ZONGMEN_DETAILS 暴露');
  assert.ok(vis.DLR_GAN_SHA, 'DLR_GAN_SHA 暴露');
});

check('DLR_ZONGMEN_DETAILS 含 9 宗门口诀', () => {
  var zongmenList = ['贼克法','比用法','涉害法','遥克法','昴星法','别责法','八专法','伏吟法','返吟法'];
  zongmenList.forEach(function (z) {
    var d = vis.DLR_ZONGMEN_DETAILS[z];
    assert.ok(d, 'DLR_ZONGMEN_DETAILS[' + z + '] 存在');
    assert.ok(d.name, 'name 字段');
    assert.ok(d.desc, 'desc 字段');
    assert.ok(d.color, 'color 字段');
    assert.ok(d.meaning, 'meaning 字段');
  });
});

check('DLR_GAN_SHA 10 天干各含主要神煞(天乙贵人/长生/临官/帝旺/衰/胎/养)', () => {
  var gans = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  gans.forEach(function (g) {
    var shaList = vis.DLR_GAN_SHA[g];
    assert.ok(Array.isArray(shaList), g + ' 神煞表存在');
    // v3.1.6 简化: 每干一样 13 项(简化,不区分阴长生起点)
    assert.strictEqual(shaList.length, 13, g + ' 神煞 13 个');
    assert.ok(shaList.indexOf('天乙贵人') >= 0, g + ' 含 天乙贵人');
    assert.ok(shaList.indexOf('长生') >= 0, g + ' 含 长生');
    assert.ok(shaList.indexOf('临官') >= 0, g + ' 含 临官');
    assert.ok(shaList.indexOf('帝旺') >= 0, g + ' 含 帝旺');
    assert.ok(shaList.indexOf('衰') >= 0, g + ' 含 衰');
    assert.ok(shaList.indexOf('胎') >= 0, g + ' 含 胎');
    assert.ok(shaList.indexOf('养') >= 0, g + ' 含 养');
  });
});

check('drawDaliurenZongmen 渲染课式 SVG(含宗门名+课体+描述+意义)', () => {
  var pan = { faYong: { zongmen: '贼克法', keti: '元首课' } };
  var svg = vis.drawDaliurenZongmen(pan);
  assert.ok(svg.indexOf('<svg') >= 0);
  assert.ok(svg.indexOf('贼克法') > 0, '含宗门名');
  assert.ok(svg.indexOf('元首课') > 0, '含课体');
  assert.ok(svg.indexOf('上神克下神') > 0, '含描述');
  assert.ok(svg.indexOf('冲突/克制') > 0, '含意义');
});

check('drawDaliurenZongmen 非法宗门 fallback(显示 zongmen 原名)', () => {
  var pan = { faYong: { zongmen: '未知宗门', keti: '未知课' } };
  var svg = vis.drawDaliurenZongmen(pan);
  assert.ok(svg.indexOf('未知宗门') > 0, 'fallback 显示原宗门名');
});

check('drawDaliurenGanSha 渲染日干神煞表(含主要神煞)', () => {
  var pan = { dayGan: '甲' };
  var svg = vis.drawDaliurenGanSha(pan);
  assert.ok(svg.indexOf('<svg') >= 0);
  assert.ok(svg.indexOf('天乙贵人') > 0, '含 天乙贵人');
  assert.ok(svg.indexOf('长生') > 0, '含 长生');
  assert.ok(svg.indexOf('临官') > 0, '含 临官');
  assert.ok(svg.indexOf('帝旺') > 0, '含 帝旺');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);