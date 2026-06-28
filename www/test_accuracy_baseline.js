/**
 * test_accuracy_baseline.js
 *
 * 占卜准确率基线 v1 — 离线评测 4 个 Expert.<domain>() 函数的事实命中率。
 * 来源题库: tests/fixtures/accuracy_baseline.json (30 题, bazi:10 / liuyao:8 / ziwei:6 / qimen:6)
 *
 * 评分:
 *   - fact 层: keywords 在 Expert 输出中出现的比例
 *   - judgment 层: 简易方向匹配 (用正/负向关键词计数判 吉/中/凶)
 *   - per-question: normalized = (fact_score + judgment_score) / max_score
 *   - pass 阈值: >= 0.6
 *
 * 输出:
 *   - stdout: PASS/FAIL 列表 + 摘要
 *   - tests/fixtures/accuracy_baseline_report.json (结构化)
 *   - tests/fixtures/accuracy_baseline_report.md (可读)
 *
 * 跑法: node www/test_accuracy_baseline.js
 */

process.chdir(__dirname);
const fs = require('fs');
const path = require('path');
const assert = require('node:assert');

// ============= 加载运行环境 =============
// 用 vm.createContext 隔离 var 声明,避免重复 eval 报 SyntaxError
const vm = require('vm');
const ctx = vm.createContext({ window: {}, console, fs });
const LIUYAO_OK = (() => { try { vm.runInContext(fs.readFileSync('liuyao.js', 'utf-8'), ctx); return true; } catch(e) { console.error('liuyao.js load fail:', e.message); return false; }})();
const QIMEN_OK  = (() => { try { vm.runInContext(fs.readFileSync('qimen.js',  'utf-8'), ctx); return true; } catch(e) { console.error('qimen.js load fail:', e.message);  return false; }})();
vm.runInContext(fs.readFileSync('expert.js', 'utf-8'), ctx);
vm.runInContext(fs.readFileSync('xingshi.js', 'utf-8'), ctx);

const { liuyao, qimen } = ctx.window;
// 把 liuyao/qimen 也挂到 ctx,这样 vm.runInContext 里能直接引用
ctx.liuyao = liuyao;
ctx.qimen = qimen;
// 不解构 Expert — 始终从 ctx.window 取,保证 `this` 绑定到 vm context
function getExpert() { return ctx.window.Expert; }

// ============= 加载题库 =============
const FIXTURE_PATH = path.join(__dirname, 'tests', 'fixtures', 'accuracy_baseline.json');
const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')).fixtures;

// ============= 评分工具 =============

// 简易方向匹配:统计正/负向词
const POS_WORDS = ['吉', '旺', '相', '得令', '有力', '比和', '长生', '帝旺', '临官', '冠带', '主吉', '喜'];
const NEG_WORDS = ['凶', '衰', '死', '囚', '墓', '绝', '病', '胎', '养', '主凶', '冲', '忌'];
function detectDirection(output) {
  const pos = POS_WORDS.filter(w => output.includes(w)).length;
  const neg = NEG_WORDS.filter(w => output.includes(w)).length;
  if (pos > neg) return '吉';
  if (neg > pos) return '凶';
  return '中';
}

function scoreFixture(fx, output) {
  const rubric = fx.scoring_rubric || { fact_match_required: 5, fact_match_partial: 1, judgment_match: 2 };
  const keywords = fx.fact_keywords || [];

  // Fact 评分
  const hits = keywords.filter(kw => output.includes(kw));
  const hitRate = keywords.length ? hits.length / keywords.length : 0;
  const factScore = hitRate * rubric.fact_match_required;
  const missing = keywords.filter(kw => !output.includes(kw));

  // Judgment 评分(可选)
  let judgmentScore = 0;
  let judgmentMatch = null;
  if (fx.ground_truth_judgment && fx.ground_truth_judgment.direction) {
    const detected = detectDirection(output);
    judgmentMatch = detected;
    if (detected === fx.ground_truth_judgment.direction) {
      judgmentScore = rubric.judgment_match;
    }
  }

  const maxScore = rubric.fact_match_required + (rubric.judgment_match || 0);
  const rawScore = factScore + judgmentScore;
  const normalized = maxScore > 0 ? rawScore / maxScore : 1.0;

  return {
    fact_keywords_hit: hits,
    fact_keywords_missing: missing,
    fact_hit_rate: hitRate,
    fact_score: factScore,
    judgment_match: judgmentMatch,
    judgment_score: judgmentScore,
    raw_score: rawScore,
    max_score: maxScore,
    normalized,
  };
}

