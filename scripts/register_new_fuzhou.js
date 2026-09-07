#!/usr/bin/env node
/**
 * 将新符箓/手诀注册到 KB:
 * - 38 张符箓 → daoism_fuzhou_kb.json
 * - 24 张手诀(含 v2: daozhi2/leijue2/beidou2/wuyue + 4 张新增) → daoism_shoujue_kb.json
 */
const fs = require('fs');
const path = require('path');

const FULU_DIR = path.join(__dirname, '..', 'www', 'images', 'fulu');
const SHOUJUE_DIR = path.join(__dirname, '..', 'www', 'images', 'shoujue');

// 8 张 v1 已有,但 KB 中是基础 30 条;v2 改名追加为新版
const NEW_FULU_V2 = [
  { id:'fuzhou_031', title:'青龙符', category:'四神镇压', content:'青龙为四象之一,镇守东方,主生发万物。配九宫格与洛书数字,助事业开创、家庭和睦。', sealText:'青龙', image:'qinglong', tags:['四象','青龙','东方','事业','镇宅'] },
  { id:'fuzhou_032', title:'白虎符', category:'四神镇压', content:'白虎为四象之一,镇守西方,主肃杀威猛。配白虎头符号与五雷阵,用于驱邪镇煞。', sealText:'白虎', image:'baihu', tags:['四象','白虎','西方','驱邪','镇煞'] },
  { id:'fuzhou_033', title:'朱雀符', category:'四神镇压', content:'朱雀为四象之一,镇守南方,主光明正大。凤凰展翅配南方七宿,助文昌显达、考试高中。', sealText:'朱雀', image:'zhuque', tags:['四象','朱雀','南方','文昌','考试'] },
  { id:'fuzhou_034', title:'玄武符', category:'四神镇压', content:'玄武为四象之一,镇守北方,主长寿福禄。龟蛇相缠配北方七宿,助福寿绵长。', sealText:'玄武', image:'xuanwu', tags:['四象','玄武','北方','长寿','福禄'] },
  { id:'fuzhou_035', title:'勾陈符', category:'四神镇压', content:'勾陈为四象之一,镇守中央,主厚德载物。麒麟头配中宫土德,助四象协调、宅基稳固。', sealText:'勾陈', image:'gouchen', tags:['四象','勾陈','中央','土德','宅基'] },
  { id:'fuzhou_036', title:'螣蛇符', category:'化解虚惊', content:'螣蛇主惊疑变化,化解虚惊与噩梦。蛇身盘绕,转危为安,使情绪趋于平稳。', sealText:'螣蛇', image:'tengshe', tags:['螣蛇','虚惊','噩梦','惊疑','安神'] },
  { id:'fuzhou_037', title:'六合符', category:'姻缘感情', content:'六合理念源于阴阳和合,主姻缘人际圆满。两仪相交配乾坤坎离四正,催动正缘早临。', sealText:'六合', image:'liuhe', tags:['六合','姻缘','和合','人缘','贵人'] },
  { id:'fuzhou_038', title:'招桃花符v2', category:'姻缘感情', content:'桃花符新版,寓月老和合之意。配北斗七星与青龙白虎,催动红鸾星动。', sealText:'和合', image:'zhaotaohua2', tags:['桃花','月老','红鸾','姻缘','和合'] }
];

