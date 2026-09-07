#!/usr/bin/env node
/**
 * 批量生成 20 张手诀 SVG(新版专业度)
 * 统一风格:米白底 + 手掌皮肤色 + 墨线轮廓 + 关节/指甲细节 + 手诀名+说明
 */
const fs = require('fs');
const path = require('path');

const SHOUJUE_DIR = path.join(__dirname, '..', 'www', 'images', 'shoujue');

// 20 张手诀定义:name/姿势(五指状态)/说明
// 姿势:'straight'伸直 / 'half'半屈 / 'curl'全屈 / 'press'拇指横压
const HANDSEALS = [
  { file:'daozhi',   name:'道指',       sub:'三清指',      desc:'食指中指伸直开分,无名指小指屈扣,拇指横压',  fingers:{ thumb:'press',  index:'straight', middle:'straight', ring:'curl', pinky:'curl' } },
  { file:'jianjue',  name:'剑诀',       sub:'剑指',        desc:'食指中指并拢如剑,无名指小指屈扣,拇指扣住',  fingers:{ thumb:'press',  index:'straight', middle:'straight', ring:'curl', pinky:'curl' }, merged:true },
  { file:'leijue',   name:'雷诀',       sub:'五雷指',      desc:'中指无名指屈第一关节指背凸起,拇指压二节',  fingers:{ thumb:'press',  index:'straight', middle:'half',    ring:'half', pinky:'straight' } },
  { file:'sanshan',  name:'三山诀',     sub:'三山印',      desc:'中指无名指小指伸直如山,食指拇指屈扣',      fingers:{ thumb:'curl',   index:'curl',     middle:'straight', ring:'straight', pinky:'straight' } },
  { file:'taiji',    name:'太极印',     sub:'太极诀',      desc:'拇指食指成环(太极),余三指伸直',            fingers:{ thumb:'ring',   index:'ring',     middle:'straight', ring:'straight', pinky:'straight' } },
  { file:'bagua',    name:'八卦印',     sub:'八卦诀',      desc:'拇指压掌心,四指微屈成八卦形',              fingers:{ thumb:'press',  index:'half',     middle:'half',    ring:'half', pinky:'half' } },
  { file:'jingang',  name:'金刚拳',     sub:'金刚印',      desc:'四指握拳,拇指压食指外侧',                  fingers:{ thumb:'press',  index:'fist',     middle:'fist',    ring:'fist', pinky:'fist' } },
  { file:'rijun',    name:'日君诀',     sub:'日宫诀',      desc:'食指伸直朝天(太阳),余四指屈扣',            fingers:{ thumb:'press',  index:'straight', middle:'curl',    ring:'curl', pinky:'curl' } },
  { file:'yuejun',   name:'月君诀',     sub:'月宫诀',      desc:'小指伸直朝天(太阴),余四指屈扣',            fingers:{ thumb:'press',  index:'curl',     middle:'curl',    ring:'curl', pinky:'straight' } },
  { file:'tianshi',  name:'天师诀',     sub:'天师印',      desc:'中指伸直其余屈,拇指托中指根',              fingers:{ thumb:'press',  index:'curl',     middle:'straight', ring:'curl', pinky:'curl' } },
  { file:'liujia',   name:'六甲诀',     sub:'六甲印',      desc:'拇指食指相扣成环,三指并拢伸出',            fingers:{ thumb:'ring',   index:'ring',     middle:'straight', ring:'straight', pinky:'straight' } },
  { file:'liuding',  name:'六丁诀',     sub:'六丁印',      desc:'拇指中指相扣成环,三指张开',                fingers:{ thumb:'ring',   index:'straight', middle:'ring',    ring:'straight', pinky:'straight' } },
  { file:'ziwu',     name:'子午诀',     sub:'阴阳诀',      desc:'拇指掐中指根(子位),中指掐拇指尖(午位)',    fingers:{ thumb:'half',   index:'curl',     middle:'half',    ring:'curl', pinky:'curl' } },
  { file:'taijiyinyang', name:'太极阴阳手', sub:'阴阳印',  desc:'左右手拇指食指互扣成太极环',                fingers:{ thumb:'ring',   index:'ring',     middle:'half',    ring:'half', pinky:'half' } },
  { file:'baoyuan',  name:'抱元印',     sub:'抱元守一',    desc:'双手拇指食指互抱成圆(丹田)',              fingers:{ thumb:'ring',   index:'ring',     middle:'curl',    ring:'curl', pinky:'curl' } },
  { file:'laojun',   name:'老君诀',     sub:'老君印',      desc:'拇指食指成圈(炼丹炉),余三指展开',          fingers:{ thumb:'ring',   index:'ring',     middle:'straight', ring:'straight', pinky:'straight' } },
  { file:'wuleijue', name:'五雷诀',     sub:'五雷印',      desc:'五指张开如雷掌,掌心向外',                  fingers:{ thumb:'straight', index:'straight', middle:'straight', ring:'straight', pinky:'straight' } },
  { file:'beidou',   name:'北斗诀',     sub:'北斗印',      desc:'四指伸展如斗魁,拇指横托斗柄',              fingers:{ thumb:'press',  index:'straight', middle:'half',    ring:'half', pinky:'straight' } },
  { file:'zhaogongcao', name:'召功曹诀', sub:'功曹印',     desc:'食指中指成剪形,拇指扣无名指',              fingers:{ thumb:'press',  index:'half',     middle:'half',    ring:'curl', pinky:'straight' } },
  { file:'yuhuang',  name:'玉皇诀',     sub:'玉皇印',      desc:'拇指压掌心,四指并拢朝天',                  fingers:{ thumb:'press',  index:'straight', middle:'straight', ring:'straight', pinky:'straight' }, merged:true }
];

