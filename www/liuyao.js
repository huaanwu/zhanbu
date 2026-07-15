// ========== 六爻纳甲排盘系统 v1.1 ==========
// 基础干支函数(GAN/ZHI/getYearGZ/getMonthGZ/getDayGZ/getHourGZ/getNaYin/getXunKong/
//   getYearGZEx/getMonthGZEx/getDayGZEx/getHourGZEx/_getNextDayGZ)由 lib/ganzhi.js 提供(单一来源)
// 本文件仅保留六爻特有: 64卦/纳甲/六亲/六神 + 起卦 + 纳甲 + panGua/formatLiuyaoPrompt
// 注: var TG/DZ 保留为本地别名(值与 window.GAN/ZHI 相同)
// ==============================================

var GUA_NAME = {
  1: ["乾", "☰", [1,1,1]],
  2: ["兑", "☱", [0,1,1]],
  3: ["离", "☲", [1,0,1]],
  4: ["震", "☳", [0,0,1]],
  5: ["巽", "☴", [1,1,0]],
  6: ["坎", "☵", [0,1,0]],
  7: ["艮", "☶", [1,0,0]],
  8: ["坤", "☷", [0,0,0]],
};

var LIUSHISIGUA = {
  "1,1": "乾为天", "1,2": "天泽履", "1,3": "天火同人", "1,4": "天雷无妄",
  "1,5": "天风姤", "1,6": "天水讼", "1,7": "天山遁", "1,8": "天地否",
  "2,1": "泽天夬", "2,2": "兑为泽", "2,3": "泽火革", "2,4": "泽雷随",
  "2,5": "泽风大过", "2,6": "泽水困", "2,7": "泽山咸", "2,8": "泽地萃",
  "3,1": "火天大有", "3,2": "火泽睽", "3,3": "离为火", "3,4": "火雷噬嗑",
  "3,5": "火风鼎", "3,6": "火水未济", "3,7": "火山旅", "3,8": "火地晋",
  "4,1": "雷天大壮", "4,2": "雷泽归妹", "4,3": "雷火丰", "4,4": "震为雷",
  "4,5": "雷风恒", "4,6": "雷水解", "4,7": "雷山小过", "4,8": "雷地豫",
  "5,1": "风天小畜", "5,2": "风泽中孚", "5,3": "风火家人", "5,4": "风雷益",
  "5,5": "巽为风", "5,6": "风水涣", "5,7": "风山渐", "5,8": "风地观",
  "6,1": "水天需", "6,2": "水泽节", "6,3": "水火既济", "6,4": "水雷屯",
  "6,5": "水风井", "6,6": "坎为水", "6,7": "水山蹇", "6,8": "水地比",
  "7,1": "山天大畜", "7,2": "山泽损", "7,3": "山火贲", "7,4": "山雷颐",
  "7,5": "山风蛊", "7,6": "山水蒙", "7,7": "艮为山", "7,8": "山地剥",
  "8,1": "地天泰", "8,2": "地泽临", "8,3": "地火明夷", "8,4": "地雷复",
  "8,5": "地风升", "8,6": "地水师", "8,7": "地山谦", "8,8": "坤为地",
};

var NA_JIA = {
  "乾": [["甲","子","水"],["甲","寅","木"],["甲","辰","土"],["壬","午","火"],["壬","申","金"],["壬","戌","土"]],
  "兑": [["丁","巳","火"],["丁","卯","木"],["丁","丑","土"],["丁","亥","水"],["丁","酉","金"],["丁","未","土"]],
  "离": [["己","卯","木"],["己","丑","土"],["己","亥","水"],["己","酉","金"],["己","未","土"],["己","巳","火"]],
  "震": [["庚","子","水"],["庚","寅","木"],["庚","辰","土"],["庚","午","火"],["庚","申","金"],["庚","戌","土"]],
  "巽": [["辛","丑","土"],["辛","亥","水"],["辛","酉","金"],["辛","未","土"],["辛","巳","火"],["辛","卯","木"]],
  "坎": [["戊","寅","木"],["戊","辰","土"],["戊","午","火"],["戊","申","金"],["戊","戌","土"],["戊","子","水"]],
  "艮": [["丙","辰","土"],["丙","午","火"],["丙","申","金"],["丙","戌","土"],["丙","子","水"],["丙","寅","木"]],
  "坤": [["乙","未","土"],["乙","巳","火"],["乙","卯","木"],["乙","丑","土"],["乙","亥","水"],["乙","酉","金"]],
};

