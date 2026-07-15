/**
 * RAG 边界测试 v1.0
 * --------------------------------------------------
 * 覆盖 tokenize / flattenKB / BM25Index / textToVector / rrfFusion 等边界情况
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

runner.module('rag/tokenizer');

globalThis.window = globalThis;  // 让 var/function 顶层声明能被 window.tokenize 访问
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.fetch = () => Promise.reject(new Error('fetch not available in test'));

var code = fs.readFileSync('rag/tokenizer.js', 'utf-8')
  + ';' + fs.readFileSync('rag/bm25.js', 'utf-8')
  + ';' + fs.readFileSync('rag/vector.js', 'utf-8')
  + ';' + fs.readFileSync('rag/rrf.js', 'utf-8');
eval(code);

var tokenize = window.tokenize;
var flattenKB = window.flattenKB;
var STOP_WORDS = window.STOP_WORDS;
var BM25Index = window.BM25Index;
var textToVector = window.textToVector;
var rrfFusion = window.rrfFusion;

// ========== tokenize 边界 ==========
runner.test('tokenize: 空字符串返回空数组', function() {
  var t = tokenize('');
  runner.assert(Array.isArray(t) && t.length === 0, 'empty -> []');
});

runner.test('tokenize: null/undefined 不抛错', function() {
  var t1 = tokenize(null);
  var t2 = tokenize(undefined);
  runner.assert(Array.isArray(t1) && t1.length === 0, 'null -> []');
  runner.assert(Array.isArray(t2) && t2.length === 0, 'undefined -> []');
});

runner.test('tokenize: 纯标点被过滤', function() {
  var t = tokenize(String.fromCharCode(65292,12290,65311,65311,12289,65307,65306,8220,8221,8216,8217,65288,65289,65288,65289,12304,12305));
  runner.assert(t.length === 0, 'all-punct -> [], got ' + t.length);
});

runner.test('tokenize: 纯停用词 1-gram 被过滤, 2/3-gram 仍产出', function() {
  var t = tokenize('的了是在');
  var unigrams = t.filter(function(x){return x.n === 1;});
  runner.assertEq(unigrams.length, 0, '1-gram 全过滤');
});

runner.test('tokenize: 1/2/3 元组都生成', function() {
  var t = tokenize('身强木弱用神');
  var hasUnigram = t.some(x => x.n === 1);
  var hasBigram = t.some(x => x.n === 2);
  var hasTrigram = t.some(x => x.n === 3);
  runner.assert(hasUnigram, '1-gram');
  runner.assert(hasBigram, '2-gram');
  runner.assert(hasTrigram, '3-gram');
});

runner.test('STOP_WORDS 包含常用停用词', function() {
  runner.assert(STOP_WORDS.has('的'), '的');
  runner.assert(STOP_WORDS.has('了'), '了');
  runner.assert(STOP_WORDS.has('在'), '在');
});

runner.module('rag/bm25');

runner.test('BM25Index: 空索引搜索不抛错', function() {
  var idx = new BM25Index();
  idx.add([]);
  var r = idx.search('任意查询');
  runner.assert(Array.isArray(r) && r.length === 0, 'empty index -> []');
});

runner.test('BM25Index: 空查询返回空结果', function() {
  var idx = new BM25Index();
  idx.add([{ text: '八字分析日主旺衰', source: 'bazi', path: 'a/1', tags: [], tokens: tokenize('八字分析日主旺衰') }]);
  var r1 = idx.search('');
  var r2 = idx.search('的了在');  // 纯停用词
  runner.assert(Array.isArray(r1) && r1.length === 0, 'empty query');
  runner.assert(Array.isArray(r2) && r2.length === 0, 'all-stopwords query');
});

runner.test('BM25Index: 命中文档按相关度排序', function() {
  var idx = new BM25Index();
  var docs = [
    { text: '日主甲木生于寅月得令', source: 'bazi', path: 'a/1', tags: ['bazi'], tokens: tokenize('日主甲木生于寅月得令') },
    { text: '六爻卦象世爻应爻分析', source: 'liuyao', path: 'b/1', tags: ['liuyao'], tokens: tokenize('六爻卦象世爻应爻分析') },
    { text: '日主甲木身强用神分析', source: 'bazi', path: 'a/2', tags: ['bazi'], tokens: tokenize('日主甲木身强用神分析') }
  ];
  idx.add(docs);
  var r = idx.search('日主甲木身强');
  runner.assert(r.length >= 2, 'at least 2 matches, got ' + r.length);
  runner.assert(r[0].doc.text.indexOf('日主甲木') >= 0, 'top result contains 日主甲木');
});

runner.module('rag/tokenizer - flattenKB');

runner.test('flattenKB: 空 KB 返回空数组', function() {
  var docs = flattenKB({}, 'test_kb');
  runner.assert(Array.isArray(docs) && docs.length === 0, 'empty kb -> []');
});

runner.test('flattenKB: 嵌套 KB 递归提取(>=4 字符)', function() {
  var kb = {
    '章节1': { '1.1': { text: '内容甲详情' }, '1.2': { text: '内容乙详情' } },
    '章节2': { '2.1': { text: '内容丙详情' } }
  };
  var docs = flattenKB(kb, 'test_kb');
  runner.assertEq(docs.length, 3, '3 docs');
  runner.assertEq(docs[0].source, 'test_kb');
  runner.assert(docs.some(function(d){return d.text === '内容甲详情';}));
  runner.assert(docs.some(function(d){return d.text === '内容乙详情';}));
  runner.assert(docs.some(function(d){return d.text === '内容丙详情';}));
});

runner.test('flattenKB: 自动打标签(中文源名)', function() {
  var kb = { 'a': { text: '测试内容文本' } };
  var docs = flattenKB(kb, '八字');  // 源名含中文才能匹配 sourceTags
  runner.assertEq(docs.length, 1);
  runner.assert(Array.isArray(docs[0].tags) && docs[0].tags.indexOf('命理') >= 0, '包含命理');
  runner.assert(docs[0].tags.indexOf('八字') >= 0, '包含八字');
});

runner.module('rag/vector');

runner.test('textToVector: 同输入产生同向量(确定性)', function() {
  var v1 = textToVector('日主甲木身强用神');
  var v2 = textToVector('日主甲木身强用神');
  var same = true;
  for (var i = 0; i < v1.length; i++) {
    if (Math.abs(v1[i] - v2[i]) > 1e-9) { same = false; break; }
  }
  runner.assert(same, 'same input -> same vector');
  runner.assertEq(v1.length, 128, '128 维');
});

runner.test('textToVector: 向量已 L2 归一化', function() {
  var v = textToVector('测试文本');
  var norm = 0;
  for (var i = 0; i < v.length; i++) norm += v[i] * v[i];
  runner.assert(Math.abs(Math.sqrt(norm) - 1) < 1e-6, 'L2 norm ≈ 1, got ' + Math.sqrt(norm));
});

runner.test('textToVector: 空文本不抛错', function() {
  var v = textToVector('');
  runner.assert(v.length === 128, 'still 128-dim, got ' + v.length);
});

runner.module('rag/rrf');

runner.test('rrfFusion: 空数组融合', function() {
  var r1 = rrfFusion([], []);
  runner.assert(Array.isArray(r1) && r1.length === 0, 'empty -> []');
});

runner.test('rrfFusion: 单边结果', function() {
  var bm = [{ doc: { source: 'a', path: 'p', text: 'T1' }, score: 5 }];
  var r = rrfFusion(bm, []);
  runner.assert(r.length === 1, '1 result, got ' + r.length);
  runner.assertEq(r[0].doc.text, 'T1');
});

runner.test('rrfFusion: 两边共同 doc 排在前面', function() {
  var bm = [{ doc: { source: 'a', path: 'p', text: 'COMMON' }, score: 5 }];
  var vec = [{ doc: { source: 'a', path: 'p', text: 'COMMON' }, score: 0.9 }];
  var r = rrfFusion(bm, vec);
  // common doc 收到两边分数, 应排第一
  runner.assertEq(r[0].doc.text, 'COMMON');
});

runner.test('rrfFusion: 文档 ID 用 source+path+text 前 30 字', function() {
  var bm = [{ doc: { source: 'a', path: 'p1', text: 'T1' }, score: 5 }];
  var vec = [{ doc: { source: 'a', path: 'p2', text: 'T1' }, score: 0.9 }];  // 路径不同
  var r = rrfFusion(bm, vec);
  // 视为不同 doc, 不合并
  runner.assertEq(r.length, 2);
});

runner.run();
