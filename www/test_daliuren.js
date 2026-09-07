/**
 * 大六壬起课核心回归测试
 *
 * 公开课例(给定日干支/月将/占时 → 期望三传), 来源逐条注释:
 *   [E1] 甲子日亥将子时 → 子亥戌 (贼克·比用)
 *        https://k.sina.cn/article_6869708318_199776e1e00101399o.html
 *   [E2] 戊辰日丑将午时 → 子未寅 (涉害·缀瑕, 子午俱四重克同加孟, 刚日取干上)
 *        https://www.zhycw.com/art/n823c10.aspx
 *   [E3] 壬辰日巳将寅时 → 戌丑辰 (遥克·蒿矢+比用; 来源给出初传戌, 中末按"初上为中"推)
 *        https://www.kancloud.cn/yinchanye/dlrrm/592724
 *   [E4] 戊寅日辰将子时 → 丑午酉 (昴星·虎视转蓬)
 *   [E5] 丁亥日巳将寅时 → 午戌寅 (昴星·冬蛇掩目)
 *   [E6] 丙辰日辰将卯时 → 亥午午 (别责·刚日干合上神)
 *   [E7] 辛酉日子将丑时 → 丑酉酉 (别责·柔日支前三合)
 *   [E8] 甲寅日丑将辰时 → 丑亥亥 (八专·阳日顺数三)
 *   [E9] 丁未日辰将丑时 → 亥戌戌 (八专·阴日逆数三)
 *   [E10] 己未日酉将未时 → 酉酉酉 (八专·独足)
 *        E4-E10 均出自 http://www.fushantang.com/1012/1012b/j2099.html (福山堂·大六壬)
 *   [E11] 甲子日子将子时 → 寅巳申 (伏吟·自任; "六甲伏吟寅巳申"附又诀, 同福山堂)
 *   [E12] 甲子日子将午时 → 寅申寅 (返吟有克; "六甲、六庚日三传为寅申寅")
 *        https://baike.baidu.com/item/%E5%85%AD%E5%A3%AC/3794631
 *   [E13] 丁丑日巳将亥时 → 亥未丑 (返吟无克·井栏叉; 丑日取登明亥发用, 中支末干)
 *        规则出处同 E12 + https://www.laiboyee.com/classicsly2.html, 三传按规则推出
 */
process.chdir(__dirname);
var TestRunner = require('./test_comprehensive.js');
var runner = new TestRunner();
var fs = require('fs');

globalThis.window = {};
var code = fs.readFileSync('lib/ganzhi.js', 'utf-8') + ';'
  + fs.readFileSync('daliuren.js', 'utf-8');
eval(code);
var dlr = globalThis.window.daliuren;

function expectThrow(fn, messagePart) {
  var error = null;
  try { fn(); } catch (e) { error = e; }
  runner.assert(error, '应抛出错误');
  if (messagePart) runner.assert(String(error.message).indexOf(messagePart) >= 0, '错误信息应包含 ' + messagePart + '，实际：' + error.message);
}

function chuanOf(pan) { return pan.sanChuan.map(function (c) { return c.shen; }); }
function expectKe(label, dayGZ, yueJiang, hourZhi, expected, zongmen, ketiPart) {
  runner.test(label + ': ' + dayGZ + '日 ' + yueJiang + '将 ' + hourZhi + '时 → ' + expected.join(''), function () {
    var pan = dlr.paiKe('manual', { dayGZ: dayGZ, yueJiang: yueJiang, hourZhi: hourZhi });
    runner.assertEq(chuanOf(pan).join(''), expected.join(''), '三传不符，实际：' + chuanOf(pan).join('') + '，发用：' + pan.faYong.zongmen + pan.faYong.keti + ' ' + pan.faYong.detail);
    if (zongmen) runner.assertEq(pan.faYong.zongmen, zongmen, '宗门不符，实际：' + pan.faYong.zongmen);
    if (ketiPart) runner.assert(pan.faYong.keti.indexOf(ketiPart) >= 0, '课体应含 ' + ketiPart + '，实际：' + pan.faYong.keti);
  });
}

