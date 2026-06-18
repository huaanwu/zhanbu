/**
 * 奇门遁甲排盘系统 - 纯 JavaScript 版
 * 移植自 backend/divination/qimen.py + paipan.py
 */

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const JIE_QI_NAMES = ['冬至','小寒','大寒','立春','雨水','惊蛰',
                      '春分','清明','谷雨','立夏','小满','芒种',
                      '夏至','小暑','大暑','立秋','处暑','白露',
                      '秋分','寒露','霜降','立冬','小雪','大雪'];

const YANG_DUN_JUSHU = {
  '冬至':[1,7,4],'小寒':[2,8,5],'大寒':[3,9,6],
  '立春':[8,5,2],'雨水':[9,6,3],'惊蛰':[1,7,4],
  '春分':[3,9,6],'清明':[4,1,7],'谷雨':[5,2,8],
  '立夏':[4,1,7],'小满':[5,2,8],'芒种':[6,3,9],
};

const YIN_DUN_JUSHU = {
  '夏至':[9,3,6],'小暑':[8,2,5],'大暑':[7,1,4],
  '立秋':[2,5,8],'处暑':[1,4,7],'白露':[9,3,6],
  '秋分':[7,1,4],'寒露':[6,9,3],'霜降':[5,8,2],
  '立冬':[6,9,3],'小雪':[5,8,2],'大雪':[4,7,1],
};

const GONG_DIRECTION = {1:'北',2:'西南',3:'东',4:'东南',5:'中',6:'西北',7:'西',8:'东北',9:'南'};
const GONG_WUXING = {1:'水',2:'土',3:'木',4:'木',5:'土',6:'金',7:'金',8:'土',9:'火'};
const GONG_NAME = {1:'坎一宫',2:'坤二宫',3:'震三宫',4:'巽四宫',5:'中五宫',6:'乾六宫',7:'兑七宫',8:'艮八宫',9:'离九宫'};

const LIU_YI = ['戊','己','庚','辛','壬','癸'];
const SAN_QI = ['乙','丙','丁'];
const LiuYiXunShou_TianGan = {'戊':'甲子戊','己':'甲戌己','庚':'甲申庚','辛':'甲午辛','壬':'甲辰壬','癸':'甲寅癸'};
const LiuYiXunShou_DiZhi = {'子':'甲子戊','戌':'甲戌己','申':'甲申庚','午':'甲午辛','辰':'甲辰壬','寅':'甲寅癸'};

const JIU_XING = ['天蓬','天任','天冲','天辅','天英','天芮','天柱','天心','天禽'];
// 8门：中五宫不排门（寄于坤二宫）
const BA_MEN = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];
// 9神：中五宫寄"中正"（或"直符"），传统9神齐全
const BA_SHEN = ['直符','腾蛇','太阴','六合','白虎','玄武','九地','九天','中正'];

const TGDZ_EPOCHS = [
  ['甲子','乙丑','丙寅','丁卯','戊辰','己巳','庚午','辛未','壬申','癸酉'],
  ['甲戌','乙亥','丙子','丁丑','戊寅','己卯','庚辰','辛巳','壬午','癸未'],
  ['甲申','乙酉','丙戌','丁亥','戊子','己丑','庚寅','辛卯','壬辰','癸巳'],
  ['甲午','乙未','丙申','丁酉','戊戌','己亥','庚子','辛丑','壬寅','癸卯'],
  ['甲辰','乙巳','丙午','丁未','戊申','己酉','庚戌','辛亥','壬子','癸丑'],
  ['甲寅','乙卯','丙辰','丁巳','戊午','己未','庚申','辛酉','壬戌','癸亥'],
];

function tiangandizhiSequence() {
  const seq = [];
  for (const epoch of TGDZ_EPOCHS) {
    for (const gz of epoch) seq.push(gz);
  }
  return seq;
}
const TIAN_GAN_DI_ZHI_SEQ = tiangandizhiSequence();

