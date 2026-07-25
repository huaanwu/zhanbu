// ========== 大六壬起课系统 v1.0 ==========
// 三式之首: 月将加时 → 天地盘 → 四课 → 九宗门取三传 → 十二天将。
// 原则与 liuyao.js/xiaoliuren.js 一致: 起课是 100% 确定性算法, 由代码给出; AI 只做展开解读。
// 九宗门(贼克/比用/涉害/遥克/昴星/别责/八专/伏吟/返吟)全部实现, 取不出三传则 throw, 不回退默认。
//
// 规则来源(联网核实, 2026-07):
//   [S1] 九宗门口诀全文(贼克/比用/涉害/遥克/昴星/别责/八专/伏吟/返吟) + 返吟有克三传表
//        百度百科·九宗门 https://baike.baidu.com/item/%E4%B9%9D%E5%AE%97%E9%97%A8/6144113
//        百度百科·六壬   https://baike.baidu.com/item/%E5%85%AD%E5%A3%AC/3794631
//   [S2] 月将过中气换将(雨水亥将/春分戌将/...) + 月将加时排天地盘 + 十干寄宫
//        https://www.163.com/dy/article/IN4QNTIR0521C9T8.html (灵遁者《朴易天下》)
//        https://k.sina.cn/article_6869708318_199776e1e00101399o.html
//   [S3] 贵人歌(甲戊庚牛羊...) + 昼贵卯至申/夜贵酉至寅 + 贵人临地盘亥子丑寅卯辰顺布、巳午未申酉戌逆布
//        百度百科·六壬(同上); 出土实物与《五行大义》佐证"甲戊庚牛羊"为正法:
//        https://www.shuge.org/meet/topic/103333/
//        昼夜分界有三说(星出没/卯酉/日出没), 本实现取《六壬秘籍》卯至申为昼(百度百科同), 见 dlrIsDay
//   [S4] 涉害法细则(从本家数至临宫计受克数, 寄宫天干参与计克; 等深取孟仲季; 复等刚日取干上/柔日取支上)
//        https://www.zhycw.com/art/n823c10.aspx (《大六壬入门》涉害课, 含戊辰日子未寅课例)
//        https://www.sohu.com/a/524183693_120414850 (辛亥日课例, 含寄宫计克演示)
//        流派分歧: 《大六壬指南》/邵彦和一脉直取孟仲季不论涉害多寡
//        (http://www.fushantang.com/1012/1012c/j3040.html 及 ctext 心印赋注
//        https://ctext.org/wiki.pl?if=gb&chapter=149687);
//        本实现取《金匮》《心镜》古法师"先数涉害多寡, 再孟仲季, 再刚柔"(zhycw 考据《大全》总钤图多以此为正)
//   [S5] 昴星/别责/八专/伏吟/返吟细则 + 完整课例(戊寅日丑午酉、丁亥日午戌寅、丙辰日亥午午、
//        辛酉日丑酉酉、甲寅日丑亥亥、丁未日亥戌戌、己未日酉酉酉独足、六甲伏吟寅巳申)
//        http://www.fushantang.com/1012/1012b/j2099.html (福山堂·大六壬)
//        别责"支前三合"= 三合局(孟仲季序)中日支之后一位(酉日取丑/丑日取巳), 即日支+4,
//        另据《大六壬指南》 https://www.laiboyee.com/classicsly2.html
//   [S6] 伏吟"若初传值自刑则中传阳日用支、阴日用干, 中传自刑末传以冲"《大六壬指南》(同上 laiboyee)
//        分歧: 福山堂附又诀"壬辰壬午亥巳申"等四壬别立法与通则冲突, 本实现从《指南》通则, 注释存疑

var DLR_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
var DLR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

var DLR_GAN_WX = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
var DLR_ZHI_WX = { '寅': '木', '卯': '木', '巳': '火', '午': '火', '申': '金', '酉': '金', '亥': '水', '子': '水', '辰': '土', '戌': '土', '丑': '土', '未': '土' };
var DLR_KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' }; // key 克 value

function dlrIsYangGan(g) { return '甲丙戊庚壬'.indexOf(g) >= 0; }
function dlrIsYangZhi(z) { return '子寅辰午申戌'.indexOf(z) >= 0; }
function dlrWx(x) { return DLR_GAN_WX[x] || DLR_ZHI_WX[x]; }
function dlrKe(a, b) { return DLR_KE[dlrWx(a)] === dlrWx(b); } // a 克 b ?

