/**
 * crypto.js + History 加密集成测试
 * v1.4 敏感数据加密
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

// ===== 加载 Crypto =====
runner.module('crypto.js - AES-GCM 加密');

runner.test('模块暴露', function() {
  // 模拟浏览器 localStorage + window
  var store = {};
  globalThis.localStorage = {
    getItem: function(k) { return store[k]; },
    setItem: function(k, v) { store[k] = v; },
    removeItem: function(k) { delete store[k]; }
  };
  globalThis.window = {};
  // 模拟 Web Crypto API (Node 18+)
  globalThis.crypto = require('crypto').webcrypto;

  var code = fs.readFileSync('crypto.js', 'utf-8');
  eval(code);
  runner.assert(window.Crypto, 'Crypto 模块未挂载');
  runner.assert(typeof window.Crypto.encrypt === 'function', 'encrypt 函数');
  runner.assert(typeof window.Crypto.decrypt === 'function', 'decrypt 函数');
});

runner.test('加密 → 解密 还原原文', async function() {
  // (在模块暴露测试后,继续用同一个 Crypto 实例)
  return (async function() {
    var plain = '1990-01-01 12:00 男 庚子 甲子 壬午';
    var cipher = await window.Crypto.encrypt(plain);
    runner.assert(cipher.startsWith('enc:v1:'), '密文应有前缀 enc:v1:');
    runner.assert(cipher !== plain, '密文不应等于原文');
    var back = await window.Crypto.decrypt(cipher);
    runner.assertEq(back, plain, '解密应还原原文');
  })();
});

runner.test('同密钥两次加密输出不同(IV随机)', async function() {
  return (async function() {
    var plain = '同一原文';
    var c1 = await window.Crypto.encrypt(plain);
    var c2 = await window.Crypto.encrypt(plain);
    runner.assert(c1 !== c2, '两次加密应输出不同密文(IV 随机)');
    runner.assertEq(await window.Crypto.decrypt(c1), plain, 'c1 可解');
    runner.assertEq(await window.Crypto.decrypt(c2), plain, 'c2 可解');
  })();
});

runner.test('明文输入原样返回(非字符串降级)', async function() {
  return (async function() {
    runner.assertEq(await window.Crypto.encrypt(null), null, 'null 不加密');
    runner.assertEq(await window.Crypto.encrypt(''), '', '空串不加前缀');
    runner.assertEq(await window.Crypto.decrypt('普通文本'), '普通文本', '非密文直通');
  })();
});

runner.test('加密对象 (深拷贝)', async function() {
  return (async function() {
    var obj = {
      year: '庚子', day: '甲子', question: '我的事业',
      nested: { gz: { hour: '壬午' } },
      arr: ['1990-01-01', '男']
    };
    var enc = await window.Crypto.encryptObject(obj);
    runner.assert(enc.year.startsWith('enc:v1:'), 'year 应加密');
    runner.assert(enc.question.startsWith('enc:v1:'), 'question 应加密');
    runner.assert(enc.nested.gz.hour.startsWith('enc:v1:'), 'nested.gz.hour 应加密');
    runner.assert(enc.arr[0].startsWith('enc:v1:'), '数组项应加密');
    // 解密还原
    var back = await window.Crypto.decryptObject(enc);
    runner.assertEq(back.year, obj.year, 'year 还原');
    runner.assertEq(back.nested.gz.hour, obj.nested.gz.hour, 'nested 还原');
    runner.assertEq(back.arr[0], obj.arr[0], 'arr 还原');
  })();
});

runner.test('密钥在 localStorage 持久化', function() {
  var key = localStorage.getItem('divination_crypto_key_v1');
  runner.assert(key && key.length > 30, 'localStorage 存了 base64 密钥');
});

runner.run();