function getGanZhi(offset) { return GAN[offset % 10] + ZHI[offset % 12]; }
function getYearGZ(year) { return getGanZhi(year - 4); }
function getMonthGZ(yearGan, month) {
  const wuHuDun = {'甲':'丙','己':'丙','乙':'戊','庚':'戊','丙':'庚','辛':'庚','丁':'壬','壬':'壬','戊':'甲','癸':'甲'};
  const startGan = wuHuDun[yearGan] || '丙';
  const startIdx = GAN.indexOf(startGan);
  const dzArr = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  return GAN[(startIdx + month - 1) % 10] + dzArr[month - 1];
}
function getDayGZ(dt) {
  const base = new Date(1900, 0, 31);
  const diff = Math.floor((dt - base) / 86400000);
  return getGanZhi(diff);
}
function getHourGZ(dayGan, hour) {
  const zhiIdx = Math.floor((hour + 1) / 2) % 12;
  const dayIdx = GAN.indexOf(dayGan);
  const ganIdx = (dayIdx * 2 + zhiIdx) % 10;
  return GAN[ganIdx] + ZHI[zhiIdx];
}

// === 节气计算 ===
const WINTER_SOLSTICE = {
  2000:[12,21],2001:[12,21],2002:[12,22],2003:[12,22],
  2004:[12,21],2005:[12,21],2006:[12,22],2007:[12,22],
  2008:[12,21],2009:[12,21],2010:[12,22],2011:[12,22],
  2012:[12,21],2013:[12,21],2014:[12,22],2015:[12,22],
  2016:[12,21],2017:[12,21],2018:[12,22],2019:[12,22],
  2020:[12,21],2021:[12,21],2022:[12,22],2023:[12,22],
  2024:[12,21],2025:[12,21],2026:[12,22],2027:[12,22],
  2028:[12,21],2029:[12,21],2030:[12,22],2031:[12,22],
  2032:[12,21],2033:[12,21],2034:[12,22],2035:[12,22],
  2036:[12,21],2037:[12,21],2038:[12,22],2039:[12,22],
  2040:[12,21],2041:[12,21],2042:[12,22],2043:[12,22],
  2044:[12,21],2045:[12,21],2046:[12,22],2047:[12,22],
  2048:[12,21],2049:[12,21],2050:[12,22],
};

function getWinterSolstice(year) {
  if (WINTER_SOLSTICE[year]) return WINTER_SOLSTICE[year];
  // 基于2000年冬至（12月21日）的4年周期近似估算
  const offset = year - 2000;
  const rem = ((offset % 4) + 4) % 4;
  return [12, (rem === 0 || rem === 1) ? 21 : 22];
}

function getJieQiInfo(year, month, day, hour) {
  // 首选 lunar-javascript
  if (window.Solar) {
    try {
      const solar = window.Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();
      if (lunar.getPrevJieQi) {
        const prev = lunar.getPrevJieQi();
        if (prev) {
          const name = prev.getName ? prev.getName() : prev.name;
          const pSolar = prev.getSolar ? prev.getSolar() : prev.solar;
          if (name && pSolar && JIE_QI_NAMES.includes(name)) {
            const py = pSolar.getYear ? pSolar.getYear() : pSolar.year;
            const pm = pSolar.getMonth ? pSolar.getMonth() : pSolar.month;
            const pd = pSolar.getDay ? pSolar.getDay() : pSolar.day;
            const jqTime = new Date(py, pm - 1, pd).getTime();
            const curTime = new Date(year, month - 1, day, hour).getTime();
            const days = (curTime - jqTime) / 86400000;
            return { name, days };
          }
        }
      }
    } catch(e) {}
  }

  // fallback: 冬至基准 + 15.2184天间隔
  const cur = new Date(year, month - 1, day, hour);
  const ws = getWinterSolstice(year);
  let wsDate = new Date(year, ws[0] - 1, ws[1]);
  if (cur < wsDate) {
    const wsPrev = getWinterSolstice(year - 1);
    wsDate = new Date(year - 1, wsPrev[0] - 1, wsPrev[1]);
  }
  const daysFromWs = (cur - wsDate) / 86400000;
  const jqIndex = Math.min(Math.floor(daysFromWs / 15.218425), 23);
  const name = JIE_QI_NAMES[jqIndex];
  const days = daysFromWs - jqIndex * 15.218425;
  return { name, days };
}

// === 奇门排盘 ===
class QiYi {
  constructor(name) {
    this.name = name;
    this.isZhifu = false;
    this.xunshouFormate = LIU_YI.includes(name) ? LiuYiXunShou_TianGan[name] : null;
  }
}