// 十干寄宫 [S2]: 甲课寅兮乙课辰, 丙戊课巳不须论, 丁己课未庚申上, 辛戌壬亥是其真, 癸课丑
var DLR_JIGONG = { '甲': '寅', '乙': '辰', '丙': '巳', '戊': '巳', '丁': '未', '己': '未', '庚': '申', '辛': '戌', '壬': '亥', '癸': '丑' };
var DLR_JIGAN_AT = {}; // 地盘宫 → 寄宫天干列表(涉害计克用 [S4])
(function () {
  for (var g in DLR_JIGONG) {
    var z = DLR_JIGONG[g];
    if (!DLR_JIGAN_AT[z]) DLR_JIGAN_AT[z] = [];
    DLR_JIGAN_AT[z].push(g);
  }
})();

// 五合(别责刚日取干合上神 [S5])
var DLR_GANHE = { '甲': '己', '己': '甲', '乙': '庚', '庚': '乙', '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁', '戊': '癸', '癸': '戊' };

// 三刑(伏吟中末传递刑 [S1]): 寅巳申/丑戌未三刑, 子卯互刑, 辰午酉亥自刑
var DLR_XING = { '寅': '巳', '巳': '申', '申': '寅', '丑': '戌', '戌': '未', '未': '丑', '子': '卯', '卯': '子', '辰': '辰', '午': '午', '酉': '酉', '亥': '亥' };
function dlrChong(z) { return DLR_ZHI[(DLR_ZHI.indexOf(z) + 6) % 12]; }
function dlrIsZiXing(z) { return '辰午酉亥'.indexOf(z) >= 0; }

// 驿马(返吟无克井栏叉取马发用 [S1]): 申子辰马在寅, 寅午戌马在申, 巳酉丑马在亥, 亥卯未马在巳
var DLR_YIMA = { '申': '寅', '子': '寅', '辰': '寅', '寅': '申', '午': '申', '戌': '申', '巳': '亥', '酉': '亥', '丑': '亥', '亥': '巳', '卯': '巳', '未': '巳' };

// 月将(中气换将 [S2]): 正月雨水后亥将登明 ... 十二月大寒后子将神后
var DLR_YUEJIANG_NAME = {
  '亥': '登明', '戌': '河魁', '酉': '从魁', '申': '传送', '未': '小吉', '午': '胜光',
  '巳': '太乙', '辰': '天罡', '卯': '太冲', '寅': '功曹', '丑': '大吉', '子': '神后'
};
// 中气 → 月将支(过该中气即换将)
var DLR_ZHONGQI = [
  ['雨水', '亥'], ['春分', '戌'], ['谷雨', '酉'], ['小满', '申'],
  ['夏至', '未'], ['大暑', '午'], ['处暑', '巳'], ['秋分', '辰'],
  ['霜降', '卯'], ['小雪', '寅'], ['冬至', '丑'], ['大寒', '子']
];

// 贵人歌 [S3]: 甲戊庚牛羊, 乙己鼠猴乡, 丙丁猪鸡位, 壬癸蛇兔藏, 六辛逢马虎。昼用前一支, 夜用后一支
var DLR_GUIREN = {
  '甲': ['丑', '未'], '戊': ['丑', '未'], '庚': ['丑', '未'],
  '乙': ['子', '申'], '己': ['子', '申'],
  '丙': ['亥', '酉'], '丁': ['亥', '酉'],
  '壬': ['巳', '卯'], '癸': ['巳', '卯'],
  '辛': ['午', '寅']
};
// 昼夜分界 [S3]: 占时卯辰巳午未申为昼用阳贵, 酉戌亥子丑寅为夜用阴贵(《六壬秘籍》说, 百度百科同)
function dlrIsDay(hourZhi) { return '卯辰巳午未申'.indexOf(hourZhi) >= 0; }
var DLR_TIANJIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

// 孟仲季(涉害等深取用 [S4])
var DLR_MENG = '寅申巳亥';
var DLR_ZHONG = '子午卯酉';

