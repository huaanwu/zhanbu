/**
 * test_bug_fixes.js
 *
 * 锁定 4 个 silent bug 的修复(2026-06-28 v1.3.0+):
 *   A:  expert.js:605  y.idx → y.yao - 1
 *   A.2:expert.js:1093/1254  isShi/isYing 改用 SHI_YING+GUA_FULL_TO_SHORT 推导
 *   B:  expert.js:1115 + test_inline.html:1302  pan.wuge → pan.wuge || pan
 *   C:  expert.js:99/102  NAYIN 4 处 砂 → 沙
 *
 * 纯 Node 测试,与 test_accuracy.js 同模式(eval 源码到 globalThis)。
 * 跑法: node www/test_bug_fixes.js
 */

process.chdir(__dirname);
const fs = require('fs');
const assert = require('node:assert');

globalThis.window = {};
eval(fs.readFileSync('liuyao.js', 'utf-8'));
eval(fs.readFileSync('xingshi.js', 'utf-8'));
eval(fs.readFileSync('expert.js', 'utf-8'));

const { liuyao, Xingshi } = globalThis.window;
const expSrc = fs.readFileSync('expert.js', 'utf-8');
const inlineSrc = fs.readFileSync('test_inline.html', 'utf-8');

// ============= Bug A: y.idx → y.yao - 1 =============
console.log('[Bug A]   dongYaoList yao.yao-1 indexes bianYaoList correctly');
{
  // Source-level: the bug-shape pattern must be gone
  assert.ok(
    /pan\.bianYaoList\[y\.yao - 1\]/.test(expSrc),
    'A: source must use y.yao - 1'
  );
  assert.ok(
    !/pan\.bianYaoList\[y\.idx\]/.test(expSrc),
    'A: y.idx pattern must be gone'
  );

  // Behavior: simulate the loop with a 1-based yao and a present bian entry
  const dongYl = { yao: 3, zhi: '寅', wuxing: '木' };
  const pan = {
    bianYaoList: [
      null, null,
      { zhi: '卯', wuxing: '木' }, // index 2 = yao 3 - 1
      null, null, null
    ]
  };
  // Fixed access: pan.bianYaoList[y.yao - 1] === pan.bianYaoList[2]
  assert.strictEqual(
    pan.bianYaoList[dongYl.yao - 1].zhi, '卯',
    'A: bianYaoList[yao-1] must reach the bian entry'
  );

  // Buggy access would yield undefined
  assert.strictEqual(
    pan.bianYaoList[dongYl.idx], undefined,
    'A: pan.bianYaoList[idx] was undefined (the original bug)'
  );
}

// ============= Bug A.2: shi/ying via SHI_YING + GUA_FULL_TO_SHORT =============
console.log('[Bug A.2] SHI_YING + GUA_FULL_TO_SHORT derives shi/ying correctly');
{
  // Source-level: the buggy .find(y => y.isShi) pattern must be gone
  assert.ok(
    !/yaoList\.find\(y\s*=>\s*y\.isShi\)/.test(expSrc),
    'A.2: yaoList.find(y => y.isShi) must be gone'
  );
  assert.ok(
    !/yaoList\.find\(y\s*=>\s*y\.isYing\)/.test(expSrc),
    'A.2: yaoList.find(y => y.isYing) must be gone'
  );

  // Real liuyao pan: SHI_YING lookup must yield valid shi/ying
  const panReal = liuyao.panGua('time', { dt: new Date(2026, 5, 28, 10, 0) });
  assert.ok(panReal && panReal.gua && panReal.yaoList, 'panReal shape');
  const shortName =
    GUA_FULL_TO_SHORT[panReal.gua.name] ||
    (panReal.gua.name && panReal.gua.name[0]) ||
    panReal.gua.name;
  assert.ok(shortName, 'shortName resolves');
  const sy = SHI_YING[shortName];
  assert.ok(sy && sy.shi >= 1 && sy.shi <= 6, 'A.2: SHI_YING.shi in 1..6');
  assert.ok(sy.ying >= 1 && sy.ying <= 6, 'A.2: SHI_YING.ying in 1..6');
  assert.strictEqual(
    panReal.yaoList[sy.shi - 1].yao, sy.shi,
    'A.2: yaoList[shi-1].yao === shi'
  );
  assert.strictEqual(
    panReal.yaoList[sy.ying - 1].yao, sy.ying,
    'A.2: yaoList[ying-1].yao === ying'
  );
}

// ============= Bug B: pan.wuge → pan.wuge || pan =============
console.log('[Bug B]   xingshi flat fields reachable via pan.wuge || pan');
{
  // Source-level: expert.js
  assert.ok(
    /const ge = pan\.wuge \|\| pan;/.test(expSrc),
    'B: expert.js must use pan.wuge || pan'
  );

  // Mirror: test_inline.html
  assert.ok(
    /const ge = pan\.wuge \|\| pan;/.test(inlineSrc),
    'B: test_inline.html mirror must also be fixed'
  );

  // Behavior: xingshi returns flat fields
  const xs = Xingshi.calculateGege('李', '明');
  assert.ok(xs && xs.tiange && xs.renge && xs.dige && xs.waige && xs.zongge,
    'B: xingshi.calculateGege returns flat fields');
  const ge = xs.wuge || xs;
  assert.strictEqual(ge.tiange, xs.tiange, 'B: ge.tiange reachable without wrapper');
  assert.strictEqual(ge.renge, xs.renge, 'B: ge.renge reachable without wrapper');

  // Buggy: ge = pan.wuge || {} would give undefined for all
  const geBuggy = xs.wuge || {};
  assert.strictEqual(geBuggy.tiange, undefined,
    'B: pre-fix path gave undefined for tiange');
}

// ============= Bug C: NAYIN 砂 → 沙 (4 entries) =============
console.log('[Bug C]   NAYIN_60JIAZI canonicalizes to 沙 for 甲午/乙未/丙辰/丁巳');
{
  assert.strictEqual(NAYIN_60JIAZI['甲午'], '沙中金', 'C: 甲午 = 沙中金');
  assert.strictEqual(NAYIN_60JIAZI['乙未'], '沙中金', 'C: 乙未 = 沙中金');
  assert.strictEqual(NAYIN_60JIAZI['丙辰'], '沙中土', 'C: 丙辰 = 沙中土');
  assert.strictEqual(NAYIN_60JIAZI['丁巳'], '沙中土', 'C: 丁巳 = 沙中土');

  // Source-level: no 砂 left in NAYIN list block
  const listStart = expSrc.indexOf("const nayinList = [");
  assert.ok(listStart > 0, 'C: nayinList found in source');
  const listEnd = expSrc.indexOf("];", listStart);
  const block = expSrc.slice(listStart, listEnd + 2);
  assert.ok(!block.includes('砂'),
    'C: no 砂 must remain in NAYIN list');
  assert.ok(block.includes('沙中金'), 'C: 沙中金 present');
  assert.ok(block.includes('沙中土'), 'C: 沙中土 present');
}

console.log('\nAll bug-fix tests passed.');