function sanqiliuyi(isYangdun) {
  const arr = [...LIU_YI, ...SAN_QI.slice().reverse()];
  const seq = arr.map(name => new QiYi(name));
  if (!isYangdun) seq.reverse();
  return seq;
}

class JiuXing { constructor(name) { this.name = name; } }
class BaMen { constructor(name) { this.name = name; } }
class BaShen { constructor(name) { this.name = name; } }

class JiuGong {
  constructor(name, luoshu) {
    this.name = name;
    this.luoshu = luoshu;
    this.isDipanZhifu = false;
    this.isTianpanZhifu = false;
    this.isRenpanZhishi = false;
    this.dipan = [];
    this.tianpan = [];
    this.jiuxing = [];
    this.renpan = null;
    this.shenpan = null;
  }
}

function jiugongByLuoshu() {
  const names = ['坎一宫','坤二宫','震三宫','巽四宫','中五宫','乾六宫','兑七宫','艮八宫','离九宫'];
  return names.map((n, i) => new JiuGong(n, i + 1));
}

function jiugongByDirection(jiugong) {
  const dirOrder = [1, 8, 3, 4, 9, 2, 7, 6, 5];
  const map = {};
  for (const g of jiugong) map[g.luoshu] = g;
  return dirOrder.map(n => map[n]);
}

class PaiPan {
  constructor(bazi, isYangdun, jushu) {
    for (const gz of bazi) {
      if (!TIAN_GAN_DI_ZHI_SEQ.includes(gz)) throw new Error('Invalid bazi: ' + gz);
    }
    this.shichen = bazi[3];
    this.shigan = this.shichen[0];
    if (this.shigan === '甲') {
      const xs = this.shichenXunshou();
      this.shigan = LiuYiXunShou_DiZhi[xs[1]].slice(-1);
    }
    this.isYangdun = isYangdun;
    this.jushu = jushu;
    this.pan = [];
    this.dipan();
    this.tianpan();
    this.renpan();
    this.shenpan();
  }

  shichenXunshou() {
    for (const epoch of TGDZ_EPOCHS) {
      if (epoch.includes(this.shichen)) return epoch[0];
    }
    return '甲子';
  }

  dipan() {
    const ordered = jiugongByLuoshu();
    for (let i = 0; i < ordered.length; i++) {
      let pos = this.jushu + i - 1;
      if (pos >= ordered.length) pos -= ordered.length;
      this.pan.push(ordered[pos]);
    }

    const qiyi = sanqiliuyi(this.isYangdun);
    for (let j = 0; j < this.pan.length; j++) {
      this.pan[j].dipan.push(qiyi[j]);
    }

    const xs = this.shichenXunshou();
    const zhifuName = LiuYiXunShou_DiZhi[xs[1]];
    const zhifuGan = zhifuName.slice(-1);

    for (const gong of this.pan) {
      for (const qy of gong.dipan) {
        if (qy.name === zhifuGan) gong.isDipanZhifu = true;
      }
    }

    let jigong = [];
    for (const gong of this.pan) {
      if (gong.luoshu === 5) jigong = gong.dipan;
    }
    for (const gong of this.pan) {
      if (gong.luoshu === 2) gong.dipan = gong.dipan.concat(jigong);
    }
  }

  tianpan() {
    let dirOrdered = jiugongByDirection(this.pan);

    let zhifuStart = [];
    for (let i = 0; i < dirOrdered.length; i++) {
      if (dirOrdered[i].isDipanZhifu) {
        zhifuStart = dirOrdered.slice(i).concat(dirOrdered.slice(0, i));
        break;
      }
    }

    let shiganStart = [];
    for (let j = 0; j < dirOrdered.length; j++) {
      const names = dirOrdered[j].dipan.map(q => q.name);
      if (names.includes(this.shigan)) {
        shiganStart = dirOrdered.slice(j).concat(dirOrdered.slice(0, j));
        break;
      }
    }

    for (let k = 0; k < dirOrdered.length; k++) {
      shiganStart[k].tianpan = shiganStart[k].tianpan.concat(zhifuStart[k].dipan);
    }
    shiganStart[0].isTianpanZhifu = true;

    dirOrdered = jiugongByDirection(shiganStart);
    const jxSeq = JIU_XING.map(n => new JiuXing(n));
    for (let l = 0; l < dirOrdered.length; l++) {
      dirOrdered[l].jiuxing.push(jxSeq[l]);
    }
    this.pan = dirOrdered;

    let jigong = [];
    for (const gong of this.pan) {
      if (gong.luoshu === 5) jigong = gong.jiuxing;
    }
    for (const gong of this.pan) {
      if (gong.tianpan.length === 2) gong.jiuxing = gong.jiuxing.concat(jigong);
    }
  }