// ---------- 农历引擎(与 xiaoliuren.js 同模式) ----------
function dlrGetSolarEngine(dt) {
  var Solar = (typeof window !== 'undefined' && window.Solar) || (typeof globalThis !== 'undefined' && globalThis.Solar);
  // Node 测试环境下由 ganzhi.js 的加载器把本地 lunar.bundle.js 挂到 globalThis
  if (!Solar) {
    var getYearGZEx = (typeof window !== 'undefined' && window.getYearGZEx) || (typeof globalThis !== 'undefined' && globalThis.getYearGZEx);
    if (typeof getYearGZEx === 'function') {
      getYearGZEx(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
      Solar = (typeof window !== 'undefined' && window.Solar) || (typeof globalThis !== 'undefined' && globalThis.Solar);
    }
  }
  if (!Solar || typeof Solar.fromYmdHms !== 'function') {
    throw new Error('农历引擎未加载，无法按时间起课');
  }
  return Solar;
}

function dlrGetEightChar() {
  if (typeof window !== 'undefined' && window.LunarLib && window.LunarLib.EightChar) return window.LunarLib.EightChar;
  if (typeof globalThis !== 'undefined' && globalThis.LunarLib && globalThis.LunarLib.EightChar) return globalThis.LunarLib.EightChar;
  return null;
}

// 月将: 过中气换将 [S2]。取 dt 所在 lunar 的节气表(含上年冬至, 已验证), 找最近已过的中气
function dlrYueJiangFromDate(dt) {
  var Solar = dlrGetSolarEngine(dt);
  var lunar = Solar.fromYmdHms(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds() || 0).getLunar();
  var table = lunar.getJieQiTable();
  var best = null, bestName = null, bestZhi = null;
  for (var i = 0; i < DLR_ZHONGQI.length; i++) {
    var name = DLR_ZHONGQI[i][0];
    var s = table[name];
    if (!s) continue;
    var d2 = new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond());
    if (d2.getTime() <= dt.getTime() && (!best || d2.getTime() > best.getTime())) {
      best = d2; bestName = name; bestZhi = DLR_ZHONGQI[i][1];
    }
  }
  if (!best) throw new Error('无法确定月将：节气表中找不到有效中气');
  return { zhi: bestZhi, name: DLR_YUEJIANG_NAME[bestZhi], zhongqi: bestName, since: best };
}

// ---------- 基础校验 ----------
function dlrRequireGan(g, label) {
  if (DLR_GAN.indexOf(g) < 0) throw new Error((label || '天干') + '无效: ' + g);
  return g;
}
function dlrRequireZhi(z, label) {
  if (DLR_ZHI.indexOf(z) < 0) throw new Error((label || '地支') + '无效: ' + z);
  return z;
}

// ---------- 涉害计数 [S4] ----------
// 上神 S 临地盘宫 P, 从 P 顺行地盘数回本家 S 止(含两端)。
// type '贼'(下贼上中被贼的上神): 计 S 受克(地盘支克 + 寄宫天干克);
// type '克'(上克下中的克神):     计 S 克他(克地盘支 + 克寄宫天干)。
// 注: 寄宫天干是否计克各派有出入([S4] sohu 课例计入, 从之)。
function dlrSheHaiCount(shen, linGong, type) {
  var count = 0;
  var i = DLR_ZHI.indexOf(linGong);
  var guard = 0;
  while (guard++ < 13) {
    var g = DLR_ZHI[i % 12];
    var ganList = DLR_JIGAN_AT[g] || [];
    var j;
    if (type === '贼') {
      if (dlrKe(g, shen)) count++;
      for (j = 0; j < ganList.length; j++) if (dlrKe(ganList[j], shen)) count++;
    } else {
      if (dlrKe(shen, g)) count++;
      for (j = 0; j < ganList.length; j++) if (dlrKe(shen, ganList[j])) count++;
    }
    if (g === shen) break;
    i++;
  }
  return count;
}

// 涉害取舍: 多克者为用; 等深先取临四孟上者, 次四仲, 再次四季;
// 复等(涉害等且孟仲季同)刚日取干上神、柔日取支上神(须在候选中), 否则取课序先见者 [S4]
function dlrSheHaiSelect(cands, type, isYangDay, ganShang, zhiShang) {
  var scored = cands.map(function (c) {
    return { shang: c.shang, linGong: c.linGong, keIdx: c.keIdx, count: dlrSheHaiCount(c.shang, c.linGong, type) };
  });
  var max = -1;
  scored.forEach(function (s) { if (s.count > max) max = s.count; });
  var tied = scored.filter(function (s) { return s.count === max; });
  var mengTied = tied.filter(function (s) { return DLR_MENG.indexOf(s.linGong) >= 0; });
  var pool = tied;
  var level = '季';
  if (mengTied.length > 0) { pool = mengTied; level = '孟'; }
  else {
    var zhongTied = tied.filter(function (s) { return DLR_ZHONG.indexOf(s.linGong) >= 0; });
    if (zhongTied.length > 0) { pool = zhongTied; level = '仲'; }
  }
  var chosen = pool[0];
  var fuDeng = pool.length > 1;
  if (fuDeng) {
    var pref = isYangDay ? ganShang : zhiShang;
    var hit = pool.filter(function (s) { return s.shang === pref; });
    chosen = hit.length > 0 ? hit[0] : pool[0];
  }
  // 课体细分: 见机(孟)/察微(仲)/缀瑕(季或复等) [S4 心印赋注]
  var keti = level === '孟' ? '见机课' : level === '仲' ? '察微课' : '缀瑕课';
  if (fuDeng) keti = '缀瑕课(复等,' + (isYangDay ? '刚日取干上' : '柔日取支上') + ')';
  return { shang: chosen.shang, count: chosen.count, keti: keti, tiedCount: tied.length };
}