runner.module('大六壬 API 与基础表');
runner.test('核心 API 全部存在', function () {
  runner.assert(dlr && typeof dlr.paiKe === 'function');
  runner.assert(typeof dlr.formatDaliurenPrompt === 'function');
  runner.assert(typeof dlr.sheHaiCount === 'function');
  runner.assertEq(Object.keys(dlr.JIGONG).length, 10);
  runner.assertEq(dlr.TIANJIANG.length, 12);
  runner.assertEq(dlr.TIANJIANG[0], '贵人');
  runner.assertEq(dlr.TIANJIANG[11], '天后');
});
runner.test('十干寄宫正确(S2)', function () {
  runner.assertEq(dlr.JIGONG['甲'], '寅');
  runner.assertEq(dlr.JIGONG['乙'], '辰');
  runner.assertEq(dlr.JIGONG['丙'], '巳');
  runner.assertEq(dlr.JIGONG['戊'], '巳');
  runner.assertEq(dlr.JIGONG['丁'], '未');
  runner.assertEq(dlr.JIGONG['己'], '未');
  runner.assertEq(dlr.JIGONG['庚'], '申');
  runner.assertEq(dlr.JIGONG['辛'], '戌');
  runner.assertEq(dlr.JIGONG['壬'], '亥');
  runner.assertEq(dlr.JIGONG['癸'], '丑');
});
runner.test('贵人歌昼夜贵正确(S3)', function () {
  runner.assertEq(dlr.GUIREN['甲'].join(''), '丑未'); // 甲戊庚牛羊
  runner.assertEq(dlr.GUIREN['庚'].join(''), '丑未');
  runner.assertEq(dlr.GUIREN['乙'].join(''), '子申'); // 乙己鼠猴乡
  runner.assertEq(dlr.GUIREN['丙'].join(''), '亥酉'); // 丙丁猪鸡位
  runner.assertEq(dlr.GUIREN['壬'].join(''), '巳卯'); // 壬癸蛇兔藏
  runner.assertEq(dlr.GUIREN['辛'].join(''), '午寅'); // 六辛逢马虎
});
runner.test('昼夜分界: 卯至申为昼, 酉至寅为夜(S3)', function () {
  '卯辰巳午未申'.split('').forEach(function (z) { runner.assert(dlr.isDay(z), z + '应为昼'); });
  '酉戌亥子丑寅'.split('').forEach(function (z) { runner.assert(!dlr.isDay(z), z + '应为夜'); });
});
runner.test('非法输入显式报错', function () {
  expectThrow(function () { dlr.paiKe('wat', {}); }, '未知起课方式');
  expectThrow(function () { dlr.paiKe('manual', { dayGZ: '甲', yueJiang: '亥', hourZhi: '子' }); }, '日干支无效');
  expectThrow(function () { dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '猫', hourZhi: '子' }); }, '月将');
  expectThrow(function () { dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '亥', hourZhi: '狗' }); }, '占时');
  expectThrow(function () { dlr.paiKe('time', { dt: new Date('bad') }); }, '起课时间无效');
});

