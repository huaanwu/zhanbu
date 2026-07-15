/**
 * 公共干支排盘模块 v1.0
 * --------------------------------------------------
 * 算盘层单一来源(Single Source of Truth)
 *
 * 提供:
 *   - 干支常量 GAN / ZHI
 *   - 基础排盘函数 getGanZhi / getYearGZ / getMonthGZ / getDayGZ / getHourGZ
 *   - 纳音 NA_YIN + getNaYin
 *   - 旬表 XUN + 旬空表 XUN_KONG + getXunKong
 *   - 高精度引擎 getYearGZEx / getMonthGZEx / getDayGZEx / getHourGZEx / _getNextDayGZ
 *
 * 设计原则:
 *   1. 100% 准确的命理事实由代码给出(AGENTS.md 关键约束)
 *   2. 粗算法(getYearGZ/MonthGZ)只用于内部推算 + 高精度 fallback
 *   3. 高精度引擎(Ex 系列)才是"对外承诺",绝不静默退化为错误结果
 *      fallback 路径采用 vm 沙箱加载本地 lunar.bundle.js
 *   4. 双模式:浏览器 script tag + Node eval()/require()
 *      所有顶层 var / function 直接挂到 window/globalThis
 *
 * 历史:
 *   - v1.0 (2026-07-15) 抽出自 liuyao.js / qimen.js / app/bazi.js 三处重复定义
 *     修复节气边界 P0 bug(lunar-javascript fallback 路径误用粗算法)
 *     消除双 UTF-8 BOM 污染
 */

// ========== 干支常量 ==========
var GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
var ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ========== 纳音表(60甲子) ==========
var NA_YIN = {
  "甲子":"海中金","乙丑":"海中金","丙寅":"炉中火","丁卯":"炉中火","戊辰":"大林木","己巳":"大林木",
  "庚午":"路旁土","辛未":"路旁土","壬申":"剑锋金","癸酉":"剑锋金","甲戌":"山头火","乙亥":"山头火",
  "丙子":"涧下水","丁丑":"涧下水","戊寅":"城头土","己卯":"城头土","庚辰":"白蜡金","辛巳":"白蜡金",
  "壬午":"杨柳木","癸未":"杨柳木","甲申":"泉中水","乙酉":"泉中水","丙戌":"屋上土","丁亥":"屋上土",
  "戊子":"霹雳火","己丑":"霹雳火","庚寅":"松柏木","辛卯":"松柏木","壬辰":"长流水","癸巳":"长流水",
  "甲午":"沙中金","乙未":"沙中金","丙申":"山下火","丁酉":"山下火","戊戌":"平地木","己亥":"平地木",
  "庚子":"壁上土","辛丑":"壁上土","壬寅":"金箔金","癸卯":"金箔金","甲辰":"覆灯火","乙巳":"覆灯火",
  "丙午":"天河水","丁未":"天河水","戊申":"大驿土","己酉":"大驿土","庚戌":"钗钏金","辛亥":"钗钏金",
  "壬子":"桑柘木","癸丑":"桑柘木","甲寅":"大溪水","乙卯":"大溪水","丙辰":"沙中土","丁巳":"沙中土",
  "戊午":"天上火","己未":"天上火","庚申":"石榴木","辛酉":"石榴木","壬戌":"大海水","癸亥":"大海水"
};

