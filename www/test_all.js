/**
 * Master test runner - runs all module tests
 */
var cp = require('child_process');
var path = require('path');
var dir = __dirname;

var tests = [
  'test_liuyao.js',
  'test_qimen.js', 
  'test_xingshi.js',
  'test_expert.js',
  'test_visual.js',
  'test_accuracy.js'
];

var totalPass = 0, totalFail = 0, total = 0;

console.log('============================================');
console.log('   AI Divination Master - Full Test Suite   ');
console.log('   ' + new Date().toLocaleString());
console.log('============================================\n');

function runNext(i) {
  if (i >= tests.length) {
    console.log('============================================');
    console.log('   ALL TESTS COMPLETE');
    console.log('   Total: ' + total + '  Pass: ' + totalPass + '  Fail: ' + totalFail);
    var rate = total > 0 ? (totalPass / total * 100).toFixed(1) : 0;
    console.log('   Overall rate: ' + rate + '%');
    console.log('============================================');
    process.exit(totalFail > 0 ? 1 : 0);
    return;
  }
  
  var testFile = path.join(dir, tests[i]);
  console.log('Running: ' + tests[i]);
  console.log('--------------------------------------------');
  
  var child = cp.spawnSync('node', [testFile], {
    cwd: dir,
    encoding: 'utf-8',
    timeout: 30000
  });
  
  // Parse output for stats
  var output = child.stdout || '';
  var stderr = child.stderr || '';
  
  // Extract pass/fail counts
  var passMatch = output.match(/Pass:\s*(\d+)/);
  var failMatch = output.match(/Fail:\s*(\d+)/);
  var totalMatch = output.match(/Total:\s*(\d+)/);
  
  var p = passMatch ? parseInt(passMatch[1]) : 0;
  var f = failMatch ? parseInt(failMatch[1]) : 0;
  var t = totalMatch ? parseInt(totalMatch[1]) : 0;
  
  totalPass += p;
  totalFail += f;
  total += t;
  
  // Show only failure details
  var failedCases = output.match(/x .+\n.*\|_.*/g);
  if (failedCases && failedCases.length > 0) {
    console.log('  FAILURES:');
    for (var j = 0; j < failedCases.length; j++) {
      console.log('    ' + failedCases[j].trim());
    }
  }
  
  var status = child.status === 0 ? 'PASS' : 'FAIL';
  console.log('  Result: ' + status + ' (' + p + '/' + t + ' passed)\n');
  
  if (stderr && stderr.trim()) {
    console.log('  [stderr]: ' + stderr.trim().split('\n').slice(0, 3).join('\n'));
  }
  
  runNext(i + 1);
}

runNext(0);