runner.module('大六壬 公开课例回归(E1-E13)');
expectKe('[E1] 贼克比用', '甲子', '亥', '子', ['子', '亥', '戌'], '比用法', '知一');
expectKe('[E2] 涉害缀瑕', '戊辰', '丑', '午', ['子', '未', '寅'], '涉害法', '缀瑕');
expectKe('[E3] 遥克蒿矢', '壬辰', '巳', '寅', ['戌', '丑', '辰'], '遥克法', '蒿矢');
expectKe('[E4] 昴星虎视', '戊寅', '辰', '子', ['丑', '午', '酉'], '昴星法', '虎视');
expectKe('[E5] 昴星冬蛇', '丁亥', '巳', '寅', ['午', '戌', '寅'], '昴星法', '冬蛇');
expectKe('[E6] 别责刚日', '丙辰', '辰', '卯', ['亥', '午', '午'], '别责法', '别责');
expectKe('[E7] 别责柔日', '辛酉', '子', '丑', ['丑', '酉', '酉'], '别责法', '别责');
expectKe('[E8] 八专阳日', '甲寅', '丑', '辰', ['丑', '亥', '亥'], '八专法', '八专');
expectKe('[E9] 八专阴日', '丁未', '辰', '丑', ['亥', '戌', '戌'], '八专法', '八专');
expectKe('[E10] 八专独足', '己未', '酉', '未', ['酉', '酉', '酉'], '八专法', '独足');
expectKe('[E11] 伏吟自任', '甲子', '子', '子', ['寅', '巳', '申'], '伏吟法', '自任');
expectKe('[E12] 返吟有克', '甲子', '子', '午', ['寅', '申', '寅'], '返吟法', '无依');
expectKe('[E13] 返吟井栏', '丁丑', '巳', '亥', ['亥', '未', '丑'], '返吟法', '井栏');

runner.module('大六壬 构造例(规则边界)');
runner.test('元首课: 丙申日戌将巳时 → 卯申丑(S2 例, 二课卯木克戌土)', function () {
  // 来源同 E1 文末例: 戌将巳时丙申日, 第二课上克下取天盘卯为用; 中末按"初上为中, 中上为末"推
  var pan = dlr.paiKe('manual', { dayGZ: '丙申', yueJiang: '戌', hourZhi: '巳' });
  runner.assertEq(chuanOf(pan).join(''), '卯申丑', '实际：' + chuanOf(pan).join(''));
  runner.assertEq(pan.faYong.keti, '元首课');
});
runner.test('重审课: 乙酉日寅将巳时 → 丑戌未(唯一一下贼上)', function () {
  // 构造验算: 寅将加巳, 天盘[辰]=丑; 乙寄辰 → 课1 丑/乙(木克土, 下贼上✓);
  // 课2 戌/丑(比), 课3 午/酉(火克金? 天盘[酉]=午 → 午/酉: 下酉金 vs 上午火: 上克下! 
  // 等等 — 天盘[酉]=午, 课3 = 午/酉, 午火克酉金 = 上克下; 课4 = 天盘[午]=卯/午: 卯木生午火 无克)
  // → 课1 下贼上唯一(重审优先元首), 初传丑; 中=丑上戌, 末=戌上未
  var pan = dlr.paiKe('manual', { dayGZ: '乙酉', yueJiang: '寅', hourZhi: '巳' });
  runner.assertEq(pan.faYong.keti, '重审课', '实际：' + pan.faYong.keti + pan.faYong.detail);
  runner.assertEq(chuanOf(pan).join(''), '丑戌未', '中末递乘, 实际：' + chuanOf(pan).join(''));
});
runner.test('弹射课: 癸未日午将辰时 → 巳未酉(日干遥克上神, 无蒿矢)', function () {
  // 构造验算: 午将加辰, 天盘[丑]=卯; 癸寄丑 → 课1 卯/癸(水生木); 课2 巳/卯(木生火);
  // 课3 酉/未(土生金); 课4 亥/酉(金生水) → 四课无贼克;
  // 上神卯巳酉亥: 克癸水者无(无蒿矢); 癸水克巳火 → 弹射, 初传巳; 中=巳上未, 末=未上酉
  var pan = dlr.paiKe('manual', { dayGZ: '癸未', yueJiang: '午', hourZhi: '辰' });
  runner.assertEq(pan.faYong.zongmen, '遥克法', '实际：' + pan.faYong.zongmen);
  runner.assertEq(pan.faYong.keti, '弹射课', '实际：' + pan.faYong.keti);
  runner.assertEq(chuanOf(pan).join(''), '巳未酉', '实际：' + chuanOf(pan).join(''));
});