var LIU_QIN = {
  "金,金": "兄弟", "金,木": "妻财", "金,水": "子孙", "金,火": "官鬼", "金,土": "父母",
  "木,木": "兄弟", "木,火": "子孙", "木,土": "妻财", "木,金": "官鬼", "木,水": "父母",
  "水,水": "兄弟", "水,木": "子孙", "水,火": "妻财", "水,土": "官鬼", "水,金": "父母",
  "火,火": "兄弟", "火,土": "子孙", "火,金": "妻财", "火,水": "官鬼", "火,木": "父母",
  "土,土": "兄弟", "土,金": "子孙", "土,水": "妻财", "土,木": "官鬼", "土,火": "父母",
};

var LIU_SHEN = ["青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武"];
var LIU_SHEN_START = { "甲":0,"乙":0,"丙":1,"丁":1,"戊":2,"己":3,"庚":4,"辛":4,"壬":5,"癸":5 };

var TG = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
var DZ = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
;
// ========== 起卦 ==========
function qiGuaByTime(dt) {
  const y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate(), h = dt.getHours();
  let upper = (y + m + d) % 8; if (upper === 0) upper = 8;
  let lower = (y + m + d + h) % 8; if (lower === 0) lower = 8;
  let dong = (y + m + d + h) % 6; if (dong === 0) dong = 6;
  return { method: "时间起卦", upper, lower, dong, dt };
}

function qiGuaByNumber(num1, num2, num3) {
  let upper = num1 % 8; if (upper === 0) upper = 8;
  let lower = num2 % 8; if (lower === 0) lower = 8;
  let dong = num3 != null ? num3 % 6 : (num1 + num2) % 6;
  if (dong === 0) dong = 6;
  return { method: "数字起卦", upper, lower, dong };
}

function qiGuaByRandom() {
  return qiGuaByNumber(Math.floor(Math.random()*100)+1, Math.floor(Math.random()*100)+1, Math.floor(Math.random()*100)+1);
}

// ========== 铜钱摇卦 ==========
function getGuaNumFromLines(lines) {
  for (let n = 1; n <= 8; n++) {
    if (arraysEqual(GUA_NAME[n][2], lines)) return n;
  }
  return 1;
}

function tossCoin() {
  const c1 = Math.random() < 0.5 ? 0 : 1; // 0=字(阴), 1=背(阳)
  const c2 = Math.random() < 0.5 ? 0 : 1;
  const c3 = Math.random() < 0.5 ? 0 : 1;
  const sum = c1 + c2 + c3;
  if (sum === 0) return { yao: 0, isDong: true,  label: '老阴', desc: '三枚字（阴动）' };
  if (sum === 1) return { yao: 0, isDong: false, label: '少阴', desc: '两枚字一枚背' };
  if (sum === 2) return { yao: 1, isDong: false, label: '少阳', desc: '一枚字两枚背' };
  return { yao: 1, isDong: true,  label: '老阳', desc: '三枚背（阳动）' };
}

function qiGuaByCoin() {
  const coinResults = [];
  const linesFromBottom = [];
  const dongYaoList = [];
  for (let i = 0; i < 6; i++) {
    const r = tossCoin();
    coinResults.push(r);
    linesFromBottom.push(r.yao);
    if (r.isDong) dongYaoList.push(i + 1);
  }
  const lowerLines = [linesFromBottom[2], linesFromBottom[1], linesFromBottom[0]];
  const upperLines = [linesFromBottom[5], linesFromBottom[4], linesFromBottom[3]];
  const lowerNum = getGuaNumFromLines(lowerLines);
  const upperNum = getGuaNumFromLines(upperLines);
  return {
    method: '铜钱摇卦',
    upper: upperNum, lower: lowerNum,
    dongYaoList, coinResults,
    lines: [...linesFromBottom].reverse()
  };
}

