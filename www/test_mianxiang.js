/**
 * test_mianxiang.js (v3.0.8)
 *
 * 面相模块接线检查:
 *   - core/ai-service.js 导出 callMultimodalVision + CFG.mianxiang 配置存在
 *   - cache.js makeKey('mianxiang', ...) case 走通 + 指纹唯一性
 *   - core/router.js PAGE_TO_NAV 含 mianxiang:zhangua
 *   - core/kb.js PAGE_KB_GROUPS + KB_GROUPS + KB_TIERS.primary/extended 含 mianxiang
 *   - app/mianxiang.js 关键函数/全局挂载存在
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

// ============ Case 1: core/ai-service.js 导出 callMultimodalVision ============
console.log('[Core.AI] callMultimodalVision 已导出');
{
  const src = fs.readFileSync('core/ai-service.js', 'utf-8');
  assert.ok(/callMultimodalVision\s*[,}]/.test(src), 'Core.AI export 列表含 callMultimodalVision');
  assert.ok(/async function callMultimodalVision\(/.test(src), '函数体在 ai-service.js 内定义');
  assert.ok(/opts\?\.targetEl/.test(src), '支持 targetEl 参数(面相可传 #mxResult)');
  // 不在 shouxiang.js 内
  const sxSrc = fs.readFileSync('app/shouxiang.js', 'utf-8');
  assert.ok(!/async function callMultimodalVision\(/.test(sxSrc), 'shouxiang.js 已删除私有 callMultimodalVision');
  assert.ok(/Core\.AI\.callMultimodalVision\(/.test(sxSrc), 'shouxiang.js 改调 Core.AI.callMultimodalVision');
}

// ============ Case 2: CFG.mianxiang 配置存在 ============
console.log('[Core.AI] CFG.mianxiang 配置');
{
  const src = fs.readFileSync('core/ai-service.js', 'utf-8');
  assert.ok(/mianxiang:\s*\{/.test(src), 'CFG 含 mianxiang 条目');
  assert.ok(/label:\s*'面相'/.test(src), 'label=面相');
  assert.ok(/isCustom:\s*true/.test(src.split('mianxiang:')[1] || ''), 'isCustom=true');
  assert.ok(/crossLink:\s*\{[^}]*bazi:\s*true[^}]*ziwei:\s*true/.test(src.split('mianxiang:')[1] || ''), 'crossLink 含八字+紫微');
}

// ============ Case 3: cache.js makeKey('mianxiang') ============
console.log('[Cache] makeKey mianxiang case');
eval(fs.readFileSync('cache.js', 'utf-8'));
const { Cache } = globalThis.window;
{
  // 性别 + 3 张图 + 年龄段 + linkPan 决定 key
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

  // 不同性别 → 不同 key
  const k2 = Cache.makeKey('mianxiang', { ...params1, mxGender: 'female' });
  assert.notStrictEqual(k1, k2, '性别不同 → 不同 key');

  // 不同年龄段 → 不同 key
  const k3 = Cache.makeKey('mianxiang', { ...params1, ageBucket: '18-30' });
  assert.notStrictEqual(k1, k3, '年龄段不同 → 不同 key');

  // 不同图(front 指纹变) → 不同 key
  const k4 = Cache.makeKey('mianxiang', { ...params1, images: { ...params1.images, front: 'data:image/jpeg;base64,xxx' } });
  assert.notStrictEqual(k1, k4, '图不同 → 不同 key');

  // 无 linkPan 与有 linkPan → 不同 key
  const k5 = Cache.makeKey('mianxiang', { ...params1, linkPan: null });
  assert.notStrictEqual(k1, k5, 'linkPan 不同 → 不同 key');

  // 同一入参 → 同一 key(deterministic)
  const k6 = Cache.makeKey('mianxiang', params1);
  assert.strictEqual(k1, k6, '同入参 → 同 key');

  // 与其他域不冲突
  const baziKey = Cache.makeKey('bazi', { gz: { year: '甲子' } });
  assert.notStrictEqual(k1.startsWith('mianxiang'), baziKey.startsWith('mianxiang'), 'mianxiang vs bazi 不冲突');
}

// ============ Case 4: Cache.get/set 端到端 ============
console.log('[Cache] mianxiang get/set 往返');
{
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

  const miss = Cache.get('mianxiang', { ...params, ageBucket: '18-30' });
  assert.strictEqual(miss, null, '年龄段不同 → cache miss');
}

// ============ Case 5: core/router.js PAGE_TO_NAV ============
console.log('[Router] PAGE_TO_NAV mianxiang');
{
  const src = fs.readFileSync('core/router.js', 'utf-8');
  assert.ok(/mianxiang:\s*'zhangua'/.test(src), 'mianxiang → zhangua 分组');
}

// ============ Case 6: core/kb.js 接线 ============
console.log('[KB] mianxiang 接线');
{
  const src = fs.readFileSync('core/kb.js', 'utf-8');
  assert.ok(/mianxiang:\s*\['mianxiang_ext'/.test(src), 'KB_GROUPS.mianxiang 含 3 个 KB');
  assert.ok(/mianxiang:\s*\['mianxiang'\]/.test(src), 'PAGE_KB_GROUPS.mianxiang');
  assert.ok(/mianxiang:\s*\['mianxiang_ext',\s*'mianxiang_qise'\]/.test(src), 'KB_TIERS.primary.mianxiang');
  assert.ok(/mianxiang:\s*\['mianxiang_qise2'\]/.test(src), 'KB_TIERS.extended.mianxiang');
}

// ============ Case 7: app/mianxiang.js 关键符号 ============
console.log('[app/mianxiang.js] 关键函数/全局挂载');
{
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
  assert.ok(/mxGender:\s*mxGender/.test(src) || /mxGender:/.test(src), 'cacheParams 含 mxGender');
}

// ============ Case 8: index.html 接线 ============
console.log('[index.html] pageMianxiang 接线');
{
  const src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/id="pageMianxiang"/.test(src), '有 pageMianxiang DOM');
  assert.ok(/onclick="switchPage\('mianxiang'\)"/.test(src), '占卦分组卡可跳 mianxiang');
  assert.ok(/<script src="app\/mianxiang\.js/.test(src), '加载 app/mianxiang.js');
  assert.ok(/value="mianxiang">\s*面相/.test(src), '设置页 historyFilterDomain 含 mianxiang');
  assert.ok(/id="mxGenderMale"/.test(src), '性别按钮 mxGenderMale');
  assert.ok(/id="mxUploadAreaFront"/.test(src), '3 张图上传区 DOM');
  assert.ok(/id="mxUploadAreaLeft45"/.test(src), '左 45° 上传区');
  assert.ok(/id="mxUploadAreaRight45"/.test(src), '右 45° 上传区');
  assert.ok(/id="mxAgeBucket"/.test(src), '年龄段选择');
  assert.ok(/onMxFileSelect\(event,\s*'front'\)|onMxFileSelect\(event,\s*\"front\"\)/.test(src), '正面 onchange 正确');
  assert.ok(/onMxFileSelect\(event,\s*'left45'\)|onMxFileSelect\(event,\s*\"left45\"\)/.test(src), '左 45° onchange 正确');
  assert.ok(/onMxFileSelect\(event,\s*'right45'\)|onMxFileSelect\(event,\s*\"right45\"\)/.test(src), '右 45° onchange 正确');
}

console.log('\n========================================');
console.log('   面相关接线测试 (v3.0.8)');
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
  // 找 CFG 块里的 mianxiang 条目(从第一个 '{' 到 block 结束);注意 Windows 文件可能是 \r\n
  const normalizedSrc = src.replace(/\r\n/g, '\n');
  const idx = normalizedSrc.indexOf("mianxiang: {\n        label:");
  assert.ok(idx > 0, 'CFG 含 mianxiang 条目(对象形式)');
  const tail = normalizedSrc.slice(idx);
  assert.ok(/label:\s*'面相'/.test(tail), 'label=面相');
  assert.ok(/isCustom:\s*true/.test(tail), 'isCustom=true');
  assert.ok(/crossLink:\s*\{[^}]*bazi:\s*true[^}]*ziwei:\s*true/.test(tail), 'crossLink 含八字+紫微');
});

// ============ Case 3: cache.js makeKey('mianxiang') ============
check('Cache.makeKey mianxiang case 唯一性', () => {
  eval(fs.readFileSync('cache.js', 'utf-8'));
  const { Cache } = globalThis.window;
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

  // 性别 / 年龄段 / 图片 / linkPan 任一不同 → 不同 key
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, mxGender: 'female' }), '性别不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, ageBucket: '18-30' }), '年龄段不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, images: { ...params1.images, front: 'data:image/jpeg;base64,xxx' } }), '图不同');
  assert.notStrictEqual(k1, Cache.makeKey('mianxiang', { ...params1, linkPan: null }), 'linkPan 不同');
  // 同入参 → 同 key
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

// ============ Case 4: router.js ============
check('Router PAGE_TO_NAV mianxiang:zhangua', () => {
  const src = fs.readFileSync('core/router.js', 'utf-8');
  assert.ok(/mianxiang:\s*'zhangua'/.test(src), 'mianxiang → zhangua 分组');
});

// ============ Case 5: kb.js 接线 ============
check('KB.mianxiang 接线 (KB_GROUPS + PAGE_KB_GROUPS + KB_TIERS)', () => {
  const src = fs.readFileSync('core/kb.js', 'utf-8');
  assert.ok(/mianxiang:\s*\['mianxiang_ext'/.test(src), 'KB_GROUPS.mianxiang');
  assert.ok(/mianxiang:\s*\['mianxiang'\]/.test(src), 'PAGE_KB_GROUPS.mianxiang');
  assert.ok(/mianxiang:\s*\['mianxiang_ext',\s*'mianxiang_qise'\]/.test(src), 'KB_TIERS.primary.mianxiang');
  assert.ok(/mianxiang:\s*\['mianxiang_qise2'\]/.test(src), 'KB_TIERS.extended.mianxiang');
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

// ============ Case 7: index.html 接线 ============
check('index.html pageMianxiang 接线完整', () => {
  const src = fs.readFileSync('index.html', 'utf-8');
  assert.ok(/id="pageMianxiang"/.test(src), '有 pageMianxiang DOM');
  assert.ok(/onclick="switchPage\('mianxiang'\)"/.test(src), '占卦分组卡可跳 mianxiang');
  assert.ok(/<script src="app\/mianxiang\.js/.test(src), '加载 app/mianxiang.js');
  assert.ok(/value="mianxiang">\s*面相/.test(src), '设置页 historyFilterDomain 含 mianxiang');
  assert.ok(/id="mxGenderMale"/.test(src), '性别按钮 mxGenderMale');
  assert.ok(/id="mxUploadAreaFront"/.test(src), '正面上传区');
  assert.ok(/id="mxUploadAreaLeft45"/.test(src), '左 45° 上传区');
  assert.ok(/id="mxUploadAreaRight45"/.test(src), '右 45° 上传区');
  assert.ok(/id="mxAgeBucket"/.test(src), '年龄段选择');
  assert.ok(/onMxFileSelect\(event,\s*'front'\)/.test(src), '正面 onchange');
  assert.ok(/onMxFileSelect\(event,\s*'left45'\)/.test(src), '左 45° onchange');
  assert.ok(/onMxFileSelect\(event,\s*'right45'\)/.test(src), '右 45° onchange');
});

console.log(`\n========================================`);
console.log(`   Total: ${PASS + FAIL}  Pass: ${PASS}  Fail: ${FAIL}`);
console.log(`   Rate: ${((PASS / (PASS + FAIL)) * 100).toFixed(1)}%`);
console.log(`========================================`);
process.exit(FAIL > 0 ? 1 : 0);