  renpan() {
    const dirOrdered = jiugongByDirection(this.pan);
    const xs = this.shichenXunshou();
    const xsGan = LiuYiXunShou_DiZhi[xs[1]].slice(-1);

    let targetGong = null;
    for (const g of this.pan) {
      for (const qy of g.dipan) {
        if (qy.name === xsGan) { targetGong = g; break; }
      }
      if (targetGong) break;
    }

    // 8门→洛书数映射（八门宫位：休1坎、生8艮、伤3震、杜4巽、景9离、死2坤、惊7兑、开6乾）
    // 中五宫不排门（寄坤二宫或不动）
    const MEN_TO_LUOSHU = { '休门':1, '生门':8, '伤门':3, '杜门':4, '景门':9, '死门':2, '惊门':7, '开门':6 };
    const LUO_TO_DIR = { 1:'坎一宫', 2:'坤二宫', 3:'震三宫', 4:'巽四宫', 5:'中五宫', 6:'乾六宫', 7:'兑七宫', 8:'艮八宫', 9:'离九宫' };
    // 找到值使门所在的洛书数（targetGong 对应数）
    let targetLuoshu = null;
    for (const [k, v] of Object.entries(LUO_TO_DIR)) {
      if (v === targetGong.name) { targetLuoshu = Number(k); break; }
    }
    if (!targetLuoshu) return;

    // 先把 9 宫的 renpan 清空
    for (const gong of dirOrdered) gong.renpan = null;

    // 8门按"门→宫"固定关系排，从值使门所在洛书数开始旋转
    // 阳遁：顺时针旋转（顺行）；阴遁：逆时针旋转（逆行）
    // 九宫洛书顺时针顺序：1(坎)→8(艮)→3(震)→4(巽)→9(离)→2(坤)→7(兑)→6(乾)→1
    const LUO_TRAVEL_CW = [1,8,3,4,9,2,7,6]; // 顺时针（阳遁）
    const LUO_TRAVEL_CCW = [1,6,7,2,9,4,3,8]; // 逆时针（阴遁）
    const travel = this.isYangdun ? LUO_TRAVEL_CW : LUO_TRAVEL_CCW;
    const startIdx = travel.indexOf(targetLuoshu);

    if (startIdx >= 0) {
      const doorNames = Object.keys(MEN_TO_LUOSHU);
      for (let i = 0; i < 8; i++) {
        const luoshu = travel[(startIdx + i) % 8];
        if (luoshu === 5) continue; // 中五宫不排门
        const menName = doorNames.find(m => MEN_TO_LUOSHU[m] === luoshu);
        if (!menName) continue;
        const gongName = LUO_TO_DIR[luoshu];
        const gong = dirOrdered.find(g => g.name === gongName);
        if (gong) {
          gong.renpan = new BaMen(menName);
          gong.zhishiStep = i; // 值使门从值符宫出发的运行步数（0=起点）
          if (i === 0) gong.isRenpanZhishi = true;
        }
      }
    }
  }

  shenpan() {
    const dirOrdered = jiugongByDirection(this.pan);
    let startIdx = 0;
    for (let i = 0; i < dirOrdered.length; i++) {
      if (dirOrdered[i].isTianpanZhifu) { startIdx = i; break; }
    }
    const bsSeq = BA_SHEN.map(n => new BaShen(n));
    for (let j = 0; j < dirOrdered.length; j++) {
      const seqIdx = this.isYangdun
        ? (j - startIdx + 9) % 9
        : (startIdx - j + 9) % 9;
      dirOrdered[j].shenpan = bsSeq[seqIdx];
    }
  }
}

// === 主函数 ===
function getJushu(jieqiName, daysInJq) {
  let yuanIdx;
  if (daysInJq < 5) yuanIdx = 0;
  else if (daysInJq < 10) yuanIdx = 1;
  else yuanIdx = 2;

  if (YANG_DUN_JUSHU[jieqiName]) {
    return { isYang: true, jushu: YANG_DUN_JUSHU[jieqiName][yuanIdx] };
  } else if (YIN_DUN_JUSHU[jieqiName]) {
    return { isYang: false, jushu: YIN_DUN_JUSHU[jieqiName][yuanIdx] };
  }
  return { isYang: true, jushu: 1 };
}