runner.module('大六壬 月将(中气换将, 走农历引擎)');
runner.test('雨水后春分前 → 亥将登明', function () {
  var pan = dlr.paiKe('time', { dt: new Date(2026, 2, 10, 10, 0) }); // 2026-03-10
  runner.assertEq(pan.yueJiang.zhi, '亥', '实际：' + pan.yueJiang.zhi);
  runner.assertEq(pan.yueJiang.name, '登明');
  runner.assertEq(pan.yueJiang.zhongqi, '雨水');
});
runner.test('冬至后大寒前 → 丑将大吉', function () {
  var pan = dlr.paiKe('time', { dt: new Date(2026, 0, 10, 10, 0) }); // 2026-01-10
  runner.assertEq(pan.yueJiang.zhi, '丑', '实际：' + pan.yueJiang.zhi);
  runner.assertEq(pan.yueJiang.zhongqi, '冬至');
});
runner.test('冬至交节当天(2026-12-22 12:30) → 丑将大吉(Bug1回归)', function () {
  // getJieQiTable() 只含当年小寒-惊蛰,缺当年冬至; getPrevJieQi() 链可正确找到2026年冬至
  var pan = dlr.paiKe('time', { dt: new Date(2026, 11, 22, 12, 30) }); // 2026-12-22 12:30
  runner.assertEq(pan.yueJiang.zhi, '丑', '实际：' + pan.yueJiang.zhi + '，应为丑将');
  runner.assertEq(pan.yueJiang.name, '大吉', '实际：' + pan.yueJiang.name);
  runner.assertEq(pan.yueJiang.zhongqi, '冬至', '实际：' + pan.yueJiang.zhongqi);
});
runner.test('大寒后雨水前 → 子将神后(跨年边界)', function () {
  var pan = dlr.paiKe('time', { dt: new Date(2026, 1, 10, 10, 0) }); // 2026-02-10
  runner.assertEq(pan.yueJiang.zhi, '子', '实际：' + pan.yueJiang.zhi);
  runner.assertEq(pan.yueJiang.zhongqi, '大寒');
});
runner.test('大暑后处暑前 → 午将胜光', function () {
  var pan = dlr.paiKe('time', { dt: new Date(2026, 7, 10, 10, 0) }); // 2026-08-10
  runner.assertEq(pan.yueJiang.zhi, '午', '实际：' + pan.yueJiang.zhi);
  runner.assertEq(pan.yueJiang.zhongqi, '大暑');
});
runner.test('时间起课结构完整(四柱/天盘/四课/三传/天将)', function () {
  var pan = dlr.paiKe('time', { dt: new Date(2026, 5, 28, 14, 30) });
  runner.assert(pan.siZhu && pan.siZhu.day.length === 2, '应有四柱');
  runner.assertEq(Object.keys(pan.tianPan).length, 12);
  runner.assertEq(pan.tianPan[pan.hourZhi], pan.yueJiang.zhi, '天盘占时位应为月将');
  runner.assertEq(pan.siKe.length, 4);
  runner.assertEq(pan.sanChuan.length, 3);
  runner.assert(pan.sanChuan[0].jiang && pan.sanChuan[0].jiang.length >= 2, '三传应配天将');
  runner.assertEq(pan.siKe[0].xiaGong, dlr.JIGONG[pan.dayGan], '一课下宫应为干寄宫');
  runner.assertEq(pan.siKe[2].xia, pan.dayZhi, '三课下神应为日支');
});

