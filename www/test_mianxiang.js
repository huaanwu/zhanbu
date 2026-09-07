/**
 * test_mianxiang.js (v3.0.8)
 *
 * 面相模块接线检查(并入 '人相' 后):
 *   - core/ai-service.js 导出 callMultimodalVision + CFG.mianxiang 配置存在
 *   - cache.js makeKey('mianxiang', ...) case 走通 + 指纹唯一性
 *   - core/router.js PAGE_TO_NAV 含 mianxiang:shouxiang(并入人相)
 *   - core/kb.js KB_GROUPS + PAGE_KB_GROUPS 含人相合并
 *   - app/mianxiang.js 关键函数/全局挂载存在
 *   - index.html 已合并人相 tab 结构(无独立 pageMianxiang)
 *
 * 跑法: node www/test_mianxiang.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

// Stub localStorage + window(供 cache.js 加载)
const _store = new Map();
const localStorage = {
  getItem: k => _store.has(k) ? _store.get(k) : null,
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: k => _store.delete(k),
};
globalThis.window = { APP_VERSION: 'v3.0.8' };
globalThis.localStorage = localStorage;

console.log('\n========================================');
console.log('   面相关接线测试 (v3.0.8 — 人相合并后)');
console.log('========================================');

let PASS = 0, FAIL = 0;
function check(name, fn) {
  try { fn(); console.log('  [OK] ' + name); PASS++; }
  catch (e) { console.log('  [FAIL] ' + name + ' — ' + e.message); FAIL++; }
}

// ============ Case 1: core/ai-service.js 导出 callMultimodalVision ============
check('callMultimodalVision 已导出到 Core.AI', () => {
  const src = fs.readFileSync('core/ai-service.js', 'utf-8');
  assert.ok(/callMultimodalVision\s*[,}]/.test(src), 'Core.AI export 列表含 callMultimodalVision');
  assert.ok(/async function callMultimodalVision\(/.test(src), '函数体在 ai-service.js 内定义');
  assert.ok(/opts\?\.targetEl/.test(src), '支持 targetEl 参数');
});

check('shouxiang.js 删除私有 callMultimodalVision 改调 Core.AI', () => {
  const sxSrc = fs.readFileSync('app/shouxiang.js', 'utf-8');
  assert.ok(!/async function callMultimodalVision\(/.test(sxSrc), '私有副本已删除');
  assert.ok(/Core\.AI\.callMultimodalVision\(/.test(sxSrc), '改调 Core.AI.callMultimodalVision');
});

// ============ Case 2: CFG.mianxiang 配置 ============
check('CFG.mianxiang 含 label+isCustom+crossLink', () => {
  const src = fs.readFileSync('core/ai-service.js', 'utf-8');
  const normalized = src.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf("mianxiang: {\n        label:");
  assert.ok(idx > 0, 'CFG 含 mianxiang 条目(对象形式)');
  const tail = normalized.slice(idx);
  assert.ok(/label:\s*'面相'/.test(tail), 'label=面相');
  assert.ok(/isCustom:\s*true/.test(tail), 'isCustom=true');
  assert.ok(/crossLink:\s*\{[^}]*bazi:\s*true[^}]*ziwei:\s*true/.test(tail), 'crossLink 含八字+紫微');
});

// ============ Case 3: cache.js makeKey('mianxiang') ============
eval(fs.readFileSync('cache.js', 'utf-8'));
const { Cache } = globalThis.window;
check('Cache.makeKey mianxiang case 唯一性', () => {
  const params1 = {
    mxGender: 'male',
    images: { front: 'data:image/jpeg;base64,aaa', left45: 'data:image/jpeg;base64,bbb', right45: '' },
    ageBucket: '30-45',
    linkPan: { bazi: { gz: { day: '甲子' } } }
  };
  const k1 = Cache.makeKey('mianxiang', params1);
  assert.ok(k1.startsWith('mianxiang|'), 'key 以 mianxiang| 开头');
  assert.ok(k1.includes('gender:male'), '含 gender');
  assert.ok(k1.includes('age:30-45'), '含 age bucket');
  assert.ok(k1.includes('mx-v1'), '含版本标签 mx-v1');

  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, mxGender: 'female' }), '性别不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, ageBucket: '18-30' }), '年龄段不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, images: { ...params1.images, front: 'data:image/jpeg;base64,xxx' } }), '图不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, linkPan: null }), 'linkPan 不同');
  assert.strictEqual(k1, Cache.makeKey('mianxiang', params1), 'deterministic');
});

check('Cache mianxiang get/set 往返', () => {
  _store.clear();
  Cache.init();
  const params = {
    mxGender: 'male',
    images: { front: 'data:image/jpeg;base64,aaa', left45: '', right45: '' },
    ageBucket: '30-45',
    linkPan: null
  };
  assert.strictEqual(Cache.get('mianxiang', params), null, '初次查询 null');
  const output = '面相 AI 解读结果 — 这里要超过 10 字符才算有效缓存';
  Cache.set('mianxiang', params, output);
  assert.strictEqual(Cache.get('mianxiang', params), output, '写入后能读出');
  assert.strictEqual(Cache.get('mianxiang', { ...params, ageBucket: '18-30' }), null, '年龄段不同 → miss');
});

// ============ Case 4: router.js (v3.0.8 人相合并) ============
check('Router PAGE_TO_NAV mianxiang 路由到 shouxiang(人相合并)', () => {
  const src = fs.readFileSync('core/router.js', 'utf-8');
  assert.ok(/mianxiang:\s*'shouxiang'/.test(src), 'mianxiang → shouxiang(同 nav)');
});

// ============ Case 5: kb.js 接线 ============
check('KB.shouxiang 复合组含 mianxiang(人相合并后)', () => {
  const src = fs.readFileSync('core/kb.js', 'utf-8');
  // PAGE_KB_GROUPS.shouxiang 同时加载 shouxiang + mianxiang 两组
  const m = src.match(/PAGE_KB_GROUPS\s*=\s*\{([\s\S]*?)^\}/m);
  assert.ok(m, 'PAGE_KB_GROUPS 块存在');
  assert.ok(/shouxiang:\s*\[\s*['"]shouxiang['"]\s*,\s*['"]mianxiang['"]/.test(m[1]), 'shouxiang 同时加载 mianxiang');
  // 复合 group renxiang 存在(若别处用)
  assert.ok(/renxiang:\s*\[/.test(src), '复合 group renxiang 存在');
});

// ============ Case 6: app/mianxiang.js 关键符号 ============
check('app/mianxiang.js 全局挂载 + 调 Core.AI.callMultimodalVision', () => {
  const src = fs.readFileSync('app/mianxiang.js', 'utf-8');
  assert.ok(/function\s+setMxGender\b/.test(src), '定义 setMxGender');
  assert.ok(/window\.setMxGender\s*=/.test(src), 'setMxGender 挂到 window');
  assert.ok(/function\s+onMxFileSelect\b/.test(src), '定义 onMxFileSelect');
  assert.ok(/window\.onMxFileSelect\s*=/.test(src), 'onMxFileSelect 挂到 window');
  assert.ok(/function\s+buildMianxiangPrompt\b/.test(src), '定义 buildMianxiangPrompt');
  assert.ok(/async function\s+doMianxiang\b/.test(src), '定义 doMianxiang');
  assert.ok(/window\.doMianxiang\s*=/.test(src), 'doMianxiang 挂到 window');
  assert.ok(/function\s+setupMxDragDrop\b/.test(src), '定义 setupMxDragDrop');
  assert.ok(/Core\.AI\.callMultimodalVision\(/.test(src), 'doMianxiang 调 Core.AI.callMultimodalVision');
  assert.ok(/targetEl:\s*resultEl/.test(src), '传 targetEl 给共享函数');
  assert.ok(/mxGender:\s*mxGender/.test(src), 'cacheParams 含 mxGender');
});

// ============ Case 7: index.html 人相合并 tab 结构 ============
check('index.html nav 改人相 + tab 切换 + 面相 DOM 在 pane 内', () => {
  const src = fs.readFileSync('index.html', 'utf-8');
  // nav 改为人相
  assert.ok(/id="navShouxiang"[^>]*>\s*<span class="icon">[^<]*<\/span>\s*人相/.test(src), 'nav 改为人相');
  // tab 切换栏
  assert.ok(/id="renxiangTabHand"/.test(src), 'tab 按钮:看手相');
  assert.ok(/id="renxiangTabFace"/.test(src), 'tab 按钮:看面相');
  assert.ok(/id="renxiangPaneHand"/.test(src), 'pane:renxiangPaneHand');
  assert.ok(/id="renxiangPaneFace"/.test(src), 'pane:renxiangPaneFace');
  assert.ok(/switchRenxiangTab/.test(src), 'tab 切换函数挂载');
  // 面相 DOM 在 pane 内
  assert.ok(/id="mxGenderMale"/.test(src), '性别按钮 mxGenderMale');
  assert.ok(/id="mxUploadAreaFront"/.test(src), '正面');
  assert.ok(/id="mxUploadAreaLeft45"/.test(src), '左 45°');
  assert.ok(/id="mxUploadAreaRight45"/.test(src), '右 45°');
  assert.ok(/id="mxAgeBucket"/.test(src), '年龄段');
  assert.ok(/onMxFileSelect\(event,\s*'front'\)/.test(src), '正面 onchange');
  assert.ok(/onMxFileSelect\(event,\s*'left45'\)/.test(src), '左 45° onchange');
  assert.ok(/onMxFileSelect\(event,\s*'right45'\)/.test(src), '右 45° onchange');
  // 独立 pageMianxiang 已移除(并入 pageShouxiang)
  assert.ok(!/id="pageMianxiang"/.test(src), '独立 pageMianxiang 已并入 pageShouxiang');
  // 占卦分组卡不再有 mianxiang 跳转
  assert.ok(!/onclick="switchPage\('mianxiang'\)"/.test(src), '占卦分组 mianxiang 卡已下架');
  // 设置页历史过滤仍含 mianxiang(历史记录不丢)
  assert.ok(/value="mianxiang">\s*面相/.test(src), '设置页 historyFilterDomain 仍含 mianxiang');
  // app/mianxiang.js 仍在加载(tab 触发时需要)
  assert.ok(/<script src="app\/mianxiang\.js/.test(src), 'app/mianxiang.js 仍加载');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);