// ---------- 贼克/比用/涉害链(贼克法·比用法·涉害法 [S1]) ----------
// 返回 { shang, zongmen, keti, detail } 或 null(四课无贼克)
function dlrSelectByZeike(siKe, dayGan, ganShang, zhiShang) {
  var isYang = dlrIsYangGan(dayGan);
  var zei = [], ke = [];
  siKe.forEach(function (k, i) {
    if (dlrKe(k.xia, k.shang)) zei.push({ shang: k.shang, linGong: k.xiaGong, keIdx: i });
    else if (dlrKe(k.shang, k.xia)) ke.push({ shang: k.shang, linGong: k.xiaGong, keIdx: i });
  });
  // 下贼上优先于上克下 [S1]: 取课先从下贼呼, 如无下贼上克初
  if (zei.length === 1) {
    return { shang: zei[0].shang, zongmen: '贼克法', keti: '重审课', detail: '一下贼上, 取上神' + zei[0].shang + '发用' };
  }
  if (zei.length === 0 && ke.length === 1) {
    return { shang: ke[0].shang, zongmen: '贼克法', keti: '元首课', detail: '一上克下, 取上神' + ke[0].shang + '发用' };
  }
  if (zei.length === 0 && ke.length === 0) return null;
  var cands = zei.length > 0 ? zei : ke;
  var type = zei.length > 0 ? '贼' : '克';
  // 比用法 [S1]: 常将天日比神用, 阳日用阳阴用阴
  var matched = cands.filter(function (c) { return dlrIsYangZhi(c.shang) === isYang; });
  if (matched.length === 1) {
    return { shang: matched[0].shang, zongmen: '比用法', keti: '知一课', detail: (zei.length > 0 ? '多重审' : '多克') + '取与日干' + (isYang ? '阳' : '阴') + '比和者' + matched[0].shang };
  }
  // 俱比(剩多个)或俱不比(剩零个) → 涉害法 [S1/S4]
  var pool = matched.length > 1 ? matched : cands;
  var sh = dlrSheHaiSelect(pool, type, isYang, ganShang, zhiShang);
  return {
    shang: sh.shang, zongmen: '涉害法', keti: sh.keti,
    detail: (matched.length > 1 ? '俱比' : '俱不比') + ', 涉害' + sh.count + '重克取' + sh.shang
  };
}

