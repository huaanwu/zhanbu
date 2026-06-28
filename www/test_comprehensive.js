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
    var passed = 0, failed = 0, skipped = 0;
    var groups = {};

    for (var i = 0; i < this.tests.length; i++) {
      var t = this.tests[i];
      if (!groups[t.module]) groups[t.module] = [];
      try {
        var result = t.fn();
        if (result && result.skipped) {
          groups[t.module].push({ name: t.name, passed: true, skipped: true, detail: result.reason });
          skipped++;
        } else {
          groups[t.module].push({ name: t.name, passed: true });
          passed++;
        }
      } catch (e) {
        groups[t.module].push({ name: t.name, passed: false, error: e.message || e });
        failed++;
      }
    }

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
    output += '   Total: ' + this.tests.length + '  Pass: ' + passed + '  Fail: ' + failed + '  Skip: ' + skipped + '\n';
    output += '   Rate: ' + (passed / Math.max(this.tests.length - skipped, 1) * 100).toFixed(1) + '%\n';
    output += '========================================\n';
    
    console.log(output);
    process.exit(failed > 0 ? 1 : 0);
  }
}

module.exports = TestRunner;
