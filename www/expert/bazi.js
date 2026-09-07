/**
 * 八字专家系统 v1.0
 * --------------------------------------------------
 * 输入: pan = { gz: { year, month, day, hour }, wangShuai, daYun, liuNian, ... }
 * 输出: 字符串, 【事实·...】格式的事实清单
 *
 * 依赖: expert/tables.js 中的 TG_WX/DZ_WX/SHENG/KE/SHENGED/KEED
 */

Expert.bazi = function(pan) {
  const facts = [];
  const gz = pan.gz;
  const tg = gz.day[0]; // 日干
  const wx = TG_WX[tg];

  // 四柱回显(保证用户/AI 能直接读到柱位原值)
  facts.push(`【事实·四柱】年柱${gz.year} 月柱${gz.month} 日柱${gz.day} 时柱${gz.hour}`);

  // 旺衰（已有）
  if (pan.wangShuai) {
    facts.push(`【事实·旺衰】日主${tg}为${wx}，在${pan.wangShuai === '身强' ? '身强' : '身弱'}状态`);
  }

  // 用神喜忌（基于知识库）
  if (pan.wangShuai && window._kb?.bazi?.useful_god) {
    const key = pan.wangShuai + wx;
    const ux = window._kb.bazi.useful_god[key];
    if (ux) facts.push(`【事实·用神】${key}用神喜忌：${ux}`);
  }

  // 【新增】纳音
  for (const col of ['year','month','day','hour']) {
    if (gz[col] && NAYIN_60JIAZI[gz[col]]) {
      facts.push(`【事实·纳音】${col === 'year' ? '年柱' : col === 'month' ? '月柱' : col === 'day' ? '日柱' : '时柱'}纳音：${NAYIN_60JIAZI[gz[col]]}`);
    }
  }

  // 【新增】旬空
  const dayGZ = gz.day;
  if (dayGZ && XUNKONG[dayGZ]) {
    facts.push(`【事实·旬空】日柱${dayGZ}属某旬，空亡：${XUNKONG[dayGZ].join('、')}（逢此两支力量减半）`);
  }

  // 格局（基于月支）
  const monthZhi = gz.month[1];
  const monthGan = gz.month[0];
  const monthGanWx = TG_WX[monthGan];
  // 月支本气(本宫藏干,单一来源在 tables.js BRANCH_HIDE_GAN)
  const zhiMain = { '寅':'甲','卯':'乙','巳':'丙','午':'丁','申':'庚','酉':'辛','亥':'壬','子':'癸','辰':'戊','戌':'戊','丑':'己','未':'己' };
  if (zhiMain[monthZhi]) {
    const geZhiGan = zhiMain[monthZhi];
    const geZhiWx = TG_WX[geZhiGan];
    // 简单判断：月支本气五行与日主同→比肩格
    if (geZhiWx === wx) {
      facts.push(`【事实·月令】月支${monthZhi}本气${geZhiGan}，与日主同属${wx}，得月令之助`);
    } else {
      // 五行生克
      const sheng = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
      const ke = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
      if (sheng[wx] === geZhiWx) {
        facts.push(`【事实·月令】日主${wx}生月支${geZhiWx}，泄气于月令`);
      } else if (sheng[geZhiWx] === wx) {
        facts.push(`【事实·月令】月支${geZhiWx}生日主${wx}，得月令之生`);
      } else if (ke[wx] === geZhiWx) {
        facts.push(`【事实·月令】日主${wx}克月支${geZhiWx}，耗力于月令`);
      } else {
        facts.push(`【事实·月令】月支${geZhiWx}克日主${wx}，受月令之克`);
      }
    }
  }

  // 神煞（基于日干/年支/日支）
  // 天乙贵人：甲戊庚→丑未，乙己→子申，丙丁→亥酉，壬癸→巳卯，辛→午寅
  const tianYiMap = { '甲':'丑未','戊':'丑未','庚':'丑未','乙':'子申','己':'子申','丙':'亥酉','丁':'亥酉','壬':'巳卯','癸':'巳卯','辛':'午寅' };
  const tianYiZhi = tianYiMap[gz.day[0]] || '';
  if (tianYiZhi) {
    const tianYiHits = [];
    for (const k of ['year','month','day','hour']) {
      if (tianYiZhi.includes(gz[k][1])) tianYiHits.push((k==='year'?'年':k==='month'?'月':k==='day'?'日':'时') + '支' + gz[k][1]);
    }
    if (tianYiHits.length > 0) facts.push(`【事实·天乙贵人】日干${gz.day[0]}贵人为${tianYiZhi}，见于${tianYiHits.join('、')}（逢凶化吉，遇难成祥）`);
  }

  // 桃花：申子辰→酉，寅午戌→卯，巳酉丑→午，亥卯未→子
  const taohuaMap = { '亥':'子','卯':'子','未':'子','寅':'卯','午':'卯','戌':'卯','巳':'午','酉':'午','丑':'午','申':'酉','子':'酉','辰':'酉' };
  for (const k of ['year','day']) {
    const zhi = gz[k][1];
    if (taohuaMap[zhi]) {
      const thHits = [];
      for (const k2 of ['year','month','day','hour']) {
        if (gz[k2][1] === taohuaMap[zhi] && k2 !== k) {
          thHits.push((k2==='year'?'年':k2==='month'?'月':k2==='day'?'日':'时') + '支' + gz[k2][1]);
        }
      }
      if (thHits.length > 0) {
        facts.push(`【事实·桃花】${k==='year'?'年支':'日支'}${zhi}桃花在${taohuaMap[zhi]}，见于${thHits.join('、')}`);
      }
    }
  }

  // 驿马：申子辰→寅，寅午戌→申，巳酉丑→亥，亥卯未→巳
  const yiMaMap = { '申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳' };
  for (const k of ['year','day']) {
    const zhi = gz[k][1];
    if (yiMaMap[zhi]) {
      const ymHits = [];
      for (const k2 of ['year','month','day','hour']) {
        if (gz[k2][1] === yiMaMap[zhi] && k2 !== k) ymHits.push((k2==='year'?'年':k2==='month'?'月':k2==='day'?'日':'时') + '支' + gz[k2][1]);
      }
      if (ymHits.length > 0) facts.push(`【事实·驿马】${k==='year'?'年支':'日支'}${zhi}驿马在${yiMaMap[zhi]}，见于${ymHits.join('、')}（主奔波、变动、远行）`);
    }
  }

  // 华盖：申子辰→辰，寅午戌→戌，巳酉丑→丑，亥卯未→未
  const huaGaiMap = { '申':'辰','子':'辰','辰':'辰','寅':'戌','午':'戌','戌':'戌','巳':'丑','酉':'丑','丑':'丑','亥':'未','卯':'未','未':'未' };
  for (const k of ['year','day']) {
    const zhi = gz[k][1];
    if (huaGaiMap[zhi]) {
      const hgHits = [];
      for (const k2 of ['year','month','day','hour']) {
        if (gz[k2][1] === huaGaiMap[zhi] && k2 !== k) hgHits.push((k2==='year'?'年':k2==='month'?'月':k2==='day'?'日':'时') + '支' + gz[k2][1]);
      }
      if (hgHits.length > 0) facts.push(`【事实·华盖】${k==='year'?'年支':'日支'}${zhi}华盖在${huaGaiMap[zhi]}，见于${hgHits.join('、')}（主孤独、才华、玄学缘）`);
    }
  }

  // 羊刃（禄前一位）：甲→卯，乙→寅，丙戊→午，丁己→巳，庚→酉，辛→申，壬→子，癸→亥
  const yangRenMap = { '甲':'卯','乙':'寅','丙':'午','戊':'午','丁':'巳','己':'巳','庚':'酉','辛':'申','壬':'子','癸':'亥' };
  const yrZhi = yangRenMap[gz.day[0]];
  if (yrZhi) {
    const yrHits = [];
    for (const k of ['year','month','day','hour']) { if (gz[k][1] === yrZhi) yrHits.push((k==='year'?'年':k==='month'?'月':k==='day'?'日':'时') + '支' + yrZhi); }
    if (yrHits.length > 0) facts.push(`【事实·羊刃】日干${gz.day[0]}羊刃在${yrZhi}，见于${yrHits.join('、')}（性情刚烈，有魄力，防冲动）`);
  }

  // 禄神（本气根）：甲→寅，乙→卯，丙戊→巳，丁己→午，庚→申，辛→酉，壬→亥，癸→子
  const luShenMap = { '甲':'寅','乙':'卯','丙':'巳','戊':'巳','丁':'午','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
  const lsZhi = luShenMap[gz.day[0]];
  if (lsZhi) {
    const lsHits = [];
    for (const k of ['year','month','day','hour']) { if (gz[k][1] === lsZhi) lsHits.push((k==='year'?'年':k==='month'?'月':k==='day'?'日':'时') + '支' + lsZhi); }
    if (lsHits.length > 0) facts.push(`【事实·禄神】日干${gz.day[0]}禄在${lsZhi}，见于${lsHits.join('、')}（主福禄、衣食丰足）`);
  }

  // 五行统计
  if (pan.tenGods) {
    const godCount = {};
    for (const v of Object.values(pan.tenGods)) {
      if (!v) continue;
      const gods = ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'];
      for (const g of gods) if (v.includes(g)) godCount[g] = (godCount[g] || 0) + 1;
    }
    const topGods = Object.entries(godCount).sort((a,b) => b[1] - a[1]).slice(0, 3);
    if (topGods.length > 0) {
      facts.push(`【事实·十神分布】最显著的十神为：${topGods.map(([g,c]) => `${g}(${c}处)`).join('、')}`);
    }
  }

  // 【新增】地支六合（子丑合、寅亥合等）— LIU_HE/LIU_CHONG/LIU_HAI 来自 Expert 全局
  const zhis = ['year', 'month', 'day', 'hour'].map(k => ({ k, z: gz[k][1] }));
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      if (LIU_HE[zhis[i].z] === zhis[j].z) {
        facts.push(`【事实·六合】${zhis[i].k === 'year' ? '年' : zhis[i].k === 'month' ? '月' : zhis[i].k === 'day' ? '日' : '时'}支${zhis[i].z}与${zhis[j].k === 'year' ? '年' : zhis[j].k === 'month' ? '月' : zhis[j].k === 'day' ? '日' : '时'}支${zhis[j].z}六合`);
      }
    }
  }

  // 【新增】地支六冲（子午冲、丑未冲等）
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      if (LIU_CHONG[zhis[i].z] === zhis[j].z) {
        facts.push(`【事实·六冲】${zhis[i].k === 'year' ? '年' : zhis[i].k === 'month' ? '月' : zhis[i].k === 'day' ? '日' : zhis[i].k === 'hour' ? '时' : ''}支${zhis[i].z}与${zhis[j].k === 'year' ? '年' : zhis[j].k === 'month' ? '月' : zhis[j].k === 'day' ? '日' : zhis[j].k === 'hour' ? '时' : ''}支${zhis[j].z}相冲`);
      }
    }
  }

  // 【新增】地支三合局（申子辰合水、寅午戌合火、巳酉丑合金、亥卯未合木）
  const SAN_HE = [
    { wx: '水', group: ['申', '子', '辰'] },
    { wx: '火', group: ['寅', '午', '戌'] },
    { wx: '金', group: ['巳', '酉', '丑'] },
    { wx: '木', group: ['亥', '卯', '未'] }
  ];
  const zhiSet = new Set(zhis.map(z => z.z));
  for (const { wx: w, group } of SAN_HE) {
    const hits = group.filter(g => zhiSet.has(g));
    if (hits.length === 3) {
      facts.push(`【事实·三合局】四柱全${hits.join('、')}，合${w}局成`);
    } else if (hits.length === 2) {
      facts.push(`【事实·半合】四柱见${hits.join('、')}，半合${w}局`);
    }
  }

  // 【新增】十二长生（按日主查各支位）
  const CHANG_SHENG = {
    '木': { '亥':'长生', '子':'沐浴', '丑':'冠带', '寅':'临官', '卯':'帝旺', '辰':'衰', '巳':'病', '午':'死', '未':'墓', '申':'绝', '酉':'胎', '戌':'养' },
    '火': { '寅':'长生', '卯':'沐浴', '辰':'冠带', '巳':'临官', '午':'帝旺', '未':'衰', '申':'病', '酉':'死', '戌':'墓', '亥':'绝', '子':'胎', '丑':'养' },
    '土': { '寅':'长生', '卯':'沐浴', '辰':'冠带', '巳':'临官', '午':'帝旺', '未':'衰', '申':'病', '酉':'死', '戌':'墓', '亥':'绝', '子':'胎', '丑':'养' },
    '金': { '巳':'长生', '午':'沐浴', '未':'冠带', '申':'临官', '酉':'帝旺', '戌':'衰', '亥':'病', '子':'死', '丑':'墓', '寅':'绝', '卯':'胎', '辰':'养' },
    '水': { '申':'长生', '酉':'沐浴', '戌':'冠带', '亥':'临官', '子':'帝旺', '丑':'衰', '寅':'病', '卯':'死', '辰':'墓', '巳':'绝', '午':'胎', '未':'养' }
  };
  const cs = CHANG_SHENG[wx];
  if (cs) {
    for (const k of ['year','month','day','hour']) {
      const z = gz[k][1];
      const kName = k === 'year' ? '年支' : k === 'month' ? '月支' : k === 'day' ? '日支' : '时支';
      if (cs[z]) {
        facts.push(`【事实·十二长生】日主${wx}在${kName}${z}处于${cs[z]}状态`);
      }
    }
  }

  // 【新增】当前大运（按当前年）天干对日主十神
  if (pan.daYun) {
    const now = new Date();
    const y = now.getFullYear();
    const cur = pan.daYun.find(d => y >= d.startYear && y <= d.endYear);
    if (cur && window.tenGodRelation) {
      const daYunGan = cur.ganZhi[0];
      const daYunZhi = cur.ganZhi[1];
      const tgs = window.tenGodRelation(tg, daYunGan);
      facts.push(`【事实·当前大运】${cur.startYear}-${cur.endYear}年：${cur.ganZhi}（天干对日主为${tgs || '同我'}，地支${daYunZhi}属${DZ_WX[daYunZhi] || ''}）`);
    }
  }

  // 【新增】流年分析（当前年份与命局互动）
  if (pan.liuNian) {
    const ln = pan.liuNian;
    facts.push(`【事实·流年】${new Date().getFullYear()}年：${ln.ganZhi}（流年天干对日主为${ln.shiShen || '同我'}）`);

    const lnZhi = ln.ganZhi[1];
    const lnGan = ln.ganZhi[0];
    const lnWx = DZ_WX[lnZhi];

    // 流年地支与命局地支的刑冲合会
    const zhiList = ['year','month','day','hour'].map(k => ({ k, z: gz[k][1] }));

    // 冲
    if (LIU_CHONG[lnZhi]) {
      for (const { k, z } of zhiList) {
        if (LIU_CHONG[lnZhi] === z) {
          facts.push(`【事实·流年冲】流年${lnZhi}冲${k==='year'?'年':k==='month'?'月':k==='day'?'日':'时'}支${z}（冲动该柱，主变动）`);
        }
      }
    }
    // 合
    if (LIU_HE[lnZhi]) {
      for (const { k, z } of zhiList) {
        if (LIU_HE[lnZhi] === z && z !== lnZhi) {
          facts.push(`【事实·流年合】流年${lnZhi}合${k==='year'?'年':k==='month'?'月':k==='day'?'日':'时'}支${z}（合绊该柱，主牵绊）`);
        }
      }
    }
    // 刑（寅巳申、丑戌未、子卯）
    const SAN_XING = [['寅','巳','申'], ['丑','戌','未'], ['子','卯']];
    for (const xingGroup of SAN_XING) {
      if (xingGroup.includes(lnZhi)) {
        for (const { k, z } of zhiList) {
          if (xingGroup.includes(z) && z !== lnZhi) {
            facts.push(`【事实·流年刑】流年${lnZhi}刑${k==='year'?'年':k==='month'?'月':k==='day'?'日':'时'}支${z}（刑伤，主是非病灾）`);
          }
        }
      }
    }
    // 害
    for (const { k, z } of zhiList) {
      if (LIU_HAI[lnZhi] === z) {
        facts.push(`【事实·流年害】流年${lnZhi}害${k==='year'?'年':k==='month'?'月':k==='day'?'日':'时'}支${z}（暗害，主小人暗算）`);
      }
    }

    // 太岁临日支（犯太岁/日值太岁）
    if (lnZhi === gz.day[1]) {
      facts.push(`【事实·日值太岁】流年地支${lnZhi}与日支相同（日值太岁，吉凶加倍）`);
    }
    // 太岁冲日支（冲太岁）
    if (LIU_CHONG[lnZhi] === gz.day[1]) {
      facts.push(`【事实·冲太岁】流年${lnZhi}冲日支${gz.day[1]}（冲太岁，主变动、动荡）`);
    }

    // 流年五行与日主旺衰的关系
    if (pan.wangShuai) {
      const shengWo = SHENGED[wx]; // 被生（印）
      const woSheng = SHENG[wx];   // 生（食伤）
      const keWo = KEED[wx];       // 被克（官杀）
      const woKe = KE[wx];         // 克（财）
      if (lnWx === shengWo) facts.push(`【事实·流年生助】流年${lnZhi}属${lnWx}，生助日主${wx}（印星流年，利学习、贵人）`);
      else if (lnWx === woSheng) facts.push(`【事实·流年泄耗】流年${lnZhi}属${lnWx}，日主${wx}生之（食伤流年，利才华发挥）`);
      else if (lnWx === keWo) facts.push(`【事实·流年克制】流年${lnZhi}属${lnWx}，克日主${wx}（官杀流年，主压力、变动）`);
      else if (lnWx === woKe) facts.push(`【事实·流年耗身】流年${lnZhi}属${lnWx}，日主${wx}克之（财星流年，利求财）`);
      else facts.push(`【事实·流年比和】流年${lnZhi}属${lnWx}，与日主${wx}同类（比劫流年，主竞争、合作）`);
    }

    // 大运+流年双重作用
    if (pan.daYun) {
      const now = new Date();
      const curDaYun = pan.daYun.find(d => now.getFullYear() >= d.startYear && now.getFullYear() <= d.endYear);
      if (curDaYun) {
        const dyGan = curDaYun.ganZhi[0];
        const dyZhi = curDaYun.ganZhi[1];
        // 大运地支与流年地支的关系
        if (LIU_CHONG[dyZhi] === lnZhi) facts.push(`【事实·运岁冲】大运${dyZhi}冲流年${lnZhi}（运岁相冲，该年变动大）`);
        else if (LIU_HE[dyZhi] === lnZhi) facts.push(`【事实·运岁合】大运${dyZhi}合流年${lnZhi}（运岁相合，该年有合绊之事）`);
        else if (dyZhi === lnZhi) facts.push(`【事实·运岁同】大运与流年地支同为${dyZhi}（伏吟，主反复、拖延）`);
      }
    }
  }

  return facts.length > 0 ? facts.join('\n') + '\n' : '';
};

