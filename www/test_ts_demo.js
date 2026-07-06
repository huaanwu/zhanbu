/**
 * v2.0.4 演示测试: 验证 .ts 文件能正确编译
 *
 * 由于 Node 不能直接 import .ts (没有 ts-node),我们用 esbuild 转译后 eval
 */
process.chdir(__dirname);
var TR = require('./test_comprehensive.js');
var runner = new TR();
var fs = require('fs');

runner.module('TypeScript 迁移演示 (.ts)');

runner.test('monthGanzhi 基础功能', function() {
  // 用 esbuild 转译 .ts → .js
  var esbuild;
  try {
    esbuild = require('esbuild');
  } catch (e) {
    runner.assert(false, '需要装 esbuild: npm i -D esbuild');
    return;
  }
  var ts = fs.readFileSync('utils/date-helpers.ts', 'utf-8');
  var result = esbuild.transformSync(ts, { loader: 'ts', format: 'cjs' });
  runner.assert(result.code.length > 0, '.ts 转译成功');

  // CJS 输出用 module.exports
  var module = { exports: {} };
  var fn = new Function('module', 'exports', result.code);
  fn(module, module.exports);
  var exports = module.exports;

  runner.assert(typeof exports.monthGanzhi === 'function', 'monthGanzhi 导出');
  var gz = exports.monthGanzhi(2026, 1);
  runner.assert(gz.tiangan === '庚', '2026年1月天干 = 庚');
  runner.assert(gz.dizhi === '寅', '2026年1月地支 = 寅');
});

runner.test('formatDateTime 格式化', function() {
  var esbuild = require('esbuild');
  var ts = fs.readFileSync('utils/date-helpers.ts', 'utf-8');
  var result = esbuild.transformSync(ts, { loader: 'ts', format: 'cjs' });
  var module = { exports: {} };
  var fn = new Function('module', 'exports', result.code);
  fn(module, module.exports);
  var exports = module.exports;

  var s = exports.formatDateTime(new Date(2026, 6, 6, 14, 30));
  runner.assert(s === '2026年7月6日 14:30', '格式化: ' + s);
});

runner.test('isSameDay 同日判断', function() {
  var esbuild = require('esbuild');
  var ts = fs.readFileSync('utils/date-helpers.ts', 'utf-8');
  var result = esbuild.transformSync(ts, { loader: 'ts', format: 'cjs' });
  var module = { exports: {} };
  var fn = new Function('module', 'exports', result.code);
  fn(module, module.exports);
  var exports = module.exports;

  runner.assertEq(exports.isSameDay(new Date(2026, 6, 6), new Date(2026, 6, 6, 23, 59)), true, '同日');
  runner.assertEq(exports.isSameDay(new Date(2026, 6, 6), new Date(2026, 6, 7)), false, '不同日');
});

runner.run();
