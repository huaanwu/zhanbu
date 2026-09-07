// 课体不变性验收: 新旧 daliuren.js 对拍, 三传/日柱/时支必须逐位一致(避开冬至窗口)
process.chdir('D:/get/zhanbu/www');
var fs = require('fs');
function load(path) {
  var w = {};
  var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';' + fs.readFileSync(path, 'utf-8');
  var fn = new Function('window', 'globalThis', 'require', 'process', '__dirname', code + ';return window.daliuren;');
  return fn.call(globalThis, w, globalThis, require, process, 'D:/get/zhanbu/www/lib');
}
var dlrNew = load('daliuren.js');
var dlrOld = load(process.env.LOCALAPPDATA.replace(/\\/g, '/') + '/Temp/daliuren_old.js');
var cases = [];
[[2026, 3, 15], [2026, 6, 1], [2026, 9, 7], [2026, 11, 20], [2025, 7, 25]].forEach(function (ymd) {
  [0, 6, 12, 23].forEach(function (h) { cases.push([ymd[0], ymd[1], ymd[2], h]); });
});
var diff = 0;
cases.forEach(function (c) {
  var dt = new Date(c[0], c[1] - 1, c[2], c[3], 30, 0);
  var a = dlrNew.paiKe('time', { dt: dt }), b = dlrOld.paiKe('time', { dt: dt });
  var ka = a.dayGZ + a.hourZhi + a.sanChuan.map(function (x) { return x.shen; }).join('');
  var kb = b.dayGZ + b.hourZhi + b.sanChuan.map(function (x) { return x.shen; }).join('');
  if (ka !== kb) { diff++; console.log('DIFF', c.join('-'), 'new:', ka, 'old:', kb); }
});
console.log(diff === 0 ? '课体不变性: ' + cases.length + ' 例三传/日柱/时支全部逐位一致' : '发现 ' + diff + ' 处差异');