// 8 张新增(任务 #35)
const NEW_FULU_V3 = [
  { id:'fuzhou_039', title:'杀气符', category:'攻击邪祟', content:'杀气凛然,戈剑斩精。一剑破魔,百邪退散。', sealText:'戈剑', image:'shaqi', tags:['杀气','戈剑','驱邪','斩精'] },
  { id:'fuzhou_040', title:'请召符', category:'道佛祈请', content:'恭请圣真降临坛场,受命行事。九龙为符胆,神威显赫。', sealText:'请召', image:'qingzao', tags:['请召','圣真','降临','坛场'] },
  { id:'fuzhou_041', title:'功德符', category:'道佛祈请', content:'累积功德,冤亲得度。配聚宝盆与元宝,助福报增长。', sealText:'功德', image:'gongde', tags:['功德','福报','冤亲','净土'] },
  { id:'fuzhou_042', title:'安魂符', category:'超度救拔', content:'三魂七魄复返真身,魂归本位,魄受真形。', sealText:'安魂', image:'anhun', tags:['安魂','三魂','七魄','超度'] },
  { id:'fuzhou_043', title:'超度符', category:'超度救拔', content:'亡灵得度,莲池会上花开见佛。配八卦与六道轮回。', sealText:'超度', image:'chaodu', tags:['超度','亡灵','净土','莲花'] },
  { id:'fuzhou_044', title:'祛病符', category:'健康延寿', content:'祛除病苦,百药调匀,灶君安抚,家宅平安。', sealText:'药王', image:'qubing', tags:['祛病','药王','百病','灶君'] },
  { id:'fuzhou_045', title:'龙梅符', category:'姻缘感情', content:'龙梅之合,鸾凤齐鸣,佳偶天成,永结同心。', sealText:'龙梅', image:'longmei', tags:['龙梅','姻缘','鸾凤','佳偶'] },
  { id:'fuzhou_046', title:'正骨符', category:'健康延寿', content:'骨节复位,气血调和,筋脉舒畅,行动如常。', sealText:'正骨', image:'zhenggu', tags:['正骨','骨节','血气','筋脉'] }
];

// 4 张 v2 + 4 张新增手诀
const NEW_SHOUJUE = [
  { id:'shoujue_021', title:'道指v2', subtype:'三清指', desc:'食指中指伸直开分,无名指小指屈扣掌心,拇指横压食指。', image:'daozhi2', tags:['道指','三清','开指'] },
  { id:'shoujue_022', title:'雷诀v2', subtype:'五雷指', desc:'中指无名指屈第一关节,指背凸起如雷,拇指压其二节。', image:'leijue2', tags:['雷诀','五雷','雷法'] },
  { id:'shoujue_023', title:'北斗诀v2', subtype:'北斗印', desc:'四指伸展如斗魁,拇指横托斗柄,指间点北斗七星。', image:'beidou2', tags:['北斗','七星','星君'] },
  { id:'shoujue_024', title:'五岳诀', subtype:'五岳印', desc:'三指屈扣掌心,拇指小指矗立如峰,镇五岳之煞。', image:'wuyue', tags:['五岳','山神','镇压'] },
  // 8 张新增
  { id:'shoujue_025', title:'天蓬诀', subtype:'天蓬印', desc:'拇指扣中指根,食指伸直朝天,余指收拢,召请天蓬元帅。', image:'tianpeng', tags:['天蓬','元帅','护身'] },
  { id:'shoujue_026', title:'玄坛诀', subtype:'玄坛印', desc:'食指小指伸直,中指无名指弯扣,拇指压中,召赵公明玄坛。', image:'xuantan', tags:['玄坛','财神','赵公明'] },
  { id:'shoujue_027', title:'三清诀', subtype:'三清印', desc:'食指中指并直,无名指小指弯扣,拇指压无名指。', image:'sanqing', tags:['三清','开指','礼请'] },
  { id:'shoujue_028', title:'八卦诀', subtype:'八卦印', desc:'拇指压掌心,四指微屈成八卦形,卦位对应干支。', image:'bagua_jue', tags:['八卦','周易','卦位'] }
];

const kbs = {
  fuzhou: { file: 'www/kb_data/daoism_fuzhou_kb.json', source: '符箓', items: [...NEW_FULU_V2, ...NEW_FULU_V3] },
  shoujue: { file: 'www/kb_data/daoism_shoujue_kb.json', source: '手诀', items: NEW_SHOUJUE }
};

for (const [k, cfg] of Object.entries(kbs)) {
  const fullPath = path.join(__dirname, '..', cfg.file);
  const kb = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  // 找已有 id 跳过
  const existing = new Set(kb.entries.map(e => e.id));
  let added = 0;
  for (const item of cfg.items) {
    if (existing.has(item.id)) { console.log(`  跳过已存在: ${item.id}`); continue; }
    kb.entries.push(item);
    added++;
    console.log(`✓ 注册: ${item.id} | ${item.title}`);
  }
  // bump version
  kb.version = (kb.version || '1.0') + '.0';
  fs.writeFileSync(fullPath, JSON.stringify(kb, null, 2), 'utf-8');
  console.log(`\n${cfg.source} KB 新增 ${added} 条, 总数: ${kb.entries.length}\n`);
}