runner.module('大六壬 天将布法(S3)');
runner.test('甲日昼占贵人丑, 临地盘亥子丑寅卯辰顺布', function () {
  // E1: 甲子日亥将子时(夜): 贵人未, 临地盘? 天盘[?]=未 → 亥将加子: [申]=未 → 临申 → 逆布
  var pan = dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '亥', hourZhi: '子' });
  runner.assertEq(pan.guiRen.zhi, '未', '甲日子时夜贵应为未');
  runner.assertEq(pan.guiRen.isDay, false);
  runner.assertEq(pan.guiRen.linGong, '申');
  runner.assertEq(pan.guiRen.shun, false, '贵人临申应逆布');
  runner.assertEq(pan.tianJiang['未'], '贵人');
  runner.assertEq(pan.tianJiang['午'], '螣蛇', '逆布: 未前一位午应螣蛇，实际：' + pan.tianJiang['午']);
  runner.assertEq(pan.tianJiang['申'], '天后', '逆布: 未后一位申应天后，实际：' + pan.tianJiang['申']);
});
runner.test('甲日昼占贵人丑顺布例', function () {
  // 甲子日戌将卯时(昼): 贵人丑, 天盘[?]=丑: 戌将加卯 [卯]=戌,[辰]=亥,[巳]=子,[午]=丑 → 临午 → 逆布? 
  // 换顺布例: 甲子日午将卯时: [卯]=午,[辰]=未,[巳]=申,[午]=酉,[未]=戌,[申]=亥,[戌]=卯? 不对, 
  // [酉]=子,[戌]=丑 → 临戌 → 逆。再换: 甲子日辰将巳时(昼): [巳]=辰,[午]=巳,[未]=午,[申]=未,[酉]=申,[戌]=酉,[亥]=戌,[子]=亥,[丑]=子,[寅]=丑 → 临寅 → 顺布✓
  var pan = dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '辰', hourZhi: '巳' });
  runner.assertEq(pan.guiRen.zhi, '丑');
  runner.assertEq(pan.guiRen.isDay, true);
  runner.assertEq(pan.guiRen.linGong, '寅');
  runner.assertEq(pan.guiRen.shun, true, '贵人临寅应顺布');
  runner.assertEq(pan.tianJiang['丑'], '贵人');
  runner.assertEq(pan.tianJiang['寅'], '螣蛇');
  runner.assertEq(pan.tianJiang['子'], '天后');
});

runner.module('大六壬 prompt 输出');
runner.test('formatDaliurenPrompt 含四柱/月将/四课/三传/发用/贵人/旬空/问题', function () {
  var pan = dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '亥', hourZhi: '子' });
  var text = dlr.formatDaliurenPrompt(pan, '这次考试能过吗');
  runner.assert(text.indexOf('月将：亥将登明') >= 0, '应含月将');
  runner.assert(text.indexOf('四课') >= 0, '应含四课');
  runner.assert(text.indexOf('初传：子') >= 0, '应含初传');
  runner.assert(text.indexOf('末传：戌') >= 0, '应含末传');
  runner.assert(text.indexOf('比用法') >= 0, '应含发用宗门');
  runner.assert(text.indexOf('贵人：未') >= 0, '应含贵人');
  runner.assert(text.indexOf('旬空：戌亥') >= 0, '甲子旬空戌亥');
  runner.assert(text.indexOf('这次考试能过吗') >= 0, '应含所问之事');
});
runner.test('伏吟/返吟/八专课式标注', function () {
  var fu = dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '子', hourZhi: '子' });
  runner.assert(dlr.formatDaliurenPrompt(fu).indexOf('伏吟') >= 0);
  var fan = dlr.paiKe('manual', { dayGZ: '甲子', yueJiang: '子', hourZhi: '午' });
  runner.assert(dlr.formatDaliurenPrompt(fan).indexOf('返吟') >= 0);
  var bz = dlr.paiKe('manual', { dayGZ: '甲寅', yueJiang: '丑', hourZhi: '辰' });
  runner.assert(dlr.formatDaliurenPrompt(bz).indexOf('八专') >= 0);
});

runner.run();