// ---------- 九宗门取三传 ----------
function dlrSanChuan(ctx) {
  var tianPan = ctx.tianPan, siKe = ctx.siKe;
  var dayGan = ctx.dayGan, dayZhi = ctx.dayZhi;
  var isYang = dlrIsYangGan(dayGan);
  var ganShang = siKe[0].shang; // 干上神
  var zhiShang = siKe[2].shang; // 支上神
  // 常规中末传 [S1]: 初传之上名中次, 中上加临是末居
  function normalZhongMo(chu) {
    var zhong = tianPan[chu];
    var mo = tianPan[zhong];
    return [chu, zhong, mo];
  }

  // ===== 伏吟法 [S1/S6]: 月将=占时, 诸神归本位 =====
  if (ctx.isFuYin) {
    var fChu, fKeti, fDetail;
    var zk = dlrSelectByZeike(siKe, dayGan, ganShang, zhiShang);
    if (zk) {
      fChu = zk.shang; fKeti = '伏吟·' + zk.keti; fDetail = '伏吟有克还为用(' + zk.detail + ')';
    } else {
      fChu = isYang ? ganShang : zhiShang;
      fKeti = isYang ? '自任格' : '自信格';
      fDetail = '伏吟无克, ' + (isYang ? '刚日取干上神' : '柔日取支上神') + fChu + '发用';
    }
    // 迤逦刑之作中末 [S1]; 初传自刑则中传阳日用支上、阴日用干上 [S6 指南];
    // 中传再自刑, 末传取中传所冲不论刑 [S1]
    var fZhong;
    if (dlrIsZiXing(fChu)) {
      fZhong = isYang ? zhiShang : ganShang;
      fKeti += '/杜传格';
      fDetail += '; 初传自刑, 中传取' + (isYang ? '支上神' : '干上神') + fZhong;
    } else {
      fZhong = DLR_XING[fChu];
      fDetail += '; 中传取初传所刑' + fZhong;
    }
    var fMo = dlrIsZiXing(fZhong) ? dlrChong(fZhong) : DLR_XING[fZhong];
    fDetail += dlrIsZiXing(fZhong) ? '; 中传自刑, 末传取所冲' + fMo : '; 末传取中传所刑' + fMo;
    return { chuan: [fChu, fZhong, fMo], zongmen: '伏吟法', keti: fKeti, detail: fDetail };
  }

  // ===== 返吟法 [S1]: 月将与占时相冲 =====
  if (ctx.isFanYin) {
    var zk2 = dlrSelectByZeike(siKe, dayGan, ganShang, zhiShang);
    if (zk2) {
      // 返吟有克克初生, 理取先冲而后刑: 中传=初传之冲, 末传=中传之冲(末=初) [S1]
      var rChu = zk2.shang;
      var rZhong = dlrChong(rChu);
      var rMo = dlrChong(rZhong);
      return {
        chuan: [rChu, rZhong, rMo], zongmen: '返吟法', keti: '无依课(' + zk2.keti + ')',
        detail: '返吟有克取克发用(' + zk2.detail + '), 中末递冲'
      };
    }
    // 无克别有井栏名: 取日支驿马发用, 中传支上神, 末传干上神 [S1]
    var ma = DLR_YIMA[dayZhi];
    return {
      chuan: [ma, zhiShang, ganShang], zongmen: '返吟法', keti: '井栏叉(无亲课)',
      detail: '返吟无克, 取日支驿马' + ma + '发用, 中传支上' + zhiShang + ', 末传干上' + ganShang
    };
  }

  // ===== 贼克/比用/涉害 =====
  var first = dlrSelectByZeike(siKe, dayGan, ganShang, zhiShang);
  if (first) {
    return { chuan: normalZhongMo(first.shang), zongmen: first.zongmen, keti: first.keti, detail: first.detail };
  }

  // ===== 八专法 [S1/S5]: 干支同位(干寄宫=日支), 四课两备; 无贼克不复取遥 =====
  // 附: 四课仅两课(两两相同)亦按八专法取
  if (ctx.isBaZhuan || ctx.distinctCount === 2) {
    var bChu;
    if (isYang) {
      // 阳日日阳顺行三(连本位): 从干上神在天盘顺数第三位 [S5]
      bChu = DLR_ZHI[(DLR_ZHI.indexOf(ganShang) + 2) % 12];
    } else {
      // 阴日辰阴逆三位(连本位): 从第四课上神(支之阴神)逆数第三位 [S5]
      bChu = DLR_ZHI[(DLR_ZHI.indexOf(siKe[3].shang) + 10) % 12];
    }
    var bKeti = (bChu === ganShang) ? '八专·独足课' : '八专课';
    return {
      chuan: [bChu, ganShang, ganShang], zongmen: '八专法', keti: bKeti,
      detail: '四课两备无克, ' + (isYang ? '阳日从干上神' + ganShang + '顺数三位' : '阴日从第四课上神' + siKe[3].shang + '逆数三位') + '得' + bChu + ', 中末俱归干上'
    };
  }

  // ===== 遥克法 [S1]: 四课无克号为遥 =====
  // 先取神遥克其日(蒿矢), 如无方取日来遥(弹射); 多者比用, 再不定涉害
  var uppers = [];
  siKe.forEach(function (k, i) {
    if (!uppers.some(function (u) { return u.shang === k.shang; })) {
      uppers.push({ shang: k.shang, linGong: k.xiaGong, keIdx: i });
    }
  });
  var shenKeGan = uppers.filter(function (u) { return dlrKe(u.shang, dayGan); });
  var ganKeShen = uppers.filter(function (u) { return dlrKe(dayGan, u.shang); });
  if (shenKeGan.length > 0 || ganKeShen.length > 0) {
    var yCands = shenKeGan.length > 0 ? shenKeGan : ganKeShen;
    var yType = shenKeGan.length > 0 ? '克' : '贼'; // 蒿矢: 神为克者; 弹射: 神为受克者
    var yKeti = shenKeGan.length > 0 ? '蒿矢课' : '弹射课';
    var yChu, yZongmen = '遥克法', yDetail;
    if (yCands.length === 1) {
      yChu = yCands[0].shang;
      yDetail = (shenKeGan.length > 0 ? '上神' + yChu + '遥克日干' : '日干遥克上神' + yChu);
    } else {
      var yMatched = yCands.filter(function (c) { return dlrIsYangZhi(c.shang) === isYang; });
      if (yMatched.length === 1) {
        yChu = yMatched[0].shang;
        yDetail = '遥克多位, 比用取' + yChu;
      } else {
        // 俱比/俱不比: 以涉害深者定(流派补充处理, 口诀未明言, 注释存疑)
        var yPool = yMatched.length > 1 ? yMatched : yCands;
        var ysh = dlrSheHaiSelect(yPool, yType, isYang, ganShang, zhiShang);
        yChu = ysh.shang;
        yDetail = '遥克俱比俱不比, 涉害取' + yChu;
      }
    }
    return { chuan: normalZhongMo(yChu), zongmen: yZongmen, keti: yKeti, detail: yDetail };
  }

  // ===== 别责法 [S1/S5]: 四课不全三课备, 无遥无克 =====
  if (ctx.distinctCount === 3) {
    var zChu;
    if (isYang) {
      // 刚日干合上头神: 取干合之干寄宫上所乘天盘神 [S5]
      var heGan = DLR_GANHE[dayGan];
      zChu = tianPan[DLR_JIGONG[heGan]];
    } else {
      // 柔日支前三合取: 三合局(孟仲季序)中日支之后一位, 即日支顺移四位 [S5/指南]
      zChu = DLR_ZHI[(DLR_ZHI.indexOf(dayZhi) + 4) % 12];
    }
    return {
      chuan: [zChu, ganShang, ganShang], zongmen: '别责法', keti: '别责课(芜淫)',
      detail: isYang ? '刚日取干合(' + dayGan + '合' + DLR_GANHE[dayGan] + ')上神' + zChu : '柔日取支前三合' + zChu,
    };
  }

  // ===== 昴星法 [S1/S5]: 四课全备, 无遥无克 =====
  if (ctx.distinctCount === 4) {
    var mChu, mZhong, mMo, mKeti, mDetail;
    if (isYang) {
      // 阳仰: 取地盘酉上之天盘神(虎视转蓬); 刚日先辰而后日: 中传支上, 末传干上 [S5]
      mChu = tianPan['酉'];
      mZhong = zhiShang; mMo = ganShang;
      mKeti = '虎视转蓬';
      mDetail = '阳日仰视, 取地盘酉上天盘神' + mChu + '发用';
    } else {
      // 阴俯: 取天盘酉下之地盘神(冬蛇掩目); 柔日先日而后辰: 中传干上, 末传支上 [S5]
      for (var g2 = 0; g2 < 12; g2++) { if (tianPan[DLR_ZHI[g2]] === '酉') { mChu = DLR_ZHI[g2]; break; } }
      mZhong = ganShang; mMo = zhiShang;
      mKeti = '冬蛇掩目';
      mDetail = '阴日俯视, 取天盘酉下地盘神' + mChu + '发用';
    }
    return { chuan: [mChu, mZhong, mMo], zongmen: '昴星法', keti: mKeti, detail: mDetail };
  }

  // 九宗门全部不适用 — 不应发生, 显式报错(禁止静默回退)
  throw new Error('九宗门均无法取三传(四课' + ctx.distinctCount + '备), 请核查输入: ' + ctx.dayGZ + '日 ' + ctx.yueJiangZhi + '将 ' + ctx.hourZhi + '时');
}