// 手指 SVG 生成
function finger(type, x, w, len, palmY) {
  // x: 指根中心,w: 指宽,len: 长度(相对 palmY)
  const topY = palmY - len;
  if (type === 'straight') {
    return `<path d="M ${x-w/2} ${topY} Q ${x-w/2} ${topY-3} ${x-w/2+2} ${topY-5} L ${x-w/2+2} ${palmY} Q ${x-w/2+2} ${palmY+5} ${x-w/2} ${palmY+7} L ${x+w/2} ${palmY+7} Q ${x+w/2-2} ${palmY+5} ${x+w/2-2} ${palmY} L ${x+w/2-2} ${topY-5} Q ${x+w/2-2} ${topY-3} ${x+w/2} ${topY} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="1.5"/>
    <line x1="${x-w/2+2}" y1="${topY+len*0.4}" x2="${x+w/2-2}" y2="${topY+len*0.4}" stroke="#dba77e" stroke-width="0.8"/>
    <line x1="${x-w/2+2}" y1="${topY+len*0.7}" x2="${x+w/2-2}" y2="${topY+len*0.7}" stroke="#dba77e" stroke-width="0.8"/>
    <ellipse cx="${x}" cy="${topY+8}" rx="${w/2-3}" ry="7" fill="#fce4d0" stroke="#dba77e" stroke-width="0.5"/>`;
  } else if (type === 'half') {
    return `<path d="M ${x-w/2} ${topY+20} Q ${x-w/2} ${topY+5} ${x} ${topY} Q ${x+w/2} ${topY+5} ${x+w/2} ${topY+20} L ${x+w/2} ${palmY} Q ${x+w/2} ${palmY+5} ${x+w/2-2} ${palmY+7} L ${x-w/2+2} ${palmY+7} Q ${x-w/2} ${palmY+5} ${x-w/2} ${palmY} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="1.5"/>
    <path d="M ${x-w/2+2} ${topY+22} Q ${x} ${topY+12} ${x+w/2-2} ${topY+22}" fill="none" stroke="#dba77e" stroke-width="0.8"/>
    <ellipse cx="${x}" cy="${topY+5}" rx="${w/2-2}" ry="5" fill="#fce4d0" stroke="#dba77e" stroke-width="0.5"/>`;
  } else if (type === 'curl' || type === 'fist') {
    const fill = type === 'fist' ? '#dba77e' : '#f4c7a1';
    return `<path d="M ${x-w/2} ${palmY-15} Q ${x-w/2} ${palmY-5} ${x-w/2+3} ${palmY} L ${x-w/2+3} ${palmY+5} Q ${x-w/2+3} ${palmY+7} ${x-w/2} ${palmY+8} L ${x+w/2} ${palmY+8} Q ${x+w/2-3} ${palmY+7} ${x+w/2-3} ${palmY+5} L ${x+w/2-3} ${palmY} Q ${x+w/2-3} ${palmY-5} ${x+w/2} ${palmY-15} Z" fill="${fill}" stroke="#5a3a2a" stroke-width="1.5"/>`;
  } else if (type === 'ring') {
    return `<circle cx="${x}" cy="${palmY-20}" r="${w*0.6}" fill="none" stroke="#5a3a2a" stroke-width="2.5"/>`;
  }
  return '';
}