// ============= 构造 input (处理 input_loader) =============
function resolveInput(fx) {
  if (fx.input_loader) {
    if (!LIUYAO_OK || !QIMEN_OK) {
      throw new Error('liuyao.js / qimen.js load failed; cannot resolve input_loader');
    }
    if (/^liuyao\.panGua\(/.test(fx.input_loader)) {
      const fn = new Function('liuyao', `return (${fx.input_loader})`);
      return fn(liuyao);
    }
    if (/^qimen\.panQimen\(/.test(fx.input_loader)) {
      const fn = new Function('qimen', `return (${fx.input_loader})`);
      return fn(qimen);
    }
    throw new Error(`Unknown input_loader domain: ${fx.input_loader}`);
  }
  return fx.input;
}

// ============= 主循环 =============
const PASS_THRESHOLD = 0.6;
const domainStats = {};
const perFixture = [];
let passCount = 0;
let failCount = 0;

fixtures.forEach(fx => {
  let output = '';
  let err = null;
  const fnName = ({ bazi:'bazi', liuyao:'liuyao', ziwei:'ziwei', qimen:'qimen' })[fx.domain];
  try {
    let vmCode;
    if (fx.input_loader) {
      vmCode = `Expert.${fnName}((${fx.input_loader}))`;
    } else {
      vmCode = `Expert.${fnName}(${JSON.stringify(fx.input)})`;
    }
    output = vm.runInContext(vmCode, ctx);
    if (typeof output !== 'string') throw new Error(`Expert.${fx.domain} returned non-string: ${typeof output}`);
    if (!output) throw new Error(`Expert.${fx.domain} returned empty string`);
  } catch (e) {
    err = e.message;
  }

  const status = err ? 'ERROR' : 'PENDING';
  let score = null;
  if (!err) {
    score = scoreFixture(fx, output);
    const passed = score.normalized >= PASS_THRESHOLD;
    if (passed) passCount++;
    else failCount++;
    const tag = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${tag}  ${fx.id}  [${fx.domain}/${fx.category}/${fx.difficulty}]  norm=${score.normalized.toFixed(2)}  ${err ? 'err='+err : ''}`);
    if (!passed && score.fact_keywords_missing.length > 0) {
      console.log(`         missing: ${score.fact_keywords_missing.join(', ')}`);
    }
  } else {
    failCount++;
    console.log(`✗ ERROR ${fx.id}  [${fx.domain}/${fx.category}]  ${err}`);
  }

  // 累计 domain 统计
  if (!domainStats[fx.domain]) domainStats[fx.domain] = { total: 0, pass: 0, sum_norm: 0, scores: [] };
  domainStats[fx.domain].total++;
  if (score && score.normalized >= PASS_THRESHOLD) {
    domainStats[fx.domain].pass++;
    domainStats[fx.domain].sum_norm += score.normalized;
    domainStats[fx.domain].scores.push(score.normalized);
  }

  perFixture.push({
    id: fx.id,
    domain: fx.domain,
    category: fx.category,
    difficulty: fx.difficulty,
    question_text: fx.question_text,
    output_excerpt: err ? '' : output.slice(0, 200),
    output_length: err ? 0 : output.length,
    error: err,
    ...(score || {}),
  });
});

// ============= 汇总报告 =============
const overall = {
  total: fixtures.length,
  pass: passCount,
  fail: failCount,
  pass_rate: (passCount / fixtures.length).toFixed(3),
  mean_norm: perFixture.filter(f => f.normalized != null)
    .reduce((s, f) => s + f.normalized, 0) / fixtures.length,
};
const perDomain = {};
Object.entries(domainStats).forEach(([d, s]) => {
  perDomain[d] = {
    total: s.total,
    pass: s.pass,
    pass_rate: (s.pass / s.total).toFixed(3),
    mean_norm: s.scores.length ? (s.sum_norm / s.total).toFixed(3) : 0,
  };
});

const report = {
  generated_at: new Date().toISOString(),
  version: '1.0',
  pass_threshold: PASS_THRESHOLD,
  overall,
  per_domain: perDomain,
  fixtures: perFixture,
};

// 写 JSON 报告
const reportJsonPath = path.join(__dirname, 'tests', 'fixtures', 'accuracy_baseline_report.json');
fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf-8');

// 写 Markdown 报告
const md = [];
md.push('# 占卜事实层准确率基线 v1 — ' + report.generated_at);
md.push('');
md.push(`**总览**: ${overall.total} 题, 通过 ${overall.pass}, 失败 ${overall.fail}, 通过率 ${overall.pass_rate}, 平均归一化分 ${overall.mean_norm.toFixed(3)}`);
md.push('');
md.push('## 按 domain 分组');
md.push('');
md.push('| domain | 总数 | 通过 | 通过率 | 平均分 |');
md.push('|--------|------|------|--------|--------|');
Object.entries(perDomain).forEach(([d, s]) => {
  md.push(`| ${d} | ${s.total} | ${s.pass} | ${s.pass_rate} | ${s.mean_norm} |`);
});
md.push('');
md.push('## 待修复 (norm < 0.6)');
md.push('');
const failed = perFixture.filter(f => f.normalized != null && f.normalized < PASS_THRESHOLD);
if (failed.length === 0) {
  md.push('无');
} else {
  md.push('| id | domain | 缺失关键词 |');
  md.push('|-----|--------|-----------|');
  failed.forEach(f => {
    md.push(`| ${f.id} | ${f.domain} | ${(f.fact_keywords_missing || []).join(', ')} |`);
  });
}
md.push('');
md.push('## 全量明细');
md.push('');
md.push('| id | domain | category | difficulty | norm | judgment |');
md.push('|-----|--------|----------|------------|------|----------|');
perFixture.forEach(f => {
  md.push(`| ${f.id} | ${f.domain} | ${f.category} | ${f.difficulty} | ${f.normalized != null ? f.normalized.toFixed(2) : 'ERR'} | ${f.judgment_match || '-'} |`);
});
const reportMdPath = path.join(__dirname, 'tests', 'fixtures', 'accuracy_baseline_report.md');
fs.writeFileSync(reportMdPath, md.join('\n'), 'utf-8');

console.log('');
console.log('======================================');
console.log(`  通过 ${passCount} / 失败 ${failCount}  通过率 ${overall.pass_rate}`);
console.log(`  报告: ${reportJsonPath}`);
console.log(`        ${reportMdPath}`);
console.log('======================================');

// Exit code: 有任何 ERROR 或 norm<0.6 失败则 1
process.exit(failCount > 0 ? 1 : 0);