// ---------- 十二天将 [S3] ----------
function dlrBuTianJiang(tianPan, dayGan, hourZhi) {
  var isDay = dlrIsDay(hourZhi);
  var guiZhi = DLR_GUIREN[dayGan][isDay ? 0 : 1];
  // 贵人所临地盘宫
  var linGong = null;
  for (var i = 0; i < 12; i++) { if (tianPan[DLR_ZHI[i]] === guiZhi) { linGong = DLR_ZHI[i]; break; } }
  // 贵人临地盘亥子丑寅卯辰顺布, 临巳午未申酉戌逆布 [S3]
  var shun = '亥子丑寅卯辰'.indexOf(linGong) >= 0;
  var map = {};
  var guiIdx = DLR_ZHI.indexOf(guiZhi);
  for (var j = 0; j < 12; j++) {
    var s = DLR_ZHI[j];
    var off = shun ? ((j - guiIdx + 12) % 12) : ((guiIdx - j + 12) % 12);
    map[s] = DLR_TIANJIANG[off];
  }
  return { map: map, guiZhi: guiZhi, isDay: isDay, linGong: linGong, shun: shun };
}

// ---------- 三传遁干(旬遁, 空亡支无遁干标"空") ----------
function dlrDunGan(dayGZ, zhi) {
  var XUN = (typeof window !== 'undefined' && window.XUN) || (typeof globalThis !== 'undefined' && globalThis.XUN);
  if (!XUN || !XUN[dayGZ]) return '';
  var shou = XUN[dayGZ];
  var gan0 = DLR_GAN.indexOf(shou.charAt(0));
  var zhi0 = DLR_ZHI.indexOf(shou.charAt(1));
  var off = (DLR_ZHI.indexOf(zhi) - zhi0 + 12) % 12;
  if (off >= 10) return '空'; // 旬空之支
  return DLR_GAN[(gan0 + off) % 10];
}