// ========== 旬表(60甲子 -> 所属旬首) ==========
var XUN = {
  "甲子":"甲子","乙丑":"甲子","丙寅":"甲子","丁卯":"甲子","戊辰":"甲子","己巳":"甲子","庚午":"甲子","辛未":"甲子","壬申":"甲子","癸酉":"甲子",
  "甲戌":"甲戌","乙亥":"甲戌","丙子":"甲戌","丁丑":"甲戌","戊寅":"甲戌","己卯":"甲戌","庚辰":"甲戌","辛巳":"甲戌","壬午":"甲戌","癸未":"甲戌",
  "甲申":"甲申","乙酉":"甲申","丙戌":"甲申","丁亥":"甲申","戊子":"甲申","己丑":"甲申","庚寅":"甲申","辛卯":"甲申","壬辰":"甲申","癸巳":"甲申",
  "甲午":"甲午","乙未":"甲午","丙申":"甲午","丁酉":"甲午","戊戌":"甲午","己亥":"甲午","庚子":"甲午","辛丑":"甲午","壬寅":"甲午","癸卯":"甲午",
  "甲辰":"甲辰","乙巳":"甲辰","丙午":"甲辰","丁未":"甲辰","戊申":"甲辰","己酉":"甲辰","庚戌":"甲辰","辛亥":"甲辰","壬子":"甲辰","癸丑":"甲辰",
  "甲寅":"甲寅","乙卯":"甲寅","丙辰":"甲寅","丁巳":"甲寅","戊午":"甲寅","己未":"甲寅","庚申":"甲寅","辛酉":"甲寅","壬戌":"甲寅","癸亥":"甲寅"
};

// ========== 旬空表(旬首 -> 空亡的两支) ==========
var XUN_KONG = {
  "甲子":"戌亥","甲戌":"申酉","甲申":"午未","甲午":"辰巳","甲辰":"寅卯","甲寅":"子丑"
};

// ========== 基础排盘函数(粗算法,不考虑节气分界) ==========

// 通用干支计算:offset % 10 干, offset % 12 支
function getGanZhi(offset) { return GAN[offset % 10] + ZHI[offset % 12]; }

// 公历年干支(粗算法, 只用于节气分界已知时的内部推算)
// 注意:此函数不处理立春换年, 请在外部接口层用 getYearGZEx
function getYearGZ(year) { return getGanZhi(year - 4); }

// 月柱(五虎遁:甲己之年丙作首, 乙庚之年戊为头, 丙辛必定寻庚起, 丁壬壬位顺行流, 戊癸何方发, 甲己之上好追求)
// month: 1=正月(寅)...12=腊月(丑)
function getMonthGZ(yearGan, month) {
  var wuHuDun = { '甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚','丁':'壬','壬':'壬','戊':'甲','癸':'甲' };
  var startGan = wuHuDun[yearGan] || '丙';
  var startIdx = GAN.indexOf(startGan);
  var dzArr = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  return GAN[(startIdx + month - 1) % 10] + dzArr[month - 1];
}

// 日柱(以 1900-01-31(甲子) 为基准)
function getDayGZ(dt) {
  var base = new Date(1900, 0, 31);
  var diff = Math.floor((dt - base) / 86400000);
  return getGanZhi(diff);
}

// 时柱(五鼠遁:甲己还加甲, 乙庚丙作初, 丙辛从戊起, 丁壬庚子居, 戊癸何方发, 壬子是真途)
// hour: 0-23(23 = 次日子时)
function getHourGZ(dayGan, hour) {
  var zhiIdx = Math.floor((hour + 1) / 2) % 12;
  var dayIdx = GAN.indexOf(dayGan);
  var ganIdx = (dayIdx * 2 + zhiIdx) % 10;
  return GAN[ganIdx] + ZHI[zhiIdx];
}

// 纳音
function getNaYin(gz) { return NA_YIN[gz] || "未知"; }

// 旬空
function getXunKong(dayGZ) {
  var xun = XUN[dayGZ];
  return XUN_KONG[xun] || "";
}

// ========== 高精度八字引擎(节气分界版) ==========
// 浏览器: 从 window.Solar(由 lib/lunar.bundle.js 暴露)取
// Node 测试: 从 ./lib/lunar.bundle.js 在 vm 沙箱里加载, 捕获 LunarLib
// 三层 fallback: window.Solar -> Node vm 加载 lunar.bundle.js -> 粗算法(并 console.warn)

var _SolarRef = null;

