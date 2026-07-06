/**
 * chat.js - 多轮对话会话存储测试
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

runner.module('chat.js - 多轮对话会话');

// ===== 模拟浏览器环境 =====
var store = {};
globalThis.localStorage = {
  getItem: function(k) { return store[k]; },
  setItem: function(k, v) { store[k] = v; },
  removeItem: function(k) { delete store[k]; }
};
globalThis.window = {};
globalThis.crypto = require('crypto').webcrypto;

// 先加载 Crypto (chat 依赖)
var cryptoCode = fs.readFileSync('crypto.js', 'utf-8');
eval(cryptoCode);
// 再加载 chat
var chatCode = fs.readFileSync('chat.js', 'utf-8');
eval(chatCode);

runner.test('模块暴露', function() {
  runner.assert(window.ChatSession, 'ChatSession 已挂载');
  runner.assert(typeof window.ChatSession.push === 'function', 'push 函数');
  runner.assert(typeof window.ChatSession.clear === 'function', 'clear 函数');
});

runner.test('初始状态各域为空', function() {
  runner.assertEq(window.ChatSession.size('bazi'), 0, 'bazi 初始 0');
  runner.assertEq(window.ChatSession.size('ziwei'), 0, 'ziwei 初始 0');
  runner.assertEq(window.ChatSession.size('liuyao'), 0, 'liuyao 初始 0');
});

runner.test('push 追加 Q&A', async function() {
  return (async function() {
    await window.ChatSession.push('bazi', '我的事业运势如何?', '根据八字分析,你今年事业...');
    runner.assertEq(window.ChatSession.size('bazi'), 1, 'push 后 size=1');
    await window.ChatSession.push('bazi', '哪个月最好?', '农历三月最佳...');
    runner.assertEq(window.ChatSession.size('bazi'), 2, 'push 第二次后 size=2');
  })();
});

runner.test('getAllDecrypted 自动解密', async function() {
  return (async function() {
    const arr = await window.ChatSession.getAllDecrypted('bazi');
    runner.assertEq(arr.length, 2, '2 条记录');
    runner.assertEq(arr[0].q, '我的事业运势如何?', '第 1 条问题');
    runner.assert(arr[0].a.indexOf('根据八字分析') >= 0, '第 1 条回答已解密');
    runner.assertEq(arr[1].q, '哪个月最好?', '第 2 条问题');
    runner.assert(arr[1].a.indexOf('农历三月') >= 0, '第 2 条回答已解密');
  })();
});

runner.test('跨域独立', function() {
  runner.assertEq(window.ChatSession.size('bazi'), 2, 'bazi 仍是 2');
  runner.assertEq(window.ChatSession.size('ziwei'), 0, 'ziwei 是 0');
});

runner.test('LRU 淘汰 (MAX_PER_DOMAIN=20)', async function() {
  return (async function() {
    // 清空测试
    window.ChatSession.clear('test_domain');
    // push 25 条
    for (let i = 0; i < 25; i++) {
      await window.ChatSession.push('test_domain', 'Q' + i, 'A' + i);
    }
    const arr = await window.ChatSession.getAllDecrypted('test_domain');
    runner.assertEq(arr.length, 20, '只保留 20 条');
    runner.assertEq(arr[0].q, 'Q5', '最早的 5 条被淘汰');
    runner.assertEq(arr[19].q, 'Q24', '最后一条保留');
  })();
});

runner.test('clear 单域', async function() {
  return (async function() {
    window.ChatSession.clear('bazi');
    runner.assertEq(window.ChatSession.size('bazi'), 0, 'bazi 已清空');
    runner.assertEq(window.ChatSession.size('test_domain'), 20, 'test_domain 不受影响');
  })();
});

runner.test('clear(null) 清空所有域', function() {
  window.ChatSession.clear(null);
  runner.assertEq(window.ChatSession.size('bazi'), 0);
  runner.assertEq(window.ChatSession.size('test_domain'), 0);
});

runner.test('localStorage 持久化', function() {
  var raw = localStorage.getItem('divination_chat_v1');
  runner.assert(raw, 'localStorage 有数据');
  var parsed = JSON.parse(raw);
  runner.assert(typeof parsed === 'object', 'JSON 可解析');
});

runner.run();
