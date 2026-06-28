/**
 * test_abtest_wiring.js
 *
 * 锁定 ABTest + fewshot 接通逻辑(2026-06-28 v1.3.0+):
 *   - ABTest.getConfig() 在 3 种状态下的行为:
 *       a) 无 active test → null
 *       b) prompt_v1/v2 → fewshot + chainOfThought 字段
 *       c) rag_v1/v2 → topK + maxChars 字段
 *   - Expert.fewshot 现在接受 domain 参数,按 domain 分发模板
 *   - FEWSHOT_LIUYAO / FEWSHOT_BAZI 常量在 expert.js 中定义
 *
 * 纯 Node 测试(用 stub localStorage),与 test_bug_fixes.js 同模式。
 * 跑法: node www/test_abtest_wiring.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

// Stub localStorage (ABTest 依赖它)
const _store = new Map();
const localStorage = {
  getItem: k => _store.has(k) ? _store.get(k) : null,
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: k => _store.delete(k),
};
globalThis.window = {};
globalThis.localStorage = localStorage;

eval(fs.readFileSync('ab_test.js', 'utf-8'));
const { ABTest } = globalThis.window;

// ============= Case 1: 无 active test → null =============
console.log('[ABTest]   no active test returns null');
{
  _store.clear();
  assert.strictEqual(ABTest.getConfig(), null,
    'no active test: getConfig must return null');
}

// ============= Case 2: prompt_v1 vs prompt_v2 → fewshot/chainOfThought =============
console.log('[ABTest]   prompt_v1/v2 exposes fewshot + chainOfThought');
{
  _store.clear();
  ABTest.start('prompt_test', 'prompt_v1', 'prompt_v2');
  const cfg = ABTest.getConfig();
  assert.ok(cfg && cfg.config, 'has config object');
  assert.ok(['A', 'B'].includes(cfg.variant), 'variant is A or B');
  const promptCfg = cfg.config;
  assert.strictEqual(promptCfg.fewshot, true,
    'prompt_v1/v2 fewshot must be true');
  assert.strictEqual(promptCfg.chainOfThought, true,
    'prompt_v1/v2 chainOfThought must be true');
  // prompt_v2 多一个 scoreEnabled
  if (cfg.variant === 'B') {
    assert.strictEqual(promptCfg.scoreEnabled, true,
      'prompt_v2 scoreEnabled=true');
  } else {
    assert.strictEqual(promptCfg.scoreEnabled, false,
      'prompt_v1 scoreEnabled=false');
  }
}

// ============= Case 3: rag_v1 vs rag_v2 → topK/maxChars =============
console.log('[ABTest]   rag_v1/v2 exposes topK + maxChars');
{
  _store.clear();
  ABTest.start('rag_test', 'rag_v1', 'rag_v2');
  const cfg = ABTest.getConfig();
  assert.ok(cfg && cfg.config, 'has config');
  const ragCfg = cfg.config;
  // rag_v1: topK=8 maxChars=2500; rag_v2: topK=12 maxChars=3500
  if (cfg.variant === 'A') {
    assert.strictEqual(ragCfg.topK, 8, 'rag_v1 topK=8');
    assert.strictEqual(ragCfg.maxChars, 2500, 'rag_v1 maxChars=2500');
  } else {
    assert.strictEqual(ragCfg.topK, 12, 'rag_v2 topK=12');
    assert.strictEqual(ragCfg.maxChars, 3500, 'rag_v2 maxChars=3500');
  }
  assert.strictEqual(ragCfg.sourceBoost, true, 'sourceBoost enabled');
}

// ============= Case 4: Expert.fewshot 按 domain 分发 =============
console.log('[Expert]   fewshot dispatches per domain');
{
  const expSrc = fs.readFileSync('expert.js', 'utf-8');

  // Source-level: fewshot 现在接受 domain 参数
  assert.ok(
    /Expert\.fewshot\s*=\s*function\s*\(\s*domain\s*\)/.test(expSrc),
    'Expert.fewshot must take domain parameter'
  );

  // FEWSHOT_LIUYAO 和 FEWSHOT_BAZI 都定义了
  assert.ok(
    /const FEWSHOT_LIUYAO\s*=/.test(expSrc),
    'FEWSHOT_LIUYAO constant must be defined'
  );
  assert.ok(
    /const FEWSHOT_BAZI\s*=/.test(expSrc),
    'FEWSHOT_BAZI constant must be defined'
  );

  // Behavior: 各 domain 返回不同内容
  // (需要先把 expert.js eval 进来,因为 FEWSHOT_LIUYAO 等是 const 顶层声明)
  _store.clear();
  eval(fs.readFileSync('expert.js', 'utf-8'));
  // window.Expert 已存在(eval 副作用),const 形式的 FEWSHOT_* 直接挂在 globalThis 上
  const ExpertNS = globalThis.window.Expert;

  const liuyaoShot = ExpertNS.fewshot('六爻');
  const baziShot = ExpertNS.fewshot('八字');
  const unknownShot = ExpertNS.fewshot('未知领域');

  assert.ok(liuyaoShot.includes('乾卦'),
    'liuyao fewshot must contain 乾卦 reference');
  assert.ok(baziShot.includes('戊土') || baziShot.includes('庚午'),
    'bazi fewshot must contain 八字 reference');
  assert.strictEqual(liuyaoShot, unknownShot,
    'unknown domain must fall back to FEWSHOT_LIUYAO');
}

// ============= Case 5: index.html 包含 getActiveABConfig + 5 处接入 =============
console.log('[index]    getActiveABConfig + 5 doAI* wired');
{
  const indexSrc = fs.readFileSync('index.html', 'utf-8');

  // helper 定义
  assert.ok(
    /function\s+getActiveABConfig\s*\(/.test(indexSrc),
    'getActiveABConfig helper must be defined'
  );

  // helper 默认 fewshot=true (对齐 prompt_v1 设计意图)
  assert.ok(
    /useFewshot:\s*true/.test(indexSrc),
    'fallback useFewshot must default to true'
  );

  // 5 个 doAI* 都接入了 (用 const abCfg = getActiveABConfig() 计数)
  const callCount = (indexSrc.match(/const\s+abCfg\s*=\s*getActiveABConfig\s*\(\s*\)/g) || []).length;
  assert.ok(callCount >= 5,
    `expected ≥ 5 abCfg call sites, got ${callCount}`);

  // 5 个 Expert.fewshot 调用(每个 doAI* 一处)
  const fewshotCallCount = (indexSrc.match(/Expert\.fewshot\(['"][^'"]+['"]\)/g) || []).length;
  assert.ok(fewshotCallCount >= 5,
    `expected ≥ 5 Expert.fewshot call sites, got ${fewshotCallCount}`);

  // doAICross 有 cap
  assert.ok(
    /Math\.min\(abCfg\.maxChars,\s*2000\)/.test(indexSrc) &&
    /Math\.min\(abCfg\.topK,\s*8\)/.test(indexSrc),
    'doAICross must cap topK<=8 and maxChars<=2000'
  );

  // 旧硬编码应该消失(检查是否还有 topK: 10, maxChars: 2500 这种)
  const staleHardcode = /RAG\.search\([^)]*topK:\s*10,\s*maxChars:\s*2500/.test(indexSrc);
  assert.ok(!staleHardcode,
    'stale topK: 10, maxChars: 2500 hardcode must be gone');
}

console.log('\nABTest wiring tests passed.');