var _EightCharRef = null;
function _getEightChar() {
  if (_EightCharRef) return _EightCharRef;
  var _LL = null;
  if (typeof window !== 'undefined' && window.LunarLib) _LL = window.LunarLib;
  else if (typeof globalThis !== 'undefined' && globalThis.LunarLib) _LL = globalThis.LunarLib;
  if (_LL && _LL.EightChar) { _EightCharRef = _LL.EightChar; return _EightCharRef; }
  return null;
}

function _loadSolarFromNode() {
  // 真浏览器有 DOM,跳过 Node 加载
  if (typeof document !== "undefined" && typeof document.createElement === "function") return null;
  try {
    var fs2 = require('fs');
    var vm = require('vm');
    var path = require('path');
    // 探测 lunar.bundle.js 路径:多个候选,直到找到存在的
    var candidates = [];
    if (typeof __dirname === 'string' && __dirname !== '.' && path.isAbsolute(__dirname)) {
      candidates.push(path.join(__dirname, 'lunar.bundle.js'));
      candidates.push(path.join(__dirname, '..', 'lib', 'lunar.bundle.js'));
    }
    candidates.push(path.join(process.cwd(), 'www', 'lib', 'lunar.bundle.js'));
    candidates.push(path.join(process.cwd(), 'lib', 'lunar.bundle.js'));
    // 从 cwd 上溯找 package.json
    var dir = process.cwd();
    for (var i = 0; i < 5; i++) {
      candidates.push(path.join(dir, 'www', 'lib', 'lunar.bundle.js'));
      candidates.push(path.join(dir, 'lib', 'lunar.bundle.js'));
      dir = path.dirname(dir);
    }
    var bundlePath = null;
    for (var j = 0; j < candidates.length; j++) {
      if (fs2.existsSync(candidates[j])) { bundlePath = candidates[j]; break; }
    }
    if (!bundlePath) return null;
    var code = fs2.readFileSync(bundlePath, 'utf-8');
    var sandbox = {};
    vm.runInNewContext(code, sandbox);
    if (sandbox.LunarLib && sandbox.LunarLib.Solar) {
      if (typeof globalThis !== 'undefined') {
        globalThis.LunarLib = sandbox.LunarLib;
        globalThis.Solar = sandbox.LunarLib.Solar;
        globalThis.Lunar = sandbox.LunarLib.Lunar;
      }
      return sandbox.LunarLib.Solar;
    }
  } catch (e) {
    // 静默:让上层 fallback 处理
  }
  return null;
}

function _getSolar() {
  if (_SolarRef) return _SolarRef;
  // 第一层: 浏览器 globalThis.window.Solar(lunar.bundle.js 暴露)
  if (typeof window !== 'undefined' && window.Solar && typeof window.Solar.fromYmd === 'function') {
    _SolarRef = window.Solar;
    return _SolarRef;
  }
  // 第二层: Node 测试环境, 全局已设置 Solar(由测试 setup 注入)
  if (typeof globalThis !== 'undefined' && globalThis.Solar && typeof globalThis.Solar.fromYmd === 'function') {
    _SolarRef = globalThis.Solar;
    return _SolarRef;
  }
  // 第三层: Node 通过 vm 加载 lunar.bundle.js
  var nodeSolar = _loadSolarFromNode();
  if (nodeSolar) {
    _SolarRef = nodeSolar;
    return _SolarRef;
  }
  return null;
}

// 高精度年柱(立春分界): 2026 立春前(2/3)仍属乙巳年, 立春后(2/4+)才进入丙午年
function getYearGZEx(y, m, d) {
  var Solar = _getSolar();
  if (Solar) {
    try {
      var _solarObj = Solar.fromYmd(y, m, d);
      var _EC = _getEightChar();
      if (_EC) return _EC.fromLunar(_solarObj.getLunar()).getYear(); // 按八字标准: 立春换年
      return _solarObj.getLunar().getYearInGanZhi(); // 兜底按春节
    } catch (e) { console.warn('[ganzhi] getYearGZEx 调用失败, 降级粗算法:', e.message); }
  }
  console.warn('[ganzhi] getYearGZEx 无高精度引擎(lunar-javascript 未加载), 返回粗算法结果(可能错误)');
  return getYearGZ(y);
}