function panQimen(year, month, day, hour, minute) {
  minute = minute || 0;
  const jq = getJieQiInfo(year, month, day, hour);
  const { isYang, jushu } = getJushu(jq.name, jq.days);

  const dt = new Date(year, month - 1, day, hour, minute);
  const yearGZ = getYearGZ(year);
  const monthGZ = getMonthGZ(yearGZ[0], month);
  const dayGZ = getDayGZ(dt);
  const hourGZ = getHourGZ(dayGZ[0], hour);
  const bazi = [yearGZ, monthGZ, dayGZ, hourGZ];

  const pp = new PaiPan(bazi, isYang, jushu);

  const gong9 = [];
  for (const gong of pp.pan) {
    gong9.push({
      gong: gong.luoshu,
      name: gong.name,
      direction: GONG_DIRECTION[gong.luoshu],
      wuxing: GONG_WUXING[gong.luoshu],
      dipan: gong.dipan.map(q => q.name).join(' '),
      tianpan: gong.tianpan.map(q => q.name).join(' '),
      jiuxing: gong.jiuxing.map(x => x.name).join(' '),
      renpan: gong.renpan ? gong.renpan.name : '',
      shenpan: gong.shenpan ? gong.shenpan.name : '',
      is_dipan_zhifu: gong.isDipanZhifu,
      is_tianpan_zhifu: gong.isTianpanZhifu,
      is_renpan_zhishi: gong.isRenpanZhishi,
      zhishi_step: gong.zhishiStep,
    });
  }
  gong9.sort((a, b) => a.gong - b.gong);

  // 值使门追踪信息
  let zhishiInfo = null;
  let zhishiTrack = []; // 值使门运行轨迹
  for (const g of gong9) {
    if (g.is_renpan_zhishi) {
      zhishiInfo = { step: g.zhishi_step, gong: g.name, direction: g.direction, men: g.renpan };
    }
    if (g.zhishi_step !== undefined) {
      zhishiTrack.push({ step: g.zhishi_step, gong: g.name, men: g.renpan });
    }
  }
  zhishiTrack.sort((a, b) => a.step - b.step);

  return {
    jieqi: jq.name,
    days_in_jq: Math.round(jq.days * 10) / 10,
    yang_dun: isYang,
    jushu: jushu,
    jushu_text: (isYang ? '阳' : '阴') + '遁' + jushu + '局',
    bazi: bazi,
    gong9: gong9,
    xunshou: pp.shichenXunshou(),
    shichen: pp.shichen,
    zhishi: zhishiInfo,
    zhishiTrack: zhishiTrack, // 值使门完整运行轨迹
    input_time: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
  };
}

function formatQimenPrompt(pan, question) {
  let s = '=== 奇门遁甲排盘 ===\n';
  s += `时间：${pan.input_time}\n`;
  s += `节气：${pan.jieqi}（已过${pan.days_in_jq}天）\n`;
  s += `局数：${pan.jushu_text}\n`;
  s += `四柱：${pan.bazi.join(' ')}\n`;
  s += `旬首：${pan.xunshou}\n\n九宫格：\n`;
  for (const g of pan.gong9) {
    const zf = g.is_dipan_zhifu ? ' ★直符' : '';
    const zs = g.is_renpan_zhishi ? ' ★直使' : '';
    s += `${g.name}（${g.direction}${zf}${zs}）：`;
    s += `天盘${g.tianpan}/九星${g.jiuxing}，人盘${g.renpan}，神盘${g.shenpan}，地盘${g.dipan}\n`;
  }
  if (question) s += `\n所问之事：${question}\n`;
  // 值使门运行轨迹
  if (pan.zhishiTrack && pan.zhishiTrack.length > 0) {
    s += '\n值使门运行轨迹：\n';
    for (const t of pan.zhishiTrack) {
      s += `  第${t.step}步：${t.men} → ${t.gong}\n`;
    }
  }
  s += '\n请根据以上奇门遁甲排盘进行详细解读。';
  return s;
}

window.qimen = { panQimen, formatQimenPrompt };
