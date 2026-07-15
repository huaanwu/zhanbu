/**
 * 紫微专家系统 v1.0
 * --------------------------------------------------
 * 输入: chart = { mingGong, siHua, palaces, horoscope } 等
 * 输出: 【事实·...】格式事实清单
 *
 * 自包含: 不依赖 expert/tables.js
 *
 * v1.0 死代码删除: 原 expert.js 中的 var ZIWEI_SIHUA 表 (60 行) 0 引用, 已删除
 */

Expert.ziwei = function(chart) {
  const facts = [];
  if (chart.mingGong && chart.mingGong.name) {
    facts.push(`【事实·命宫】命宫在${chart.mingGong.name}（${chart.mingGong.ganzhi}）`);
    const mainStars = chart.mingGong.stars?.filter(s => s.type === 'main').map(s => s.name) || [];
    if (mainStars.length > 0) {
      facts.push(`【事实·命宫主星】${mainStars.join('、')}`);
    }
  }
  if (chart.siHua && Object.keys(chart.siHua).length > 0) {
    const siHuaStr = Object.entries(chart.siHua).map(([k,v]) => `${v}${k}`).join(' ');
    facts.push(`【事实·四化】${siHuaStr}`);
  }

  // 【新增】三方四正（命宫+对宫+三合宫）吉星密度
  if (chart.palaces && Array.isArray(chart.palaces) && chart.mingGong) {
    const SAN_HE_GONG = {
      '命宫': ['命宫'],
      '兄弟': ['兄弟宫'],
      '夫妻': ['夫妻宫'],
      '子女': ['子女宫'],
      '财帛': ['财帛宫'],
      '疾厄': ['疾厄宫'],
      '迁移': ['迁移宫'],
      '交友': ['交友宫','奴仆宫'],
      '事业': ['官禄宫'],
      '田宅': ['田宅宫'],
      '福德': ['福德宫'],
      '父母': ['父母宫']
    };
    // 找命宫索引
    const mingIdx = chart.palaces.findIndex(p => p.isMing);
    if (mingIdx >= 0) {
      // 三方四正 = 命宫+对宫(隔6位)+三合(隔4位)
      const oppIdx = (mingIdx + 6) % 12;
      const triIdx1 = (mingIdx + 4) % 12;
      const triIdx2 = (mingIdx + 8) % 12;
      const sifang = [chart.palaces[mingIdx], chart.palaces[oppIdx], chart.palaces[triIdx1], chart.palaces[triIdx2]];
      const allStars = sifang.flatMap(p => (p.stars || []).map(s => s.name));
      const jiStars = ['紫微','天府','太阳','太阴','天同','天梁','左辅','右弼','文昌','文曲','天魁','天钺'];
      const xiongStars = ['擎羊','陀罗','火星','铃星','地空','地劫'];
      const jiCount = allStars.filter(s => jiStars.includes(s)).length;
      const xiongCount = allStars.filter(s => xiongStars.includes(s)).length;
      facts.push(`【事实·三方四正】命宫三方四正(${sifang.map(p => p.name).join('、')})，吉星${jiCount}颗，煞星${xiongCount}颗。${xiongCount > jiCount ? '煞星偏多，需化煞' : jiCount >= 3 ? '吉星汇聚，格局清奇' : '吉煞参半'}`);
    }
  }

  // 【新增】大限流年
  if (chart.horoscope) {
    const hs = chart.horoscope;
    if (hs.decadal) {
      const d = hs.decadal;
      const mutagenStr = d.mutagen?.length === 4 ? `${d.mutagen[0]}化禄 ${d.mutagen[1]}化权 ${d.mutagen[2]}化科 ${d.mutagen[3]}化忌` : '';
      facts.push(`【事实·大限】当前行${d.name}，在${d.palace}（${d.ganzhi}）${mutagenStr ? '，大限四化：' + mutagenStr : ''}`);
      // 大限与命宫关系
      if (d.palace === chart.mingGong?.name) {
        facts.push(`【事实·大限命宫重叠】大限命宫与原命宫重叠，十年运势与先天格局共振，吉凶加倍`);
      }
    }
    if (hs.age) {
      facts.push(`【事实·小限】当前${hs.age.nominalAge}岁，小限在${hs.age.palace}（${hs.age.ganzhi}）`);
    }
    if (hs.yearly) {
      const y = hs.yearly;
      const mutagenStr = y.mutagen?.length === 4 ? `${y.mutagen[0]}化禄 ${y.mutagen[1]}化权 ${y.mutagen[2]}化科 ${y.mutagen[3]}化忌` : '';
      facts.push(`【事实·流年】当前${y.name}，在${y.palace}（${y.ganzhi}）${mutagenStr ? '，流年四化：' + mutagenStr : ''}`);
      // 流年与大限关系
      if (hs.decadal && y.palace === hs.decadal.palace) {
        facts.push(`【事实·流年大限重叠】流年命宫与大限命宫重叠，该年运势为十年峰值`);
      }
    }
  }

  return facts.join('\n') + '\n';
};

