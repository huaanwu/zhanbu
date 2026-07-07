/**
 * 测试 Core.AI.interpret() 的存在性与基础签名
 * 注意:interpret() 是浏览器 only(用 window.* + EventBus),这里只验证模块结构
 */
const fs = require('fs');
const path = require('path');

// 在 Node 环境跑,挂 window/document 桩
global.window = {
  EventBus: { dispatchEvent: () => {} },
  CoreEvents: { AI_START: 'ai:start', AI_CHUNK: 'ai:chunk', AI_COMPLETE: 'ai:complete', AI_ERROR: 'ai:error' },
  Core: { Stream: { showStreamIndicator: () => {}, hideStreamIndicator: () => {} }, Toast: { showToast: () => {} } },
  Cache: null, // 测试时 Cache 不可用,走非缓存分支
};
global.document = { addEventListener: () => {}, removeEventListener: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.AbortController = class { constructor() { this.signal = {}; } abort() {} };
global.fetch = async () => ({ ok: false });
global.CustomEvent = class { constructor(name, opts) { this.detail = opts?.detail; } };

const code = fs.readFileSync(path.join(__dirname, 'core', 'ai-service.js'), 'utf8');
// IIFE 立即执行,挂到 window.Core.AI
eval(code);

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.error(`  ✗ ${label}`); fail++; }
}

console.log('=== Core.AI.interpret() 基础测试 ===');
assert(global.window.Core?.AI?.interpret, 'Core.AI.interpret 已暴露');
assert(typeof global.window.Core.AI.callDeepSeek === 'function', 'Core.AI.callDeepSeek 仍是函数');
assert(typeof global.window.Core.AI.readSSE === 'function', 'Core.AI.readSSE 仍是函数');
assert(typeof global.window.Core.AI.stripThinking === 'function', 'Core.AI.stripThinking 仍是函数');
assert(typeof global.window.Core.AI.getLocalServerUrl === 'function', 'Core.AI.getLocalServerUrl 已暴露');
assert(typeof global.window.Core.AI.getLocalServerIp === 'function', 'Core.AI.getLocalServerIp 已暴露');
assert(typeof global.window.Core.AI.getLocalServerPort === 'function', 'Core.AI.getLocalServerPort 已暴露');

// 校验 interpret 拒绝缺参
(async () => {
  try {
    await global.window.Core.AI.interpret({});
    assert(false, 'interpret() 空 opts 应该 throw');
  } catch (e) {
    assert(/domain|prompt/.test(e.message), `interpret() 缺 domain+prompt throw:${e.message}`);
  }

  console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`);
  console.log(`Total: ${pass + fail}  Pass: ${pass}  Fail: ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();