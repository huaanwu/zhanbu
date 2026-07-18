/**
 * 六爻专家系统 v1.0
 * --------------------------------------------------
 * 输入: pan = liuyao.panGua() 输出
 * 输出: 【事实·...】格式事实清单
 *
 * 依赖: expert/tables.js 中的 SHI_YING/GUA_FULL_TO_SHORT
 *       lib/liuyao.js 中的 GUA_NAME/LIUSHISIGUA(专家系统独立运行时使用下方副本)
 */



Expert.liuyao = function(pan) {
  const facts = [];
  // 卦名+世应
  facts.push(`【事实·卦象】本卦：${pan.gua.name}`);

  // 动爻数量
  if (pan.gua.dongYaoList && pan.gua.dongYaoList.length > 0) {
    facts.push(`【事实·动爻】共${pan.gua.dongYaoList.length}个动爻：第${pan.gua.dongYaoList.join('、')}爻`);
  } else {
    facts.push(`【事实·动爻】无动爻，卦象静守`);
  }

  // 互卦
  if (pan.huGua) facts.push(`【事实·互卦】互卦为${pan.huGua}`);

  // 用神（六亲吉凶看旺衰）
  if (pan.yaoList) {
    const dongList = pan.yaoList.filter(y => y.isDong);
    if (dongList.length > 0) {
      facts.push(`【事实·动爻六亲】${dongList.map(y => `${y.name}${y.gan}${y.zhi}(${y.liuqin})`).join('、')}`);
    }

    // 妻财爻统计（求财关键）
    const caiYao = pan.yaoList.filter(y => y.liuqin === '妻财');
    if (caiYao.length > 0) {
      facts.push(`【事实·妻财爻】本卦有${caiYao.length}个妻财爻：${caiYao.map(y => `${y.name}(${y.isDong ? '动' : '静'})`).join('、')}`);
    }
    // 官鬼爻
    const guanYao = pan.yaoList.filter(y => y.liuqin === '官鬼');
    if (guanYao.length > 0) {
      facts.push(`【事实·官鬼爻】本卦有${guanYao.length}个官鬼爻：${guanYao.map(y => `${y.name}(${y.isDong ? '动' : '静'})`).join('、')}`);
    }

    if (pan.fuShenList && pan.fuShenList.length > 0) {
      facts.push(`【事实·伏神】${pan.fuShenList.map(f => `${f.name}下伏${f.gan}${f.zhi}(${f.liuqin})`).join('、')}`);
    }

    // 【新增】世爻应爻（按64卦世应固定表）
    if (pan.gua.lines) {
      const shortName = GUA_FULL_TO_SHORT[pan.gua.name] || pan.gua.name?.[0] || pan.gua.name;
      const shiIdx = pan.gua.shiYao && pan.gua.yingYao
        ? { shi: pan.gua.shiYao, ying: pan.gua.yingYao }
        : SHI_YING[shortName];
      if (shiIdx) {
        const shiYao = pan.yaoList[shiIdx.shi - 1];
        const yingYao = pan.yaoList[shiIdx.ying - 1];
        if (shiYao) facts.push(`【事实·世爻】第${shiIdx.shi}爻${shiYao.name}${shiYao.gan}${shiYao.zhi}（${shiYao.liuqin}）持世${shiYao.isDong ? '且发动' : ''}`);
        if (yingYao) facts.push(`【事实·应爻】第${shiIdx.ying}爻${yingYao.name}${yingYao.gan}${yingYao.zhi}（${yingYao.liuqin}）应爻${yingYao.isDong ? '且发动' : ''}`);
        // 世应关系
        if (shiYao && yingYao) {
          const shiWx = shiYao.wuxing, yingWx = yingYao.wuxing;
          const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
          const KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
          if (SHENG[shiWx] === yingWx) facts.push(`【事实·世应生克】世爻${shiWx}生应爻${yingWx}（我生对方，主耗）`);
          else if (SHENG[yingWx] === shiWx) facts.push(`【事实·世应生克】应爻${yingWx}生世爻${shiWx}（对方生我，主吉）`);
          else if (KE[shiWx] === yingWx) facts.push(`【事实·世应生克】世爻${shiWx}克应爻${yingWx}（我克对方，主胜）`);
          else if (KE[yingWx] === shiWx) facts.push(`【事实·世应生克】应爻${yingWx}克世爻${shiWx}（对方克我，主凶）`);
          else facts.push(`【事实·世应生克】世应五行同为${shiWx}（比和，主平稳）`);
        }
      }
    }

    // 【深化】六爻旺衰综合判断（月令 + 日辰 + 旬空 + 月破 + 动变）
    if (pan.yaoList && pan.timeGanzhi) {
      const monthZhi = pan.timeGanzhi.month[1]; // 月建
      const dayZhi = pan.timeGanzhi.day[1];     // 日建
      const dayGan = pan.timeGanzhi.day[0];     // 日干
      const zhiMain = { '寅':'木','卯':'木','巳':'火','午':'火','申':'金','酉':'金','亥':'水','子':'水','辰':'土','戌':'土','丑':'土','未':'土' };
      const monthMain = zhiMain[monthZhi];
      const dayMain = zhiMain[dayZhi];
      const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
      const SHENGED = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
      const KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };

      // 旬空优先使用排盘层已计算结果，兼容旧盘再查专家表。
      const xunKong = Array.isArray(pan.xunKong)
        ? pan.xunKong
        : (window.XUNKONG ? window.XUNKONG[pan.timeGanzhi.day] : null);

      // 月破：月建所冲之爻为月破
      const YUE_PO = { '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅','卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳' };
      const yuePoZhi = YUE_PO[monthZhi];

      // 日辰冲起暗动：静爻被日辰冲则为暗动（旺相之静爻被冲）
      // 日辰合住：爻被日辰合则绊住不动
      const RI_CHONG = YUE_PO; // 日冲同月冲规则
      const RI_HE = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };

      facts.push(`【事实·月建日辰】月建${monthZhi}（本气${monthMain}），日辰${dayZhi}（本气${dayMain}）`);

      // 遍历所有爻，做综合旺衰评估
      const liuQinList = ['妻财', '官鬼', '父母', '兄弟', '子孙'];
      for (const lq of liuQinList) {
        const yls = pan.yaoList.filter(y => y.liuqin === lq);
        if (yls.length === 0) continue;
        const ylWx = yls[0].wuxing;

        // --- 月令旺衰 ---
        let monthStatus;
        if (ylWx === monthMain) monthStatus = '旺';
        else if (SHENG[monthMain] === ylWx) monthStatus = '相（月令生扶）';
        else if (SHENG[ylWx] === monthMain) monthStatus = '休（生月令泄气）';
        else if (KE[ylWx] === monthMain) monthStatus = '囚（克月令耗力）';
        else monthStatus = '死（被月令克）';

        // --- 日辰影响 ---
        let dayEffects = [];
        for (const y of yls) {
          // 日辰生扶
          if (SHENGED[ylWx] === dayMain) dayEffects.push('日辰生扶');
          // 日辰克制
          else if (KE[dayMain] === ylWx) dayEffects.push('日辰克制');
          // 日辰比和
          else if (ylWx === dayMain) dayEffects.push('日辰比和');
          // 日冲（暗动/冲散）
          if (RI_CHONG[y.zhi] === dayZhi) {
            if (monthStatus === '旺' || monthStatus === '相（月令生扶）') dayEffects.push('日冲暗动');
            else dayEffects.push('日冲冲散');
          }
          // 日合（合绊）
          if (RI_HE[y.zhi] === dayZhi) dayEffects.push('日合绊住');
        }
        dayEffects = [...new Set(dayEffects)]; // 去重

        // --- 旬空 ---
        let xunKongStatus = '';
        if (xunKong) {
          for (const y of yls) {
            if (xunKong.includes(y.zhi)) {
              xunKongStatus = '旬空（力量减半，出空有力）';
              break;
            }
          }
        }

        // --- 月破 ---
        let yuePoStatus = '';
        for (const y of yls) {
          if (y.zhi === yuePoZhi) {
            yuePoStatus = '月破（力量极弱，出月恢复）';
            break;
          }
        }

        // --- 动变影响 ---
        let dongBianStatus = '';
        const dongYls = yls.filter(y => y.isDong);
        if (dongYls.length > 0) {
          const dongEffects = [];
          for (const y of dongYls) {
            if (pan.bianYaoList && pan.bianYaoList[y.yao - 1]) {
              const bian = pan.bianYaoList[y.yao - 1];
              // 回头生
              if (SHENGED[ylWx] === bian.wuxing) dongEffects.push('化回头生');
              // 回头克
              else if (KE[bian.wuxing] === ylWx) dongEffects.push('化回头克');
              // 化进神（五行同且进一位，如寅化卯）
              else if (ylWx === bian.wuxing) {
                // 进神：五行同类、地支顺行（土按 丑→辰→未→戌→丑 循环）
                const jinShen = { '亥':'子','寅':'卯','巳':'午','申':'酉','丑':'辰','辰':'未','未':'戌','戌':'丑' };
                // 退神：进神的逆
                const tuiShen = { '子':'亥','卯':'寅','午':'巳','酉':'申','辰':'丑','未':'辰','戌':'未','丑':'戌' };
                if (jinShen[y.zhi] === bian.zhi) dongEffects.push('化进神');
                else if (tuiShen[y.zhi] === bian.zhi) dongEffects.push('化退神');
              }
            }
          }
          if (dongEffects.length > 0) dongBianStatus = dongEffects.join('、');
        }

        // --- 综合旺衰结论 ---
        const score = this._calcLiuyaoWangShai(
          monthStatus, dayEffects, xunKongStatus, yuePoStatus, dongBianStatus
        );

        let summary = `【事实·旺衰】${lq}爻五行${ylWx}：月令${monthStatus}`;
        if (dayEffects.length > 0) summary += `，日辰${dayEffects.join('、')}`;
        if (xunKongStatus) summary += `，${xunKongStatus}`;
        if (yuePoStatus) summary += `，${yuePoStatus}`;
        if (dongBianStatus) summary += `，动变${dongBianStatus}`;
        summary += `。综合旺衰：${score.level}（${score.desc}）`;
        facts.push(summary);
      }
    }

    // 【新增】卦变分析（本卦 → 变卦）—— 输出变卦具体爻象
    if (pan.gua.dongYaoList && pan.gua.dongYaoList.length > 0) {
      const dongList = pan.gua.dongYaoList;
      // 变卦名称由排盘层按统一的“初爻→上爻”线序计算，专家层不再重复一套易错映射。
      const bianGuaName = pan.gua.bianName || '未知';
      
      facts.push(`【事实·变卦】动爻${dongList.length}个（第${dongList.join('、')}爻），本卦${pan.gua.name} → 变卦${bianGuaName}`);
      
      // 变爻具体信息（含变卦六亲）
      const bianYaoDetails = dongList.map(d => {
        const yao = pan.yaoList[d - 1];
        const bian = pan.bianYaoList && pan.bianYaoList[d - 1];
        if (!bian) return `${yao.name}${yao.gan}${yao.zhi}(${yao.liuqin}) → 变爻未知`;
        return `${yao.name}${yao.yinYang}${yao.gan}${yao.zhi}(${yao.liuqin}) → ${bian.yinYang}${bian.gan}${bian.zhi}(${bian.liuqin})`;
      });
      facts.push(`【事实·变爻详情】${bianYaoDetails.join('；')}`);

      // 变卦整体六亲分布（供AI参考变卦趋势）
      if (pan.bianYaoList) {
        const bianLiuQinCount = {};
        for (const by of pan.bianYaoList) {
          bianLiuQinCount[by.liuqin] = (bianLiuQinCount[by.liuqin] || 0) + 1;
        }
        const bianLiuQinDist = Object.entries(bianLiuQinCount)
          .sort((a, b) => b[1] - a[1])
          .map(([lq, c]) => `${lq}${c}个`)
          .join('、');
        facts.push(`【事实·变卦六亲分布】${bianGuaName}：${bianLiuQinDist}`);
      }
    }
  }

  return facts.join('\n') + '\n';
};


