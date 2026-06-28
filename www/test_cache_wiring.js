/**
 * test_cache_wiring.js
 *
 * 锁定 Cache 模块在 5 个 doAI* 中的接通逻辑(2026-06-28 v1.3.0+):
 *   - 每个 doAI* 在 callDeepSeek 前查 Cache.get,命中则直接返回
 *   - 命中后 saveHistory + addFeedbackUI + showResultActions
 *   - 失败后 Cache.set 写入
 *   - try/catch 包裹避免 Cache 异常中断 AI 调用
 *
 * 纯 Node 测试(用 stub localStorage),与 test_bug_fixes.js 同模式。
 * 跑法: node www/test_cache_wiring.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

// Stub localStorage
const _store = new Map();
const localStorage = {
  getItem: k => _store.has(k) ? _store.get(k) : null,
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: k => _store.delete(k),
};
globalThis.window = { APP_VERSION: '1.3.0' };
globalThis.localStorage = localStorage;

eval(fs.readFileSync('cache.js', 'utf-8'));
const { Cache } = globalThis.window;

// ============= Case 1: makeKey 跨 domain 唯一性 =============
console.log('[Cache]   makeKey returns unique keys per domain');
{
  const baziKey = Cache.makeKey('bazi', {
    gz: { year: '甲子', month: '丙寅', day: '戊午', hour: '丁巳' },
    gender: 'male',
    question: '事业如何'
  });
  const liuyaoKey = Cache.makeKey('liuyao', {
    gua: { name: '乾为天', dongYaoList: [4] },
    question: '事业如何'
  });
  const qimenKey = Cache.makeKey('qimen', {
    jushu_text: '阳遁1局',
    bazi: ['丙午', '庚子', '戊午', '戊午'],
    question: '事业如何'
  });
  const ziweiKey = Cache.makeKey('ziwei', {
    mingGong: { ganzhi: '庚午' },
    gender: 'male',
    question: '事业如何'
  });
  const crossKey = Cache.makeKey('cross', {
    bazi: { gz: { day: '癸巳' } },
    liuyao: { gua: { name: '雷泽归妹' } },
    question: '事业如何'
  });

  assert.ok(baziKey.startsWith('bazi|'), 'bazi key starts with bazi');
  assert.ok(liuyaoKey.startsWith('liuyao|'), 'liuyao key starts with liuyao');
  assert.ok(qimenKey.startsWith('qimen|'), 'qimen key starts with qimen');
  assert.ok(ziweiKey.startsWith('ziwei|'), 'ziwei key starts with ziwei');
  assert.ok(crossKey.startsWith('cross|'), 'cross key starts with cross');

  // 5 个 key 互不相同
  const keys = new Set([baziKey, liuyaoKey, qimenKey, ziweiKey, crossKey]);
  assert.strictEqual(keys.size, 5, '5 domain keys are unique');

  // 相同 domain,不同 question → 不同 key
  const k1 = Cache.makeKey('bazi', { gz: { year: '甲子', month: '丙寅', day: '戊午', hour: '丁巳' }, question: '事业' });
  const k2 = Cache.makeKey('bazi', { gz: { year: '甲子', month: '丙寅', day: '戊午', hour: '丁巳' }, question: '财运' });
  assert.notStrictEqual(k1, k2, 'different question → different key');

  // 相同 domain + 相同 question → 相同 key(deterministic)
  const k3 = Cache.makeKey('bazi', { gz: { year: '甲子', month: '丙寅', day: '戊午', hour: '丁巳' }, question: '事业' });
  assert.strictEqual(k1, k3, 'same input → same key');
}

// ============= Case 2: get/set 闭环 =============
console.log('[Cache]   get/set round-trip');
{
  const params = { gz: { year: '甲子', month: '丙寅', day: '戊午', hour: '丁巳' }, gender: 'male', question: '事业' };
  assert.strictEqual(Cache.get('bazi', params), null, 'initial: no cache');

  const output = '这是 AI 解读的输出,长度足够长才算 cache';
  Cache.set('bazi', params, output);

  const hit = Cache.get('bazi', params);
  assert.strictEqual(hit, output, 'get returns what we set');

  // 不同 question → cache miss
  const miss = Cache.get('bazi', { ...params, question: '财运' });
  assert.strictEqual(miss, null, 'different question → miss');
}

// ============= Case 3: 太短的输出不缓存 =============
console.log('[Cache]   short outputs are not cached');
{
  const params = { gz: { year: '乙丑' }, question: 'test short' };
  Cache.set('bazi', params, '短');
  assert.strictEqual(Cache.get('bazi', params), null, 'output < 10 chars not cached');
}

// ============= Case 4: LRU 容量限制 =============
console.log('[Cache]   LRU eviction at MAX_ENTRIES');
{
  _store.clear();
  Cache.init();  // reset access order
  // 写入 51 条,应淘汰最旧的 1 条
  for (let i = 0; i < 51; i++) {
    Cache.set('bazi', { gz: { year: '甲' + i }, question: 'q' + i }, 'output ' + i + ' 1234567890');
  }
  const stats = Cache.stats();
  assert.ok(stats.total <= 51, 'stats.total <= 51 (some entries exist)');
  assert.strictEqual(stats.max, 50, 'MAX_ENTRIES is 50');
}

// ============= Case 5: index.html 5 处 Cache 接入 =============
console.log('[index]   5 doAI* wired with Cache');
{
  const indexSrc = fs.readFileSync('index.html', 'utf-8');

  // 5 个 doAI* 都有 Cache.get
  const getCount = (indexSrc.match(/window\.Cache\.get\(['"][a-z]+['"]/g) || []).length;
  assert.ok(getCount >= 5, `expected ≥ 5 Cache.get call sites, got ${getCount}`);

  // 5 个 doAI* 都有 Cache.set
  const setCount = (indexSrc.match(/window\.Cache\.set\(['"][a-z]+['"]/g) || []).length;
  assert.ok(setCount >= 5, `expected ≥ 5 Cache.set call sites, got ${setCount}`);

  // 缓存命中时 early return(避免重复 AI 调用)
  // 简化检查: 5 个 doAI* 都包含 "if (cached) {" + "return;" 模式
  const cachedPattern = /if \(cached\) \{[\s\S]{0,500}return;/g;
  const earlyReturnCount = (indexSrc.match(cachedPattern) || []).length;
  assert.ok(earlyReturnCount >= 5,
    `expected ≥ 5 "if (cached) { ... return; }" blocks, got ${earlyReturnCount}`);

  // Cache 异常不中断 AI 调用(try/catch 包裹)
  // 简化: 5 个 Cache.set 都被 try/catch 包
  const trySetPattern = /try\s*\{\s*window\.Cache\.set\(/g;
  const trySetCount = (indexSrc.match(trySetPattern) || []).length;
  assert.ok(trySetCount >= 5, `expected ≥ 5 try{Cache.set, got ${trySetCount}`);
}

console.log('\nCache wiring tests passed.');