// ========== 排盘 ==========
function getGuaImage(upper, lower, dongYaoList) {
  const u = GUA_NAME[upper], l = GUA_NAME[lower];
  const benGua = [...l[2], ...u[2]];
  const bianGua = benGua.map((v, i) => dongYaoList.includes(getYaoIdxFromLineIdx(i)) ? 1 - v : v);
  const huXia = benGua.slice(1, 4);
  const huShang = benGua.slice(2, 5);

  let huLowerNum, huUpperNum;
  for (let n = 1; n <= 8; n++) {
    if (arraysEqual(GUA_NAME[n][2], huXia)) huLowerNum = n;
    if (arraysEqual(GUA_NAME[n][2], huShang)) huUpperNum = n;
  }
  const huGuaName = huLowerNum && huUpperNum ? LIUSHISIGUA[`${huUpperNum},${huLowerNum}`] : null;

  // 变卦上下卦
  const bianLowerLines = [bianGua[2], bianGua[1], bianGua[0]];
  const bianUpperLines = [bianGua[5], bianGua[4], bianGua[3]];
  let bianLowerNum, bianUpperNum;
  for (let n = 1; n <= 8; n++) {
    if (arraysEqual(GUA_NAME[n][2], bianLowerLines)) bianLowerNum = n;
    if (arraysEqual(GUA_NAME[n][2], bianUpperLines)) bianUpperNum = n;
  }

  const dongYaoNames = dongYaoList.map(d => ["初爻","二爻","三爻","四爻","五爻","上爻"][d - 1]);
  return {
    name: LIUSHISIGUA[`${upper},${lower}`] || "未知",
    upperGua: u[0], lowerGua: l[0],
    upperSymbol: u[1], lowerSymbol: l[1],
    benGuaLines: benGua, bianGuaLines: bianGua,
    dongYaoList, dongYaoName: dongYaoNames.join('、'),
    huGuaName,
    bianUpperGua: bianUpperNum ? GUA_NAME[bianUpperNum][0] : null,
    bianLowerGua: bianLowerNum ? GUA_NAME[bianLowerNum][0] : null
  };
}

// benGua索引0-5对应：下卦上爻(三爻)、下卦中爻(二爻)、下卦下爻(初爻)、上卦上爻(上爻)、上卦中爻(五爻)、上卦下爻(四爻)
// 需要映射到1-6爻位（初到上）
function getYaoIdxFromLineIdx(lineIdx) {
  const map = [3, 2, 1, 6, 5, 4]; // lineIdx 0→三爻, 1→二爻, 2→初爻, 3→上爻, 4→五爻, 5→四爻
  return map[lineIdx];
}

function arraysEqual(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }

function naJia(upperGuaName, lowerGuaName, dongYaoList, dayGan) {
  const upperNJ = NA_JIA[upperGuaName];
  const lowerNJ = NA_JIA[lowerGuaName];
  // 虞翻纳甲规约: 卦之上爻(外)用 NA_JIA 表前 3(外三爻), 卦之下爻(内)用 NA_JIA 表后 3(内三爻)
  // 因此: 当本卦作为 上卦(upper)→ 取首 3; 当作为 下卦(lower)→ 取尾 3
  // 原代码上下颠倒, 导致所有六爻纳甲/五行/六亲错位
  const sixYao = [...lowerNJ.slice(3), ...upperNJ.slice(0, 3)];

  const guaGongWX = { "乾":"金","兑":"金","离":"火","震":"木","巽":"木","坎":"水","艮":"土","坤":"土" };
  const gongWX = guaGongWX[lowerGuaName] || "土";

  const result = [];
  for (let i = 0; i < 6; i++) {
    const [gan, zhi, zhiWX] = sixYao[i];
    const liuQin = LIU_QIN[`${gongWX},${zhiWX}`] || "未知";
    const liuShenIdx = ((LIU_SHEN_START[dayGan] || 0) + i) % 6;
    result.push({
      yao: i + 1, name: ["初爻","二爻","三爻","四爻","五爻","上爻"][i],
      gan, zhi, wuxing: zhiWX, liuqin: liuQin,
      liushen: LIU_SHEN[liuShenIdx], isDong: dongYaoList.includes(i + 1)
    });
  }
  return result;
}

