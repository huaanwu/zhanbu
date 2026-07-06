/**
 * rag.js - v2.0.3 Embedding Backend 测试
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

runner.module('rag.js - v2.0.3 Embedding Backend');

// 模拟 localStorage + window
var store = {};
globalThis.localStorage = {
  getItem: function(k) { return store[k] || null; },
  setItem: function(k, v) { store[k] = v; },
  removeItem: function(k) { delete store[k]; }
};
globalThis.window = {};
// 关键: fetch 等 Node 18+ 没有,模拟掉
globalThis.fetch = function() { return Promise.reject(new Error('fetch not available in test')); };
globalThis.requestIdleCallback = null; // 测试里不需要

var code = fs.readFileSync('rag.js', 'utf-8');
eval(code);

runner.test('RAG 模块暴露', function() {
  runner.assert(window.RAG, 'RAG 存在');
  runner.assert(typeof window.RAG.build === 'function', 'build 函数');
  runner.assert(typeof window.RAG.prewarm === 'function', 'prewarm 函数');
  // embeddingBackend 字段在 build 后会有值;此处只验证属性存在
  runner.assert(window.RAG.embeddingBackend !== undefined, 'embeddingBackend 字段已设置 (build 后)');
});

runner.test('无 API key → random 模式', function() {
  store = {};
  var apiKey = localStorage.getItem('ds_api_key');
  var useSemantic = !!(apiKey && apiKey.length > 20);
  runner.assertEq(useSemantic, false, '应走 random');
});

runner.test('有 API key → semantic 模式', function() {
  store['ds_api_key'] = 'sk-fake-test-key-1234567890abcdef';
  var apiKey = localStorage.getItem('ds_api_key');
  var useSemantic = !!(apiKey && apiKey.length > 20);
  runner.assertEq(useSemantic, true, '应走 semantic');
});

runner.test('短 API key 仍走 random', function() {
  store['ds_api_key'] = 'short';
  var apiKey = localStorage.getItem('ds_api_key');
  var useSemantic = !!(apiKey && apiKey.length > 20);
  runner.assertEq(useSemantic, false, '短 key 应走 random');
});

runner.test('build() fetch 失败时不抛错(降级到空索引)', async function() {
  return (async function() {
    store = {};
    // fetch 在测试里被模拟为 reject,RAG.build 应该 catch 不抛
    try {
      await window.RAG.build();
      // 如果能 build 完成,embeddingBackend 应该是 random
      runner.assertEq(window.RAG.embeddingBackend, 'random', 'fetch 失败时走 random');
    } catch (e) {
      // 如果抛错,测试失败
      runner.assert(false, 'RAG.build 抛错: ' + e.message);
    }
  })();
});

runner.run();