/**
 * 起课入口
 * method: 'time'   params: { dt }  — 按公历时间起课(四柱/月将/占时自动推算)
 *         'manual' params: { dayGZ, yueJiang, hourZhi } — 手动指定日干支/月将支/占时支(测课例用)
 */
function paiKe(method, params) {
  params = params || {};
  var dayGZ, yueJiangZhi, hourZhi, siZhu = null, yueJiangInfo = null, dt = null;

  if (method === 'time') {
    dt = params.dt || new Date();
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) throw new Error('起课时间无效');
    var Solar = dlrGetSolarEngine(dt);
    var lunar = Solar.fromYmdHms(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds() || 0).getLunar();
    var EC = dlrGetEightChar();
    if (!EC) throw new Error('八字引擎(EightChar)未加载，无法排四柱');
    var ec = EC.fromLunar(lunar);
    // 日柱按子初(23:00)换日, 与八字一致; 六壬有派按早子初/夜子初另论, 改时核对
    siZhu = { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), hour: ec.getTime() };
    dayGZ = siZhu.day;
    hourZhi = siZhu.hour.charAt(1);
    yueJiangInfo = dlrYueJiangFromDate(dt);
    yueJiangZhi = yueJiangInfo.zhi;
  } else if (method === 'manual') {
    dayGZ = String(params.dayGZ || '');
    if (dayGZ.length !== 2) throw new Error('日干支无效: ' + dayGZ);
    dlrRequireGan(dayGZ.charAt(0), '日干');
    dlrRequireZhi(dayGZ.charAt(1), '日支');
    yueJiangZhi = dlrRequireZhi(params.yueJiang, '月将');
    hourZhi = dlrRequireZhi(params.hourZhi, '占时');
    yueJiangInfo = { zhi: yueJiangZhi, name: DLR_YUEJIANG_NAME[yueJiangZhi], zhongqi: null, since: null };
  } else {
    throw new Error('未知起课方式: ' + method);
  }

  var dayGan = dayGZ.charAt(0), dayZhi = dayGZ.charAt(1);

  // 天盘: 月将加占时 [S2]。tianPan[地盘支] = 天盘支, 天盘[占时位] = 月将
  var offset = (DLR_ZHI.indexOf(yueJiangZhi) - DLR_ZHI.indexOf(hourZhi) + 12) % 12;
  var tianPan = {};
  for (var i = 0; i < 12; i++) tianPan[DLR_ZHI[i]] = DLR_ZHI[(i + offset) % 12];

  // 四课 [S2]: 一干上, 二干上之上, 三支上, 四支上之上(干以寄宫论)
  var ganGong = DLR_JIGONG[dayGan];
  var s1 = tianPan[ganGong], s2 = tianPan[s1], s3 = tianPan[dayZhi], s4 = tianPan[s3];
  var siKe = [
    { idx: 1, shang: s1, xia: dayGan, xiaGong: ganGong },
    { idx: 2, shang: s2, xia: s1, xiaGong: s1 },
    { idx: 3, shang: s3, xia: dayZhi, xiaGong: dayZhi },
    { idx: 4, shang: s4, xia: s3, xiaGong: s3 }
  ];
  // 课备数: 以(下宫,上神)去重 — 干与寄宫同位者算同一课(别责/八专判据 [S5])
  var seen = {};
  siKe.forEach(function (k) { seen[k.xiaGong + '|' + k.shang] = true; });
  var distinctCount = Object.keys(seen).length;

  var isBaZhuan = ganGong === dayZhi; // 干支同位(甲寅/丁未/己未/庚申/癸丑五日 [S5])
  var isFuYin = yueJiangZhi === hourZhi;
  var isFanYin = dlrChong(yueJiangZhi) === hourZhi;

  // 十二天将
  var jiang = dlrBuTianJiang(tianPan, dayGan, hourZhi);
  siKe.forEach(function (k) { k.shangJiang = jiang.map[k.shang]; });

  // 九宗门取三传
  var sc = dlrSanChuan({
    tianPan: tianPan, siKe: siKe, dayGan: dayGan, dayZhi: dayZhi, dayGZ: dayGZ,
    yueJiangZhi: yueJiangZhi, hourZhi: hourZhi,
    isFuYin: isFuYin, isFanYin: isFanYin, isBaZhuan: isBaZhuan, distinctCount: distinctCount
  });
  var chuanNames = ['初传', '中传', '末传'];
  var sanChuan = sc.chuan.map(function (z, i2) {
    return { name: chuanNames[i2], shen: z, jiang: jiang.map[z], dunGan: dlrDunGan(dayGZ, z) };
  });

  // 旬空
  var getXunKong = (typeof window !== 'undefined' && window.getXunKong) || (typeof globalThis !== 'undefined' && globalThis.getXunKong);
  var xunKong = typeof getXunKong === 'function' ? getXunKong(dayGZ) : '';

  return {
    method: method,
    methodLabel: method === 'time' ? '时间起课' : '手动起课',
    input: params,
    dt: dt,
    siZhu: siZhu,
    dayGZ: dayGZ, dayGan: dayGan, dayZhi: dayZhi, hourZhi: hourZhi,
    yueJiang: { zhi: yueJiangZhi, name: DLR_YUEJIANG_NAME[yueJiangZhi], zhongqi: yueJiangInfo.zhongqi },
    tianPan: tianPan,
    siKe: siKe,
    sanChuan: sanChuan,
    faYong: { zongmen: sc.zongmen, keti: sc.keti, detail: sc.detail },
    guiRen: { zhi: jiang.guiZhi, isDay: jiang.isDay, linGong: jiang.linGong, shun: jiang.shun },
    tianJiang: jiang.map,
    xunKong: xunKong,
    flags: { fuYin: isFuYin, fanYin: isFanYin, baZhuan: isBaZhuan, keBei: distinctCount }
  };
}