// ========== 主函数 ==========
function panGua(method, params) {
  let qigua;
  if (method === 'time') {
    qigua = qiGuaByTime(params.dt || new Date());
    qigua.dongYaoList = [qigua.dong];
  } else if (method === 'number') {
    qigua = qiGuaByNumber(params.num1 || 1, params.num2 || 1, params.num3);
    qigua.dongYaoList = [qigua.dong];
  } else if (method === 'coin') {
    qigua = qiGuaByCoin();
  } else {
    qigua = qiGuaByRandom();
    qigua.dongYaoList = [qigua.dong];
  }

  const dt = params.dt || new Date();
  const yearGZ = window.getYearGZEx(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  const dayGZ = window.getDayGZEx(dt);
  const hourGZ = window.getHourGZEx(dayGZ[0], dt.getHours(), window._getNextDayGZ(dt));
  const monthGZ = window.getMonthGZEx(dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), yearGZ[0]);

  const guaInfo = getGuaImage(qigua.upper, qigua.lower, qigua.dongYaoList);
  const yaoList = naJia(guaInfo.upperGua, guaInfo.lowerGua, qigua.dongYaoList, dayGZ[0]);

  // 变卦纳甲：用变卦的上下卦重新计算六亲
  let bianYaoList = null;
  if (guaInfo.bianUpperGua && guaInfo.bianLowerGua) {
    bianYaoList = naJia(guaInfo.bianUpperGua, guaInfo.bianLowerGua, [], dayGZ[0]);
  }

  return {
    method: qigua.method,
    datetime: `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`,
    timeGanzhi: { year: yearGZ, month: monthGZ, day: dayGZ, hour: hourGZ },
    gua: {
      name: guaInfo.name,
      upper: guaInfo.upperGua + guaInfo.upperSymbol,
      lower: guaInfo.lowerGua + guaInfo.lowerSymbol,
      dongYao: qigua.dongYaoList.length > 0 ? qigua.dongYaoList[0] : 0,
      dongYaoList: qigua.dongYaoList,
      dongYaoName: guaInfo.dongYaoName,
      lines: guaInfo.benGuaLines,
      bianUpperGua: guaInfo.bianUpperGua,
      bianLowerGua: guaInfo.bianLowerGua,
    },
    yaoList,
    bianYaoList,
    huGua: guaInfo.huGuaName,
    coinResults: qigua.coinResults || null,
  };
}

function formatLiuyaoPrompt(pan, question) {
  let s = "=== 六爻排盘 ===\n";
  s += `卦名：${pan.gua.name}\n`;
  s += `起卦时间：${pan.datetime}\n`;
  s += `时间干支：年${pan.timeGanzhi.year} 月${pan.timeGanzhi.month} 日${pan.timeGanzhi.day} 时${pan.timeGanzhi.hour}\n`;
  if (pan.gua.dongYaoList.length > 0) {
    const names = pan.gua.dongYaoList.map(d => `第${d}爻（${["初爻","二爻","三爻","四爻","五爻","上爻"][d-1]}）`);
    s += `动爻：${names.join('、')}\n`;
  } else {
    s += `动爻：无\n`;
  }
  if (pan.huGua) s += `互卦：${pan.huGua}\n`;
  s += "\n六爻详情：\n";
  for (const yao of [...pan.yaoList].reverse()) {
    const dong = yao.isDong ? "【动】" : "     ";
    s += `${yao.name} ${yao.gan}${yao.zhi}(${yao.wuxing}) ${yao.liuqin} ${yao.liushen} ${dong}\n`;
  }
  // 变卦六亲输出
  if (pan.bianYaoList && pan.bianYaoList.length === 6) {
    s += "\n变卦六亲：\n";
    for (const yao of [...pan.bianYaoList].reverse()) {
      s += `${yao.name} ${yao.gan}${yao.zhi}(${yao.wuxing}) ${yao.liuqin} ${yao.liushen}\n`;
    }
  }
  if (question) s += `\n所问之事：${question}\n`;
  return s;
}

// 导出全局
window.liuyao = { panGua, formatLiuyaoPrompt, qiGuaByTime, qiGuaByNumber, qiGuaByRandom, qiGuaByCoin, tossCoin };