// 拇指 SVG(横压或直立)
function thumb(type, palmY) {
  if (type === 'press') {
    return `<path d="M 55 ${palmY-25} Q 48 ${palmY-29} 44 ${palmY-23} L 40 ${palmY-5} Q 38 ${palmY+3} 46 ${palmY+5} L 120 ${palmY+8} Q 128 ${palmY+8} 128 ${palmY} L 128 ${palmY-4} Q 128 ${palmY-12} 118 ${palmY-12} L 66 ${palmY-15} Q 60 ${palmY-19} 55 ${palmY-25} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="1.5" opacity="0.92"/>
    <ellipse cx="50" cy="${palmY-12}" rx="6" ry="5" fill="#fce4d0" stroke="#dba77e" stroke-width="0.5"/>`;
  } else if (type === 'straight') {
    return `<path d="M 42 ${palmY-105} Q 40 ${palmY-110} 44 ${palmY-112} L 52 ${palmY-25} Q 54 ${palmY-17} 60 ${palmY-16} L 70 ${palmY-15} Q 76 ${palmY-15} 75 ${palmY-22} L 66 ${palmY-108} Q 65 ${palmY-114} 60 ${palmY-113} L 52 ${palmY-112} Q 46 ${palmY-111} 46 ${palmY-105} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="1.5" transform="translate(-8,0)"/>
    <ellipse cx="50" cy="${palmY-102}" rx="6" ry="8" fill="#fce4d0" stroke="#dba77e" stroke-width="0.5" transform="translate(-2,0)"/>`;
  } else if (type === 'curl') {
    return `<path d="M 45 ${palmY-15} Q 40 ${palmY-18} 38 ${palmY-12} L 40 ${palmY+5} Q 42 ${palmY+10} 48 ${palmY+8} L 65 ${palmY+5} Q 70 ${palmY+3} 68 ${palmY-3} L 60 ${palmY-12} Q 55 ${palmY-15} 45 ${palmY-15} Z" fill="#dba77e" stroke="#5a3a2a" stroke-width="1.5"/>`;
  } else if (type === 'ring') {
    return `<circle cx="55" cy="${palmY-20}" r="12" fill="none" stroke="#5a3a2a" stroke-width="2.5"/>`;
  } else if (type === 'half') {
    return `<path d="M 50 ${palmY-45} Q 45 ${palmY-50} 48 ${palmY-55} L 58 ${palmY-15} Q 62 ${palmY-10} 68 ${palmY-12} L 75 ${palmY-15} Q 78 ${palmY-20} 75 ${palmY-25} L 65 ${palmY-50} Q 62 ${palmY-55} 58 ${palmY-52} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="1.5"/>`;
  }
  return '';
}

function generateHandseal(s) {
  const palmY = 165;
  const f = s.fingers;
  const xs = { index: 80, middle: 105, ring: 130, pinky: 157 };
  const ws = { index: 18, middle: 18, ring: 20, pinky: 16 };
  const lens = { index: 105, middle: 115, ring: 110, pinky: 95 };

  let fingersSVG = '';
  if (!s.merged) {
    fingersSVG += finger(f.index, xs.index, ws.index, lens.index, palmY);
  }
  fingersSVG += finger(f.middle, xs.middle, ws.middle, lens.middle, palmY);
  fingersSVG += finger(f.ring, xs.ring, ws.ring, lens.ring, palmY);
  fingersSVG += finger(f.pinky, xs.pinky, ws.pinky, lens.pinky, palmY);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="180">
  <rect x="10" y="10" width="220" height="260" fill="#fffaf0" stroke="#c9a84c" stroke-width="2" rx="8"/>

  <!-- 手掌 -->
  <path d="M 65 ${palmY-5} Q 60 ${palmY-10} 60 ${palmY} L 60 ${palmY+45} Q 60 ${palmY+55} 70 ${palmY+55} L 170 ${palmY+55} Q 180 ${palmY+55} 180 ${palmY+45} L 180 ${palmY} Q 180 ${palmY-10} 175 ${palmY-5} L 170 ${palmY} L 70 ${palmY} Z" fill="#f4c7a1" stroke="#5a3a2a" stroke-width="2"/>
  <path d="M 70 ${palmY+10} Q 120 ${palmY+15} 170 ${palmY+10}" fill="none" stroke="#dba77e" stroke-width="0.6"/>
  <path d="M 75 ${palmY+30} Q 120 ${palmY+35} 165 ${palmY+30}" fill="none" stroke="#dba77e" stroke-width="0.6"/>
  <path d="M 80 ${palmY+45} Q 120 ${palmY+50} 160 ${palmY+45}" fill="none" stroke="#dba77e" stroke-width="0.6"/>

  ${fingersSVG}
  ${thumb(f.thumb, palmY)}

  <text x="120" y="250" text-anchor="middle" font-size="16" font-family="'Noto Serif SC',serif" font-weight="bold" fill="#5a3a2a">${s.name}</text>
  <text x="120" y="268" text-anchor="middle" font-size="9" font-family="'Noto Serif SC',serif" fill="#8b6f2a">${s.desc}</text>
</svg>`;
}

let created = 0;
for (const s of HANDSEALS) {
  const svg = generateHandseal(s);
  const file = path.join(SHOUJUE_DIR, s.file + '.svg');
  fs.writeFileSync(file, svg, 'utf-8');
  created++;
  console.log(`✓ ${s.file}.svg (${s.name})`);
}
console.log(`\n共生成 ${created} 张手诀 SVG`);
