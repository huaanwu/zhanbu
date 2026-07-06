/**
 * AI占卜大师 综合测试运行器 (Node.js)
 */
const fs = require('fs');

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
    this.currentModule = '';
  }

  module(name) { this.currentModule = name; }

  test(name, fn) { this.tests.push({ module: this.currentModule, name, fn }); }

  // async test runner (支持 Promise 返回)
  async _runOne(t) {
    try {
      const result = await t.fn();
      if (result && result.skipped) {
        return { module: t.module, name: t.name, passed: true, skipped: true, detail: result.reason };
      }
      return { module: t.module, name: t.name, passed: true };
    } catch (e) {
      return { module: t.module, name: t.name, passed: false, error: e.message || String(e) };
    }
  }

  async runAsync() {
    const results = [];
    for (const t of this.tests) {
      results.push(await this._runOne(t));
    }
    return results;
  }

  assert(condition, msg) {
    if (!condition) throw new Error(msg || 'assertion failed');
  }

  assertEq(a, b, msg) {
    if (a !== b) throw new Error((msg || 'expected') + ': ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
  }

  assertType(val, type) {
    var t = typeof val;
    if (type === 'array') { if (!Array.isArray(val)) throw new Error('expected array, got ' + t); }
    else if (t !== type) throw new Error('expected type ' + type + ' got ' + t);
  }

  assertHasKeys(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (!(keys[i] in obj)) throw new Error('object missing key: ' + keys[i]);
    }
  }

  skip(reason) { return { skipped: true, reason: reason }; }

  run() {
    // 同步入口 - 内部用 runAsync 等待所有 async test
    var passed = 0, failed = 0, skipped = 0;
    var groups = {};
    var self = this;
    var done = false;
    var exited = false;

    this.runAsync().then(function(results) {
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        if (!groups[r.module]) groups[r.module] = [];
        if (r.skipped) {
          groups[r.module].push({ name: r.name, passed: true, skipped: true, detail: r.detail });
          skipped++;
        } else if (r.passed) {
          groups[r.module].push({ name: r.name, passed: true });
          passed++;
        } else {
          groups[r.module].push({ name: r.name, passed: false, error: r.error });
          failed++;
        }
      }
      self._print(groups, passed, failed, skipped);
      done = true;
      if (!exited) { exited = true; process.exit(failed > 0 ? 1 : 0); }
    });

    // 让出事件循环,等 runAsync 完成
    var checkInterval = setInterval(function() {
      if (done) { clearInterval(checkInterval); return; }
    }, 100);

    // 兜底: 如果 runAsync 1秒内没完成,降级用老逻辑
    setTimeout(function() {
      if (!done && !exited) {
        exited = true;
        // 已经触发 process.exit,这里只是兜底
        clearInterval(checkInterval);
        process.exit(failed > 0 ? 1 : 0);
      }
    }, 10000);
  }

  _print(groups, passed, failed, skipped) {
    var output = '';
    output += '========================================\n';
    output += '   AI Divination Master - Test Suite\n';
    output += '   ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + '\n';
    output += '========================================\n\n';

    var modNames = Object.keys(groups);
    for (var m = 0; m < modNames.length; m++) {
      var mod = modNames[m];
      var cases = groups[mod];
      var p = cases.filter(function(c) { return c.passed; }).length;
      var f = cases.filter(function(c) { return !c.passed; }).length;
      var s = cases.filter(function(c) { return c.skipped; }).length;
      var icon = f === 0 ? 'OK' : 'FAIL';
      output += '  [' + icon + '] ' + mod + ' (' + p + '/' + cases.length + ')\n';

      for (var c = 0; c < cases.length; c++) {
        var tc = cases[c];
        if (tc.skipped) {
          output += '       - ' + tc.name + ' [SKIP: ' + tc.detail + ']\n';
        } else if (tc.passed) {
          output += '       + ' + tc.name + '\n';
        } else {
          output += '       x ' + tc.name + '\n';
          output += '         |_ ' + tc.error + '\n';
        }
      }
      output += '\n';
    }

    output += '========================================\n';
    output += '   Total: ' + (passed + failed + skipped) + '  Pass: ' + passed + '  Fail: ' + failed + '  Skip: ' + skipped + '\n';
    output += '   Rate: ' + (passed / Math.max((passed + failed), 1) * 100).toFixed(1) + '%\n';
    output += '========================================\n';

    console.log(output);
  }
}

module.exports = TestRunner;