// 高精度月柱(节气分界): 2026 立春前(2/3)仍属去年己丑月, 立春后(2/4+)才进入庚寅月
function getMonthGZEx(y, m, d, yg) {
  var Solar = _getSolar();
  if (Solar) {
    try {
      var _solarObj2 = Solar.fromYmd(y, m, d);
      var _EC2 = _getEightChar();
      if (_EC2) return _EC2.fromLunar(_solarObj2.getLunar()).getMonth(); // 按八字标准: 节气换月
      return _solarObj2.getLunar().getMonthInGanZhi(); // 兜底按中气
    } catch (e) { console.warn('[ganzhi] getMonthGZEx 调用失败, 降级粗算法:', e.message); }
  }
  console.warn('[ganzhi] getMonthGZEx 无高精度引擎(lunar-javascript 未加载), 返回粗算法结果(可能错误)');
  return getMonthGZ(yg, m);
}

// 高精度日柱(无节气分界, 等价于粗算法, 但保持 API 一致)
function getDayGZEx(dt) { return getDayGZ(dt); }

// 高精度时柱(支持晚子时: 23:00-00:59 用次日日干)
// dg: 本日日干, h: 0-23, ndg: 次日日干(可选, 缺省则按早子时算)
function getHourGZEx(dg, h, ndg) {
  var isLateZi = (h >= 23);
  var eg = (isLateZi && ndg) ? ndg : dg;
  var zi = Math.floor((h + 1) / 2) % 12;
  var di = GAN.indexOf(eg);
  return GAN[(di * 2 + zi) % 10] + ZHI[zi];
}

// 获取次日日干(供晚子时计算)
function _getNextDayGZ(dt) {
  var d = new Date(dt);
  d.setDate(d.getDate() + 1);
  return getDayGZ(d)[0];
}

// 暴露到 globalThis(双模式: 浏览器 window + Node global)
if (typeof window !== 'undefined') {
  window.GAN = GAN;
  window.ZHI = ZHI;
  window.NA_YIN = NA_YIN;
  window.XUN = XUN;
  window.XUN_KONG = XUN_KONG;
  window.getGanZhi = getGanZhi;
  window.getYearGZ = getYearGZ;
  window.getMonthGZ = getMonthGZ;
  window.getDayGZ = getDayGZ;
  window.getHourGZ = getHourGZ;
  window.getNaYin = getNaYin;
  window.getXunKong = getXunKong;
  window.getYearGZEx = getYearGZEx;
  window.getMonthGZEx = getMonthGZEx;
  window.getDayGZEx = getDayGZEx;
  window.getHourGZEx = getHourGZEx;
  window._getNextDayGZ = _getNextDayGZ;
}
if (typeof globalThis !== 'undefined') {
  globalThis.GAN = GAN;
  globalThis.ZHI = ZHI;
  globalThis.NA_YIN = NA_YIN;
  globalThis.XUN = XUN;
  globalThis.XUN_KONG = XUN_KONG;
  globalThis.getGanZhi = getGanZhi;
  globalThis.getYearGZ = getYearGZ;
  globalThis.getMonthGZ = getMonthGZ;
  globalThis.getDayGZ = getDayGZ;
  globalThis.getHourGZ = getHourGZ;
  globalThis.getNaYin = getNaYin;
  globalThis.getXunKong = getXunKong;
  globalThis.getYearGZEx = getYearGZEx;
  globalThis.getMonthGZEx = getMonthGZEx;
  globalThis.getDayGZEx = getDayGZEx;
  globalThis.getHourGZEx = getHourGZEx;
  globalThis._getNextDayGZ = _getNextDayGZ;
}