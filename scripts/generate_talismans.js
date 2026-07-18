#!/usr/bin/env node
/**
 * 批量生成 30 张符箓 SVG(新版专业度)
 * 统一风格:宣纸底 + 朱砂墨 + 专属咒文 + 符胆元素 + 印章 + 古旧破损
 */
const fs = require('fs');
const path = require('path');

const FULU_DIR = path.join(__dirname, '..', 'www', 'images', 'fulu');

// 30 张符箓定义:每张专属的咒文/颜色/符胆元素
const TALISMANS = [
  { file: 'pingan',    name: '平安符',     category: '护身平安', color: '#c0392b', colorName: 'zhu',     incantation: ['太上老君','急急如律令','平安大吉','出入通泰'], seal: '老君',  element: 'bagua' },
  { file: 'quxie',     name: '驱邪符',     category: '护身平安', color: '#c0392b', colorName: 'zhu',     incantation: ['驱邪缚魅','斩妖除魔','五雷轰顶','邪祟退散'], seal: '雷霆',  element: 'sword' },
  { file: 'zhenzhai',  name: '镇宅符',     category: '护身平安', color: '#8b5a2b', colorName: 'jin',     incantation: ['镇宅平安','家宅安宁','五岳真形','四象护卫'], seal: '五岳',  element: 'wuyue' },
  { file: 'zhaocai',   name: '招财符',     category: '财运事业', color: '#b8860b', colorName: 'gold',    incantation: ['招财进宝','财源广进','五路财神','金玉满堂'], seal: '财神',  element: 'yuanbao' },
  { file: 'wulucaishen', name: '五路财神符', category: '财运事业', color: '#b8860b', colorName: 'gold',  incantation: ['五路财神','到此降临','招财纳珍','利市仙官'], seal: '公明',  element: 'cai5' },
  { file: 'wenchang',  name: '文昌符',     category: '学业考试', color: '#2a5a7a', colorName: 'qing',    incantation: ['文昌帝君','魁星点斗','文运昌隆','金榜题名'], seal: '文昌',  element: 'kui' },
  { file: 'taohua',    name: '桃花符',     category: '姻缘感情', color: '#c0392b', colorName: 'zhu',     incantation: ['红鸾星动','天喜入命','姻缘早成','月老为媒'], seal: '月老',  element: 'peach' },
  { file: 'hehe',      name: '和合符',     category: '姻缘感情', color: '#7a3a5a', colorName: 'zi',      incantation: ['和合二仙','琴瑟和鸣','百年好合','永结同心'], seal: '和合',  element: 'he2' },
  { file: 'taisui',    name: '太岁符',     category: '化解太岁', color: '#8b4513', colorName: 'zong',    incantation: ['太岁星君','值年功曹','化解冲犯','流年顺利'], seal: '太岁',  element: 'taisui' },
  { file: 'huataisui', name: '化太岁锦囊', category: '化解太岁', color: '#8b4513', colorName: 'zong',    incantation: ['化解太岁','消灾解厄','福星高照','逢凶化吉'], seal: '解厄',  element: 'jinnang' },
  { file: 'jiankang',  name: '健康符',     category: '健康延寿', color: '#2a7a3a', colorName: 'lv',      incantation: ['祛病延年','身康体健','药王护佑','百病不侵'], seal: '药王',  element: 'baicao' },
  { file: 'yanshou',   name: '延寿符',     category: '健康延寿', color: '#2a7a3a', colorName: 'lv',      incantation: ['延年益寿','寿比南山','南极仙翁','长生久视'], seal: '寿星',  element: 'shou' },
  { file: 'chuxing',   name: '出行平安符', category: '出行安全', color: '#2a5a7a', colorName: 'qing',    incantation: ['出行平安','一路顺风','车马无恙','水陆平安'], seal: '路神',  element: 'luma' },
  { file: 'zhantaohua', name: '斩桃花符',  category: '特殊用途', color: '#7a2a2a', colorName: 'anzhu',   incantation: ['斩断桃花','孽缘速离','正缘归位','清净本心'], seal: '斩断',  element: 'zhan' },
  { file: 'taozhai',   name: '讨债符',     category: '特殊用途', color: '#8b5a2b', colorName: 'jin',     incantation: ['速还债物','分文不少','天网恢恢','疏而不漏'], seal: '天理',  element: 'wang' },
  { file: 'shouxie',   name: '收邪符',     category: '收服缚魅', color: '#3a3a6a', colorName: 'anqing',  incantation: ['收摄邪精','缚魅伏魔','天罗地网','无所遁形'], seal: '天罗',  element: 'luo' },
  { file: 'fumei',     name: '缚魅符',     category: '收服缚魅', color: '#3a3a6a', colorName: 'anqing',  incantation: ['缚魅定形','锁魂禁魄','五雷缚邪','永不超生'], seal: '缚邪',  element: 'suo' },
  { file: 'zhensha',   name: '镇煞符',     category: '收服缚魅', color: '#8b2a2a', colorName: 'anzhu',   incantation: ['镇煞伏魔','煞气消散','四灵镇宅','八煞皈依'], seal: '镇煞',  element: 'siling' },
  { file: 'pohui',     name: '破秽符',     category: '收服缚魅', color: '#5a4a3a', colorName: 'hui',     incantation: ['破除秽气','清净坛场','九凤破秽','荡涤妖氛'], seal: '破秽',  element: 'jiufeng' },
  { file: 'wulei',     name: '五雷符',     category: '攻击邪祟', color: '#c0392b', colorName: 'zhu',     incantation: ['五雷轰顶','霹雳一声','邪祟粉碎','神威显赫'], seal: '五雷',  element: 'leizhen' },
  { file: 'fengmen',   name: '封门符',     category: '收服缚魅', color: '#4a3a5a', colorName: 'anzi',    incantation: ['封门闭户','邪不得入','六甲神将','守户镇门'], seal: '封门',  element: 'men' },
  { file: 'duantaohua', name: '断桃花符',  category: '姻缘感情', color: '#7a2a2a', colorName: 'anzhu',   incantation: ['断绝桃花','孽缘永断','心归正道','清净法身'], seal: '断缘',  element: 'duan' },
  { file: 'anzhai',    name: '安宅符',     category: '护身平安', color: '#8b5a2b', colorName: 'jin',     incantation: ['安宅镇基','地脉安稳','土地明王','护宅安宁'], seal: '土地',  element: 'tu' },
  { file: 'jiee',      name: '解厄符',     category: '护身平安', color: '#5a7a2a', colorName: 'qinglv',  incantation: ['解厄消灾','逢凶化吉','北斗注生','南斗注死'], seal: '解厄',  element: 'beidou' },
  { file: 'hushen',    name: '护身符',     category: '护身平安', color: '#c0392b', colorName: 'zhu',     incantation: ['护身保命','诸邪不侵','六甲六丁','随身护佑'], seal: '护身',  element: 'liujia' },
  { file: 'jinguang',  name: '金光符',     category: '护身平安', color: '#b8860b', colorName: 'gold',    incantation: ['金光速现','覆护真人','天地玄宗','万炁本根'], seal: '金光',  element: 'guang' },
  { file: 'tianshi',   name: '天师符',     category: '攻击邪祟', color: '#c0392b', colorName: 'zhu',     incantation: ['天师降临','斩妖伏魔','正一威灵','鬼神钦伏'], seal: '天师',  element: 'tianshi' },
  { file: 'zhanyao',   name: '斩妖符',     category: '攻击邪祟', color: '#8b1a1a', colorName: 'xue',     incantation: ['斩妖除魔','剑气凌霄','妖怪现形','一剑封喉'], seal: '斩妖',  element: 'sword2' },
  { file: 'quwen',     name: '驱瘟符',     category: '健康延寿', color: '#2a7a5a', colorName: 'cuilv',   incantation: ['驱除瘟疫','百病消散','瘟部众神','速离坛场'], seal: '驱瘟',  element: 'wen' },
  { file: 'pojun',     name: '破军符',     category: '攻击邪祟', color: '#4a4a4a', colorName: 'hei',     incantation: ['破军星君','摧锋陷阵','攻无不克','战无不胜'], seal: '破军',  element: 'pojun' },
  // ===== 新增 8 张 v2 (任务 #35:扩展 KB 套完整四象六合体系) =====
  { file: 'shaqi',     name: '杀气符',     category: '攻击邪祟', color: '#5a2a1a', colorName: 'shan',    incantation: ['杀气凌空','百魔退散','戈剑斩精','一见消亡'], seal: '戈剑',  element: 'sword2' },
  { file: 'qingzao',   name: '请召符',     category: '道佛祈请', color: '#3a5a8a', colorName: 'qinglan', incantation: ['恭请圣真','降临坛场','受命行事','急急如令'], seal: '请召',  element: 'jiulong' },
  { file: 'gongde',    name: '功德符',     category: '道佛祈请', color: '#b8860b', colorName: 'jin',     incantation: ['累积功德','福报增长','冤亲得度','净土归真'], seal: '功德',  element: 'yuanbao' },
  { file: 'anhun',     name: '安魂符',     category: '超度救拔', color: '#5a4a8a', colorName: 'lan',     incantation: ['魂归本位','魄受真形','三魂七魄','复返真身'], seal: '安魂',  element: 'beidou' },
  { file: 'chaodu',    name: '超度符',     category: '超度救拔', color: '#7a5a2a', colorName: 'zhong',   incantation: ['亡灵得度','解脱诸苦','莲池会上','花开见佛'], seal: '超度',  element: 'bagua' },
  { file: 'qubing',    name: '祛病符',     category: '健康延寿', color: '#3a8a5a', colorName: 'bitao',   incantation: ['祛除病苦','百药调匀','灶君安抚','家宅平安'], seal: '药王',  element: 'baicao' },
  { file: 'longmei',   name: '龙梅符',     category: '姻缘感情', color: '#c0392b', colorName: 'zhu',     incantation: ['龙梅之合','鸾凤齐鸣','佳偶天成','永结同心'], seal: '龙梅',  element: 'peach' },
  { file: 'zhenggu',   name: '正骨符',     category: '健康延寿', color: '#5a5a2a', colorName: 'ca',      incantation: ['骨节复位','气血调和','筋脉舒畅','行动如常'], seal: '正骨',  element: 'wuyue' }
];