// ============= 六爻旺衰综合评分 =============
Expert._calcLiuyaoWangShai = function(monthStatus, dayEffects, xunKongStatus, yuePoStatus, dongBianStatus) {
  let score = 50; // 基础分

  // 月令评分（权重40%）
  if (monthStatus.includes('旺')) score += 20;
  else if (monthStatus.includes('相')) score += 10;
  else if (monthStatus.includes('休')) score -= 5;
  else if (monthStatus.includes('囚')) score -= 10;
  else if (monthStatus.includes('死')) score -= 15;

  // 日辰评分（权重30%）
  if (dayEffects.includes('日辰生扶')) score += 15;
  if (dayEffects.includes('日辰比和')) score += 10;
  if (dayEffects.includes('日辰克制')) score -= 10;
  if (dayEffects.includes('日冲暗动')) score += 5; // 暗动增加活跃度
  if (dayEffects.includes('日冲冲散')) score -= 15;
  if (dayEffects.includes('日合绊住')) score -= 10;

  // 旬空（权重15%）
  if (xunKongStatus) score -= 20;

  // 月破（权重15%）
  if (yuePoStatus) score -= 20;

  // 动变（额外加成/减成）
  if (dongBianStatus) {
    if (dongBianStatus.includes('化回头生')) score += 15;
    if (dongBianStatus.includes('化进神')) score += 10;
    if (dongBianStatus.includes('化回头克')) score -= 15;
    if (dongBianStatus.includes('化退神')) score -= 5;
  }

  // 限制在 0-100
  score = Math.max(0, Math.min(100, score));

  // 分级
  let level, desc;
  if (score >= 80) { level = '旺相'; desc = '得令得生，有力可用'; }
  else if (score >= 60) { level = '平和'; desc = '不旺不衰，勉强可用'; }
  else if (score >= 40) { level = '衰弱'; desc = '失令受制，力量不足'; }
  else { level = '极弱'; desc = '月破旬空，几乎无力'; }

  return { score, level, desc };
};