// 组装给 AI 的确定性事实 prompt (课传/天将为代码定论, AI 不可更改)
function formatDaliurenPrompt(pan, question) {
  var text = '【大六壬起课·' + pan.methodLabel + '】\n';
  if (pan.siZhu) {
    text += '四柱：' + pan.siZhu.year + '年 ' + pan.siZhu.month + '月 ' + pan.siZhu.day + '日 ' + pan.siZhu.hour + '时\n';
  } else {
    text += '日干支：' + pan.dayGZ + '  占时：' + pan.hourZhi + '时\n';
  }
  text += '月将：' + pan.yueJiang.zhi + '将' + pan.yueJiang.name + (pan.yueJiang.zhongqi ? '（' + pan.yueJiang.zhongqi + '后）' : '') + '，加占时' + pan.hourZhi + '位\n';
  if (pan.flags.fuYin) text += '课式：伏吟（诸神归本位）\n';
  else if (pan.flags.fanYin) text += '课式：返吟（天地盘相冲）\n';
  else if (pan.flags.baZhuan) text += '课式：八专（干支同位）\n';
  text += '\n天盘（地盘→天盘）：';
  text += DLR_ZHI.map(function (z) { return z + '上' + pan.tianPan[z]; }).join('，') + '\n';
  text += '\n四课（上神/下神，附天将）：\n';
  var keNames = ['一', '二', '三', '四'];
  pan.siKe.forEach(function (k, i) {
    text += '  第' + keNames[i] + '课：' + k.shang + '（' + k.shangJiang + '）/' + k.xia + '\n';
  });
  text += '\n三传（发用' + pan.faYong.zongmen + '·' + pan.faYong.keti + '）：\n';
  pan.sanChuan.forEach(function (c) {
    text += '  ' + c.name + '：' + c.shen + '（' + c.jiang + (c.dunGan ? '，遁' + c.dunGan : '') + '）\n';
  });
  text += '发用详情：' + pan.faYong.detail + '\n';
  text += '贵人：' + pan.guiRen.zhi + '（' + (pan.guiRen.isDay ? '昼' : '夜') + '贵，临地盘' + pan.guiRen.linGong + '宫' + (pan.guiRen.shun ? '顺' : '逆') + '布）\n';
  if (pan.xunKong) text += '旬空：' + pan.xunKong + '\n';
  if (question) text += '\n所问之事：' + question + '\n';
  return text;
}

window.daliuren = {
  GAN: DLR_GAN,
  ZHI: DLR_ZHI,
  JIGONG: DLR_JIGONG,
  GUIREN: DLR_GUIREN,
  TIANJIANG: DLR_TIANJIANG,
  YUEJIANG_NAME: DLR_YUEJIANG_NAME,
  ZHONGQI: DLR_ZHONGQI,
  paiKe: paiKe,
  formatDaliurenPrompt: formatDaliurenPrompt,
  sheHaiCount: dlrSheHaiCount,
  isDay: dlrIsDay
};