// 符胆元素 SVG 生成器
function elementSVG(type, color) {
  const elements = {
    bagua: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <circle cx="0" cy="0" r="70"/>
      <path d="M-70,0 L70,0 M0,-70 L0,70 M-50,-50 L50,50 M-50,50 L50,-50"/>
      <circle cx="0" cy="0" r="20" fill="${color}" opacity="0.4"/>
    </g>`,
    sword: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="3" opacity="0.6">
      <path d="M0,-80 L0,60" stroke-width="4"/>
      <path d="M-30,-30 L30,-30 M-25,30 L25,30"/>
      <path d="M-20,-80 L20,-80 M0,60 L0,75 M-8,75 L8,75" stroke-width="2"/>
    </g>`,
    wuyue: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <path d="M-80,60 L-40,-40 L0,60 L40,-40 L80,60" stroke-width="2.5"/>
      <path d="M-60,60 L-30,0 L0,60 L30,0 L60,60" stroke-width="2" opacity="0.6"/>
      <circle cx="0" cy="0" r="12" fill="${color}" opacity="0.5"/>
    </g>`,
    yuanbao: `<g transform="translate(200,260)" fill="${color}" opacity="0.55">
      <path d="M-60,20 Q-70,-10 -50,-30 Q-30,-45 0,-45 Q30,-45 50,-30 Q70,-10 60,20 Q40,35 0,35 Q-40,35 -60,20 Z"/>
      <ellipse cx="0" cy="-15" rx="20" ry="10" fill="#f4e4bc" opacity="0.8"/>
    </g>`,
    cai5: `<g transform="translate(200,260)" fill="${color}" opacity="0.6">
      <circle cx="-60" cy="-20" r="10"/><circle cx="-30" cy="-35" r="10"/>
      <circle cx="0" cy="-40" r="12" fill="#f4e4bc" stroke="${color}" stroke-width="2"/>
      <circle cx="30" cy="-35" r="10"/><circle cx="60" cy="-20" r="10"/>
      <path d="M-60,-10 L-30,20 L0,25 L30,20 L60,-10" fill="none" stroke="${color}" stroke-width="2"/>
      <text x="0" y="60" text-anchor="middle" fill="${color}" font-size="20" font-weight="bold">五路</text>
    </g>`,
    kui: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <path d="M-40,-50 L40,-50 L40,30 L-40,30 Z" stroke-width="2.5"/>
      <path d="M-20,-30 L20,-30 M-20,-10 L20,-10 M-20,10 L20,10"/>
      <circle cx="0" cy="45" r="8" fill="${color}"/>
      <path d="M0,53 L0,70 M-8,60 L8,60" stroke-width="2"/>
    </g>`,
    peach: `<g transform="translate(200,260)" fill="${color}" opacity="0.55">
      <path d="M0,-30 Q-30,-30 -35,0 Q-38,25 -15,40 Q0,48 15,40 Q38,25 35,0 Q30,-30 0,-30 Z"/>
      <path d="M0,-30 Q0,-45 8,-50" fill="none" stroke="${color}" stroke-width="3"/>
      <ellipse cx="0" cy="5" rx="8" ry="12" fill="#f4e4bc" opacity="0.5"/>
    </g>`,
    he2: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <circle cx="-25" cy="0" r="25"/><circle cx="25" cy="0" r="25"/>
      <circle cx="0" cy="0" r="6" fill="${color}"/>
      <path d="M-25,-25 L25,25 M-25,25 L25,-25" stroke-width="1.5" opacity="0.5"/>
    </g>`,
    taisui: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <circle cx="0" cy="0" r="55"/>
      <text x="0" y="-10" text-anchor="middle" fill="${color}" font-size="28" font-weight="bold">太</text>
      <text x="0" y="25" text-anchor="middle" fill="${color}" font-size="28" font-weight="bold">岁</text>
      <path d="M-70,-70 L-55,-55 M70,-70 L55,-55 M-70,70 L-55,55 M70,70 L55,55"/>
    </g>`,
    jinnang: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <path d="M-30,-50 L30,-50 L40,20 Q40,40 20,40 L-20,40 Q-40,40 -40,20 Z"/>
      <path d="M-35,-50 L35,-50" stroke-width="3"/>
      <circle cx="0" cy="-10" r="12" fill="${color}" opacity="0.5"/>
    </g>`,
    baicao: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <path d="M0,50 L0,-30" stroke-width="3"/>
      <path d="M0,-10 Q-25,-25 -35,-5 Q-30,15 -10,10 M0,-10 Q25,-25 35,-5 Q30,15 10,10"/>
      <path d="M0,10 Q-20,20 -25,35 Q-15,45 0,40 Q15,45 25,35 Q20,20 0,10" fill="${color}" opacity="0.4"/>
    </g>`,
    shou: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <circle cx="0" cy="0" r="55"/>
      <text x="0" y="18" text-anchor="middle" fill="${color}" font-size="48" font-weight="bold" font-family="'Noto Serif SC',serif">寿</text>
      <path d="M-70,-40 Q-60,-50 -50,-40 M50,-40 Q60,-50 70,-40" stroke-width="2"/>
    </g>`,
    luma: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <path d="M-60,30 Q-40,-10 0,-10 Q40,-10 60,30" stroke-width="3"/>
      <circle cx="-40" cy="40" r="8"/><circle cx="40" cy="40" r="8"/>
      <path d="M-50,-10 L-50,30 M50,-10 L50,30" stroke-width="2"/>
    </g>`,
    zhan: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="3" opacity="0.7">
      <path d="M-50,-50 L50,50 M50,-50 L-50,50" stroke-width="4"/>
      <circle cx="0" cy="0" r="60" stroke-width="2" stroke-dasharray="8,4"/>
    </g>`,
    wang: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <path d="M-70,-50 L70,50 M-70,50 L70,-50 M-70,0 L70,0 M0,-50 L0,50 M-35,-50 L-35,50 M35,-50 L35,50" opacity="0.7"/>
      <rect x="-70" y="-50" width="140" height="100" fill="none" stroke-width="2.5"/>
    </g>`,
    luo: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <circle cx="0" cy="0" r="60"/>
      <circle cx="0" cy="0" r="45"/>
      <circle cx="0" cy="0" r="30"/>
      <path d="M0,-60 L0,60 M-60,0 L60,0 M-42,-42 L42,42 M-42,42 L42,-42"/>
    </g>`,
    suo: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <path d="M-30,-40 L30,-40 L30,10 Q30,30 10,30 L-10,30 Q-30,30 -30,10 Z"/>
      <path d="M-15,-40 L-15,-60 Q-15,-70 0,-70 Q15,-70 15,-60 L15,-40" stroke-width="3"/>
      <circle cx="0" cy="0" r="6" fill="${color}"/>
    </g>`,
    siling: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <path d="M0,-70 L20,-20 L70,-20 L30,10 L45,60 L0,30 L-45,60 L-30,10 L-70,-20 L-20,-20 Z"/>
    </g>`,
    jiufeng: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <path d="M0,-50 Q-15,-35 -12,-15 Q-8,-5 0,-10 Q8,-5 12,-15 Q15,-35 0,-50"/>
      <path d="M-25,-20 Q-45,-10 -40,15 Q-25,25 -10,15"/>
      <path d="M25,-20 Q45,-10 40,15 Q25,25 10,15"/>
      <path d="M-5,10 Q0,35 -5,55 M5,10 Q0,35 5,55" stroke-width="2.5"/>
    </g>`,
    leizhen: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.65">
      <path d="M-20,-60 L10,-10 L-10,-10 L20,60" stroke-width="4"/>
      <path d="M-50,-30 L-25,-5 M50,-30 L25,-5 M-50,30 L-25,5 M50,30 L25,5" stroke-width="2"/>
    </g>`,
    men: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <rect x="-45" y="-60" width="90" height="120" stroke-width="3"/>
      <line x1="0" y1="-60" x2="0" y2="60"/>
      <circle cx="-12" cy="0" r="4" fill="${color}"/><circle cx="12" cy="0" r="4" fill="${color}"/>
    </g>`,
    duan: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="3" opacity="0.7">
      <path d="M-60,0 L60,0" stroke-width="5"/>
      <path d="M-30,-30 L-30,30 M30,-30 L30,30" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="70" stroke-dasharray="10,5"/>
    </g>`,
    tu: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <path d="M-60,50 L-30,-30 L0,10 L30,-30 L60,50" stroke-width="3"/>
      <rect x="-15" y="20" width="30" height="20" fill="${color}" opacity="0.4"/>
    </g>`,
    beidou: `<g transform="translate(200,260)" fill="${color}" opacity="0.65">
      <circle cx="-50" cy="20" r="4"/><circle cx="-30" cy="0" r="4"/>
      <circle cx="-10" cy="8" r="4"/><circle cx="10" cy="0" r="4"/>
      <circle cx="30" cy="8" r="4"/><circle cx="50" cy="20" r="4"/>
      <circle cx="0" cy="-25" r="5" fill="#f4e4bc" stroke="${color}" stroke-width="2"/>
      <path d="M-50,20 L-30,0 L-10,8 L10,0 L30,8 L50,20" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,2"/>
    </g>`,
    liujia: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <circle cx="0" cy="-50" r="8"/><circle cx="45" cy="-15" r="8"/>
      <circle cx="45" cy="35" r="8"/><circle cx="0" cy="55" r="8"/>
      <circle cx="-45" cy="35" r="8"/><circle cx="-45" cy="-15" r="8"/>
      <path d="M0,-42 L38,-12 L38,28 L0,48 L-38,28 L-38,-12 Z" stroke-dasharray="4,2"/>
    </g>`,
    guang: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <circle cx="0" cy="0" r="30" fill="${color}" opacity="0.3"/>
      <path d="M0,-70 L0,-40 M0,40 L0,70 M-70,0 L-40,0 M40,0 L70,0 M-50,-50 L-30,-30 M30,30 L50,50 M-50,50 L-30,30 M30,-30 L50,-50" stroke-width="3"/>
    </g>`,
    tianshi: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.6">
      <circle cx="0" cy="-20" r="20"/>
      <path d="M-15,-30 Q0,-45 15,-30" stroke-width="3"/>
      <path d="M0,0 L0,50 M-25,20 L25,20" stroke-width="3"/>
      <path d="M-20,-40 L-30,-55 M20,-40 L30,-55" stroke-width="2"/>
    </g>`,
    sword2: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="3.5" opacity="0.7">
      <path d="M0,-70 L0,50" stroke-width="5"/>
      <path d="M-30,-25 L30,-25 M-25,25 L25,25"/>
      <path d="M-20,-70 L20,-70 L0,-85 Z" fill="${color}"/>
    </g>`,
    wen: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
      <circle cx="0" cy="0" r="45"/>
      <path d="M-45,0 L45,0 M0,-45 L0,45 M-32,-32 L32,32 M-32,32 L32,-32" opacity="0.5"/>
      <circle cx="0" cy="0" r="20" fill="${color}" opacity="0.3"/>
      <path d="M-60,-60 L-50,-50 M60,-60 L50,-50 M-60,60 L-50,50 M60,60 L50,50"/>
    </g>`,
    pojun: `<g transform="translate(200,260)" fill="none" stroke="${color}" stroke-width="3" opacity="0.7">
      <path d="M-60,-40 L0,20 L60,-40 M-60,20 L0,60 L60,20" stroke-width="3.5"/>
      <circle cx="0" cy="-50" r="8" fill="${color}"/>
    </g>`
  };
  return elements[type] || elements.bagua;
}

// 雷纹装饰(符脚)
function footerPattern(color) {
  return `<g fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4">
    <path d="M25,25 L35,35 L25,45 L35,55"/>
    <path d="M375,25 L365,35 L375,45 L365,55"/>
    <path d="M25,575 L35,565 L25,555 L35,545"/>
    <path d="M375,575 L365,565 L375,555 L365,545"/>
  </g>`;
}

// 古旧破损效果
function agingEffect() {
  return `<g fill="#d4b896" opacity="0.3">
    <circle cx="380" cy="30" r="4"/>
    <circle cx="370" cy="40" r="3"/>
    <circle cx="385" cy="45" r="2.5"/>
    <circle cx="375" cy="20" r="2"/>
    <circle cx="25" cy="570" r="3.5"/>
    <circle cx="20" cy="555" r="2.5"/>
  </g>`;
}

// 单张符箓生成
function generateTalisman(t) {
  // 布局分带(避免字图重叠):
  // y= 28-76  敕令头
  // y=110-250 主咒文(4行,行距 36px)
  // y=270-370 符胆元素
  // y=400-460 五雷震位
  // y=500-580 印章
  const lines = t.incantation;
  const lineHeight = 36;
  const startY = 130;
  const incantationTexts = lines.map((txt, i) =>
    `<text x="200" y="${startY + i * lineHeight}" font-size="${i === 0 ? 26 : 22}">${txt}</text>`
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" preserveAspectRatio="xMidYMid meet">
  <defs>
    <filter id="paper_${t.file}"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="n"/><feDiffuseLighting in="n" lighting-color="#f4e4bc" surfaceScale="1.2"><feDistantLight azimuth="45" elevation="60"/></feDiffuseLighting></filter>
  </defs>
  <!-- 符纸 -->
  <rect x="8" y="8" width="384" height="584" fill="#f4e4bc" stroke="#8b5a2b" stroke-width="3" filter="url(#paper_${t.file})"/>
  <rect x="16" y="16" width="368" height="568" fill="none" stroke="#8b5a2b" stroke-width="1"/>

  <!-- 敕令头 -->
  <g fill="${t.color}">
    <rect x="120" y="28" width="160" height="48" rx="3"/>
    <path d="M110,32 L120,40 L110,48 L120,56 L110,64" stroke="${t.color}" stroke-width="1.5" fill="none" opacity="0.6"/>
    <path d="M290,32 L280,40 L290,48 L280,56 L290,64" stroke="${t.color}" stroke-width="1.5" fill="none" opacity="0.6"/>
  </g>
  <text x="200" y="60" text-anchor="middle" fill="#f4e4bc" font-size="30" font-family="'Noto Serif SC',serif" font-weight="bold" letter-spacing="4">敕令</text>

  <!-- 主咒文(避免与符胆重叠) -->
  <g fill="${t.color}" font-family="'Noto Serif SC',serif" font-weight="bold" text-anchor="middle">
    ${incantationTexts}
  </g>

  <!-- 符胆元素(下移到 y=320 避开咒文) -->
  ${elementSVG(t.element, t.color).replace(/transform="translate\(200,260\)"/, 'transform="translate(200,330)"')}

  <!-- 五雷震位 -->
  <g transform="translate(200,440)" fill="none" stroke="${t.color}" stroke-width="2" opacity="0.5">
    <path d="M-60,0 L-20,0 M20,0 L60,0 M0,-60 L0,-20 M0,20 L0,60"/>
    <path d="M-40,-40 L-15,-15 M15,15 L40,40 M-40,40 L-15,15 M15,-15 L40,-40"/>
    <circle cx="0" cy="0" r="35" stroke-dasharray="5,3"/>
  </g>

  <!-- 印章 -->
  <rect x="160" y="500" width="80" height="80" fill="none" stroke="${t.color}" stroke-width="3"/>
  <text x="200" y="535" text-anchor="middle" fill="${t.color}" font-size="20" font-family="'Noto Serif SC',serif" font-weight="bold">${t.seal.substring(0,2)}</text>
  <text x="200" y="565" text-anchor="middle" fill="${t.color}" font-size="20" font-family="'Noto Serif SC',serif" font-weight="bold">${t.seal.substring(2,4) || t.seal.substring(0,2)}</text>

  <!-- 符脚雷纹 -->
  ${footerPattern(t.color)}

  <!-- 古旧破损 -->
  ${agingEffect()}
</svg>`;
}

// 批量生成
let created = 0;
for (const t of TALISMANS) {
  const svg = generateTalisman(t);
  const file = path.join(FULU_DIR, t.file + '.svg');
  fs.writeFileSync(file, svg, 'utf-8');
  created++;
  console.log(`✓ ${t.file}.svg (${t.name})`);
}
console.log(`\n共生成 ${created} 张符箓 SVG`);
