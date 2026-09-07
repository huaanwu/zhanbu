// 交叉验证 dump: 对给定 datetime 列表, 用 app 的 daliuren.js 起课并输出 JSON
process.chdir(__dirname);
var fs = require('fs');
globalThis.window = {};
eval(fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';' + fs.readFileSync('daliuren.js', 'utf-8'));
var dlr = globalThis.window.daliuren;
var Solar = globalThis.Solar;

var cases = [
  // [y, m, d, h, 备注]
  [2026, 9, 7, 10, '今天'],
  [2026, 9, 7, 23, '晚子时边界'],
  [2026, 9, 8, 0, '跨日后'],
  [2024, 2, 4, 16, '立春当天(16:27立春)'],
  [2024, 2, 4, 17, '立春后'],
  [2023, 3, 22, 12, '闰二月初一'],
  [2023, 2, 20, 12, '二月初一'],
  [2026, 8, 23, 4, '处暑当天(月将换巳)'],
  [2026, 8, 23, 12, '处暑当天午后'],
  [2026, 2, 19, 12, '雨水当天附近'],
  [2026, 12, 22, 12, '冬至附近'],
  [2026, 1, 20, 12, '大寒附近'],
  [2000, 1, 1, 6, '千禧'],
  [1990, 6, 15, 18, '旧历'],
  [2050, 12, 31, 20, '远期'],
  [2025, 6, 21, 12, '夏至当天附近'],
  [2025, 7, 25, 1, '凌晨丑时'],
  [2025, 7, 25, 23, '晚子时']
];

var out = [];
cases.forEach(function (c) {
  var dt = new Date(c[0], c[1] - 1, c[2], c[3], 30, 0);
  var rec = { label: c[4], dt: c[0] + '-' + c[1] + '-' + c[2] + ' ' + c[3] + ':30' };
  try {
    var pan = dlr.paiKe('time', { dt: dt });
    rec.siZhu = pan.siZhu;
    rec.yueJiang = pan.yueJiang;
    rec.hourZhi = pan.hourZhi;
    rec.dayGZ = pan.dayGZ;
    rec.sanChuan = pan.sanChuan.map(function (x) { return x.shen; }).join('');
    rec.zongmen = pan.faYong.zongmen;
    var S = globalThis.Solar || globalThis.window.Solar;
    var lunar = S.fromYmdHms(c[0], c[1], c[2], c[3], 30, 0).getLunar();
    rec.lunarText = lunar.getYearInChinese() + '年' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();
    rec.lunarMD = [lunar.getMonth(), lunar.getDay()];
    rec.jieqi = lunar.getJieQi();
  } catch (e) { rec.error = e.message; }
  out.push(rec);
});
console.log(JSON.stringify(out, null, 1));
