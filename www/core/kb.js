/**
 * 知识库加载与注入 — 从 app.js 拆出 (v3.0.6)
 * 负责: KB bundle 索引、按需加载、按领域/问题注入知识库文本
 */
(function () {
  if (typeof window === 'undefined') return;

const KB_PATHS = {
  bazi: 'kb_data/bazi_kb.json',
  bazi_ext: 'kb_data/bazi_ext_kb.json',
  bazi_geju: 'kb_data/bazi_geju_kb.json',
  bazi_shensha: 'kb_data/bazi_shensha_kb.json',
  bazi_tiaohou: 'kb_data/bazi_tiaohou_kb.json',
  gua: 'kb_data/gua_kb.json',
  liuyao_ext: 'kb_data/liuyao_ext_kb.json',
  qimen: 'kb_data/qimen_kb.json',
  qimen_ext: 'kb_data/qimen_ext_kb.json',
  ziwei: 'kb_data/ziwei_kb.json',
  ziwei_ext: 'kb_data/ziwei_ext_kb.json',
  ziwei_ext2: 'kb_data/ziwei_ext2_kb.json',
  nihai_xia: 'kb_data/nihai_xia_kb.json',
  nihai_xia_ext: 'kb_data/nihai_xia_ext_kb.json',
  shouxiang: 'kb_data/shouxiang_kb.json',
  xingshi: 'kb_data/xingshi_kb.json',
  xingshi_ext: 'kb_data/xingshi_ext_kb.json',
  ziwei_fuxing: 'kb_data/ziwei_fuxing_kb.json',
  ziwei_daxian: 'kb_data/ziwei_daxian_kb.json',
  ziwei_geju: 'kb_data/ziwei_geju_kb.json',
  qimen_xingmen: 'kb_data/qimen_xingmen_kb.json',
  qimen_geju: 'kb_data/qimen_geju_kb.json',
  qimen_zhanji: 'kb_data/qimen_zhanji_kb.json',
  liuyao_liushen: 'kb_data/liuyao_liushen_kb.json',
  liuyao_xunkong: 'kb_data/liuyao_xunkong_kb.json',
  liuyao_jintui: 'kb_data/liuyao_jintui_kb.json',
  guxiang: 'kb_data/guxiang_kb.json',
  shengxiang: 'kb_data/shengxiang_kb.json',
  qise: 'kb_data/qise_kb.json',
  buddhism_mantra: 'kb_data/buddhism_mantra_kb.json',
  buddhism_divine: 'kb_data/buddhism_divine_kb.json',
  daoism_fuzhou: 'kb_data/daoism_fuzhou_kb.json',
  daoism_zhoushu: 'kb_data/daoism_zhoushu_kb.json',
  daoism_shoujue: 'kb_data/daoism_shoujue_kb.json',
  fengshui_ext: 'kb_data/fengshui_ext_kb.json',
  zeri_ext: 'kb_data/zeri_ext_kb.json',
  meihua_ext: 'kb_data/meihua_ext_kb.json',
  mianxiang_ext: 'kb_data/mianxiang_ext_kb.json',
  daoism_jiuhuo: 'kb_data/daoism_jiuhuo_kb.json',
  bazi_dayun: 'kb_data/bazi_dayun_kb.json',
  ziwei_gongwei: 'kb_data/ziwei_gongwei_kb.json',
  shouxiang_wenli: 'kb_data/shouxiang_wenli_kb.json',
  wannianli: 'kb_data/wannianli_kb.json',
  liuyao_najia: 'kb_data/liuyao_najia_kb.json',
  fengshui_base: 'kb_data/fengshui_base_kb.json',
  xingshi_cases: 'kb_data/xingshi_cases_kb.json',
  mianxiang_qise: 'kb_data/mianxiang_qise_kb.json',
  meihua_lei_xiang: 'kb_data/meihua_lei_xiang_kb.json',
  daoism_zhaijiao: 'kb_data/daoism_zhaijiao_kb.json',
  ziwei_daxian2: 'kb_data/ziwei_daxian2_kb.json',
  bazi_shensha2: 'kb_data/bazi_shensha2_kb.json',
  qimen_paipan: 'kb_data/qimen_paipan_kb.json',
  liuyao_cases: 'kb_data/liuyao_cases_kb.json',
  ziwei_zuhe: 'kb_data/ziwei_zuhe_kb.json',
  bazi_shishen: 'kb_data/bazi_shishen_kb.json',
  fengshui_luopan: 'kb_data/fengshui_luopan_kb.json',
  zeri_jixiong: 'kb_data/zeri_jixiong_kb.json',
  mianxiang_qise2: 'kb_data/mianxiang_qise2_kb.json',
  xingshi_cases: 'kb_data/xingshi_cases_kb.json',
  liuyao_liuqin: 'kb_data/liuyao_liuqin_kb.json',
  qimen_yongshen: 'kb_data/qimen_yongshen_kb.json',
  ziwei_sihua: 'kb_data/ziwei_sihua_kb.json',
  bazi_hehun: 'kb_data/bazi_hehun_kb.json',
  // v1.3.2 交叉模块 KB
  bazi_ziwei_hecan: 'kb_data/bazi_ziwei_hecan_kb.json',
  qimen_fengshui_jiehe: 'kb_data/qimen_fengshui_jiehe_kb.json',
  liuyao_meihua_hucan: 'kb_data/liuyao_meihua_hucan_kb.json'
};

// KB 分组：core 必加载，其余按页面/AI 调用按需加载
const KB_GROUPS = {
  core: ['nihai_xia', 'nihai_xia_ext'],
  bazi: ['bazi', 'bazi_ext', 'bazi_geju', 'bazi_shensha', 'bazi_shensha2', 'bazi_tiaohou', 'bazi_dayun', 'bazi_shishen', 'bazi_hehun', 'wannianli'],
  ziwei: ['ziwei', 'ziwei_ext', 'ziwei_ext2', 'ziwei_daxian', 'ziwei_daxian2', 'ziwei_fuxing', 'ziwei_geju', 'ziwei_gongwei', 'ziwei_zuhe', 'ziwei_sihua', 'wannianli'],
  liuyao: ['gua', 'liuyao_ext', 'liuyao_liushen', 'liuyao_xunkong', 'liuyao_jintui', 'liuyao_najia', 'liuyao_cases', 'liuyao_liuqin', 'wannianli'],
  qimen: ['qimen', 'qimen_ext', 'qimen_geju', 'qimen_xingmen', 'qimen_zhanji', 'qimen_paipan', 'qimen_yongshen', 'wannianli'],
  fengshui: ['fengshui_ext', 'fengshui_base', 'fengshui_luopan', 'zeri_ext', 'zeri_jixiong', 'meihua_ext', 'meihua_lei_xiang', 'mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2'],
  xingshi: ['xingshi', 'xingshi_ext', 'xingshi_cases'],
  daofobuddhism: ['daoism_fuzhou', 'daoism_zhoushu', 'daoism_shoujue', 'daoism_zhaijiao', 'buddhism_mantra', 'buddhism_divine', 'daoism_jiuhuo']
};

// v1.3.0 KB 3 级权重（核心/主/扩）
// primary：模块核心（必加载，3-4个）
// extended：模块扩展（关键词触发，按需加载）
const KB_TIERS = {
  primary: {
    bazi: ['bazi', 'bazi_ext', 'bazi_shensha'],
    ziwei: ['ziwei', 'ziwei_ext', 'ziwei_gongwei'],
    liuyao: ['gua', 'liuyao_ext', 'liuyao_liushen'],
    qimen: ['qimen', 'qimen_ext', 'qimen_xingmen'],
    fengshui: ['fengshui_ext', 'fengshui_base'],
    shouxiang: ['shouxiang', 'guxiang'],
    xingshi: ['xingshi', 'xingshi_ext'],
    daofobuddhism: ['daoism_fuzhou', 'daoism_zhoushu', 'daoism_shoujue', 'buddhism_mantra', 'buddhism_divine'],
    cross: ['bazi', 'ziwei', 'liuyao', 'qimen', 'nihai_xia']
  },
  extended: {
    bazi: ['bazi_geju', 'bazi_tiaohou', 'bazi_dayun', 'bazi_shishen', 'bazi_shensha2', 'bazi_hehun', 'bazi_ziwei_hecan', 'wannianli'],
    ziwei: ['ziwei_ext2', 'ziwei_daxian', 'ziwei_daxian2', 'ziwei_fuxing', 'ziwei_geju', 'ziwei_zuhe', 'ziwei_sihua', 'wannianli'],
    liuyao: ['liuyao_xunkong', 'liuyao_jintui', 'liuyao_najia', 'liuyao_cases', 'liuyao_liuqin', 'liuyao_meihua_hucan', 'wannianli'],
    qimen: ['qimen_geju', 'qimen_zhanji', 'qimen_paipan', 'qimen_yongshen', 'wannianli'],
    fengshui: ['fengshui_luopan', 'zeri_ext', 'zeri_jixiong', 'meihua_ext', 'meihua_lei_xiang', 'mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2', 'qimen_fengshui_jiehe'],
    shouxiang: ['shengxiang', 'qise', 'shouxiang_wenli'],
    xingshi: ['xingshi_cases'],
    daofobuddhism: ['daoism_zhaijiao', 'daoism_jiuhuo']
  }
};

// v1.3.0 关键词 → extended KB 触发规则
// 用户问题含关键词 → 加载对应 extended KB
const KB_TRIGGER_RULES = {
  bazi: [
    { re: /格局|成败|用神|喜忌|身强|身弱|从格/, libs: ['bazi_geju'] },
    { re: /大运|十年|流年|岁运|交运|起运/, libs: ['bazi_tiaohou', 'bazi_dayun'] },
    { re: /十神|比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印/, libs: ['bazi_shishen'] },
    { re: /神煞|将星|学堂|词馆|文昌贵人|禄神|金舆/, libs: ['bazi_shensha2'] },
    { re: /合婚|配对|生肖|婚姻|配偶/, libs: ['bazi_hehun'] },
    { re: /紫微|合参|双术|两术同参|紫白|命理与紫微/, libs: ['bazi_ziwei_hecan'] }
  ],
  ziwei: [
    { re: /宫位|命宫|兄弟|夫妻|子女|财帛|疾厄|迁移|交友|官禄|田宅|福德|父母|身宫/, libs: ['ziwei_gongwei'] },
    { re: /大限|十年大运|流年|太岁|/, libs: ['ziwei_daxian', 'ziwei_daxian2'] },
    { re: /四化|化禄|化权|化科|化忌|飞化|自化/, libs: ['ziwei_fuxing', 'ziwei_sihua'] },
    { re: /格局|杀破狼|机月同梁|巨日同昌|紫府同宫/, libs: ['ziwei_geju', 'ziwei_zuhe'] },
    { re: /庙旺|亮度|落陷/, libs: ['ziwei_ext2'] },
    { re: /八字|合参|双术|命理与紫微|紫白/, libs: ['bazi_ziwei_hecan'] }
  ],
  liuyao: [
    { re: /纳甲|装卦|六亲|六神|伏神|飞神|世应/, libs: ['liuyao_najia', 'liuyao_liuqin'] },
    { re: /旬空|月破|出空|填实|暗动|日破|冲空/, libs: ['liuyao_xunkong'] },
    { re: /进神|退神|反吟|伏吟|游魂|归魂|独发|独静|三合/, libs: ['liuyao_jintui'] },
    { re: /实例|案例|实战|占卜|求测/, libs: ['liuyao_cases'] },
    { re: /梅花|互参|双术|两术同参|六爻梅花|体用/, libs: ['liuyao_meihua_hucan'] }
  ],
  qimen: [
    { re: /排盘|地盘|天盘|值符|值使|阳遁|阴遁|定局/, libs: ['qimen_paipan'] },
    { re: /格局|奇门格局|伏吟|反吟|悖格|击刑/, libs: ['qimen_geju'] },
    { re: /实战|案例|占断|奇门断事/, libs: ['qimen_zhanji'] },
    { re: /用神|选神|取用|判断/, libs: ['qimen_yongshen'] },
    { re: /风水|结合|布局|择日|五黄/, libs: ['qimen_fengshui_jiehe'] }
  ],
  fengshui: [
    { re: /罗盘|24山|三元九运|地盘|/, libs: ['fengshui_luopan'] },
    { re: /择日|黄道|建除|吉日|良辰|/, libs: ['zeri_ext', 'zeri_jixiong'] },
    { re: /梅花|万物类象|体用|起卦|/, libs: ['meihua_ext', 'meihua_lei_xiang'] },
    { re: /气色|面相|印堂|/, libs: ['mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2'] },
    { re: /奇门|结合|值符|八门|互参|奇门风水/, libs: ['qimen_fengshui_jiehe'] }
  ],
  shouxiang: [
    { re: /丘|手指|指型|掌型|掌丘|/, libs: ['shengxiang', 'qise'] },
    { re: /掌纹|主线|智慧线|感情线|生命线|事业线|太阳线|/, libs: ['shouxiang_wenli'] }
  ],
  xingshi: [
    { re: /案例|名人|改名|取名|实际/, libs: ['xingshi_cases'] }
  ],
  daofobuddhism: [
    { re: /科仪|斋醮|道场|法事|超度|开光|/, libs: ['daoism_zhaijiao'] },
    { re: /化解|噩梦|失眠|破财|太岁|压床|场景/, libs: ['daoism_jiuhuo'] }
  ]
};

// 页面 → 预加载 KB 组的映射（switchPage 触发）
const PAGE_KB_GROUPS = {
  bazi: ['bazi'],
  ziwei: ['ziwei'],
  liuyao: ['liuyao'],
  qimen: ['qimen'],
  shouxiang: ['shouxiang'],
  xingshi: ['xingshi'],
  fengshui: ['fengshui'],
  daofobuddhism: ['daofobuddhism'],  // v1.2.17 化解页
  cross: ['bazi', 'ziwei', 'liuyao']  // 三术同参需 3 组
};

const _loadedKBGroups = new Set();
let _kb = {};
let _bundleCache = {};   // v2.0.2: bundle → 已 fetch 的数据,避免重复 fetch
let _bundleIndex = null; // v2.0.2: key → bundle 映射
let _bundleIndexPromise = null;

// v2.0.2: 加载 bundle index (一次,后续复用)
function _loadBundleIndex() {
  if (_bundleIndex) return Promise.resolve(_bundleIndex);
  if (_bundleIndexPromise) return _bundleIndexPromise;
  _bundleIndexPromise = (async () => {
    try {
      const r = await fetch('kb_data/_bundles/_index.json');
      if (!r.ok) {
        console.warn('[KB] bundle index 加载失败,降级逐个 fetch');
        _bundleIndex = {};
        return _bundleIndex;
      }
      _bundleIndex = await r.json();
      return _bundleIndex;
    } catch (e) {
      console.warn('[KB] bundle index 加载异常:', e.message);
      _bundleIndex = {};
      return _bundleIndex;
    }
  })();
  return _bundleIndexPromise;
}

// 内部：按 key 列表加载（跳过已加载的）
// v2.0.2: 先用 bundle index 合并 key → bundle,再并发拉所有需要的 bundle
async function _loadKBByKeys(keys) {
  const toLoad = keys.filter(k => !_kb[k] && KB_PATHS[k]);
  if (toLoad.length === 0) return;

  // 取 bundle index(若失败则降级逐个 fetch)
  const idx = await _loadBundleIndex();
  const useBundle = Object.keys(idx).length > 0;

  if (useBundle) {
    // 1) 找 toLoad 中每个 key 在哪个 bundle
    const bundleToKeys = {};
    for (const k of toLoad) {
      const bundle = idx[k];
      if (bundle) {
        if (!bundleToKeys[bundle]) bundleToKeys[bundle] = [];
        bundleToKeys[bundle].push(k);
      } else {
        // 索引没有 → 逐个 fetch(罕见:新增 KB 未打包)
        bundleToKeys[`__single__${k}`] = [k];
      }
    }
    // 2) 拉所有需要的 bundle
    const fetchPromises = Object.entries(bundleToKeys).map(async ([bundle, kList]) => {
      if (bundle.startsWith('__single__')) {
        // 单文件 fallback
        const k = kList[0];
       try {
         const r = await fetch(KB_PATHS[k]);
         if (r.ok) return [k, await r.json()];
        } catch (e) { console.warn('[KB] 单文件加载失败:', e); }
       return [k, {}];
     }
     if (!_bundleCache[bundle]) {
       try {
         const r = await fetch(`kb_data/_bundles/${bundle}`);
         if (r.ok) _bundleCache[bundle] = await r.json();
         else _bundleCache[bundle] = {};
        } catch (e) { console.warn('[KB] bundle 加载失败:', e); _bundleCache[bundle] = {}; }
     }
      const data = _bundleCache[bundle];
      const out = {};
      for (const k of kList) {
        if (data[k] !== undefined) out[k] = data[k];
      }
      return kList.map(k => [k, out[k] || {}]);
    });
    const results = await Promise.all(fetchPromises);
    const flat = results.flat();
    Object.assign(_kb, Object.fromEntries(flat));
  } else {
    // 降级: 逐个 fetch (v1.x 行为)
    const entries = await Promise.all(
      toLoad.map(async k => {
        try {
          const r = await fetch(KB_PATHS[k]);
          if (!r.ok) return [k, {}];
          return [k, await r.json()];
        } catch { return [k, {}]; }
      })
    );
    Object.assign(_kb, Object.fromEntries(entries));
  }
}

// 加载 core 组（首屏必调）
async function ensureCoreKB() {
  if (_loadedKBGroups.has('core')) return;
  await _loadKBByKeys(KB_GROUPS.core);
  _loadedKBGroups.add('core');
}

// 加载指定组（按需）
async function loadKBGroup(groupName) {
  if (_loadedKBGroups.has(groupName)) return;
  const keys = KB_GROUPS[groupName];
  if (!keys) return;
  await _loadKBByKeys(keys);
  _loadedKBGroups.add(groupName);
}

// 加载多组（用于三术同参等）
async function loadKBGroups(groups) {
  await Promise.all(groups.map(g => loadKBGroup(g)));
}

// ========== v1.3.0 KB 3 级权重加载 ==========
// 加载 domain 的 primary KB（模块核心）
async function loadPrimaryKbs(domain) {
  const keys = KB_TIERS.primary[domain] || [];
  await _loadKBByKeys(keys);
}

// 按用户问题加载 extended KB（关键词触发）
async function loadExtendedKbsByQuestion(domain, question) {
  if (!question) return;
  const rules = KB_TRIGGER_RULES[domain] || [];
  const libs = new Set();
  for (const rule of rules) {
    if (rule.re.test(String(question))) {
      for (const k of rule.libs) libs.add(k);
    }
  }
  if (libs.size === 0) return;
  await _loadKBByKeys(Array.from(libs));
}

// 综合加载：primary 必加载 + extended 按问题触发
async function loadKbsForQuestion(domain, question) {
  await loadPrimaryKbs(domain);
  await loadExtendedKbsByQuestion(domain, question);
}

// 返回 domain primary KB 的注入字符串（自动含倪海厦学派基础）
function kbPrimary(domain) {
  let s = '';
  // 倪海厦学派是所有模块的理论基础
  s += kbNihaiXia();
  // domain 专属 primary KB
  const keys = KB_TIERS.primary[domain] || [];
  for (const k of keys) {
    const fn = window['kb_' + k.charAt(0).toUpperCase() + k.slice(1).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())];
    if (typeof fn === 'function') s += fn();
  }
  return s;
}

// 返回 domain extended KB 按问题触发的注入字符串
function kbExtended(domain, question) {
  if (!question) return '';
  const rules = KB_TRIGGER_RULES[domain] || [];
  const libs = new Set();
  for (const rule of rules) {
    if (rule.re.test(String(question))) {
      for (const k of rule.libs) libs.add(k);
    }
  }
  if (libs.size === 0) return '';
  let s = '\n\n【扩展知识库·按问题关键词加载】';
  for (const k of libs) {
    const fn = window['kb_' + k.charAt(0).toUpperCase() + k.slice(1).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())];
    if (typeof fn === 'function') s += fn();
  }
  return s;
}

// 向后兼容：原 ensureKB 调用 → 等同于 ensureCoreKB（保持 API 兼容）
async function ensureKB() {
  await ensureCoreKB();
}


function kbBazi(pan) {
  const k = _kb?.bazi || {};
  const dayGan = pan.gz?.day?.[0];
  if (!dayGan) return '';
  const wxMap = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const dmKey = dayGan + wxMap[dayGan];
  let s = '\n\n【知识库参考】';
  if (k.day_master?.[dmKey]) s += `\n· 日主${dmKey}：${k.day_master[dmKey]}`;
  const tenGodNames = ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'];
  const godSet = new Set();
  for (const [, v] of Object.entries(pan.tenGods || {})) {
    if (!v) continue;
    for (const god of tenGodNames) { if (v.includes(god)) godSet.add(god); }
  }
  for (const god of godSet) { if (k.ten_gods?.[god]) s += `\n· ${god}：${k.ten_gods[god]}`; }
  const wangShuai = judgeWangShuai(dayGan, pan.gz);
  const wsKey = wangShuai + wxMap[dayGan];
  if (k.useful_god?.[wsKey]) s += `\n· ${wsKey}用神喜忌：${k.useful_god[wsKey]}`;
  s += kbBaziDayun();
  s += kbWannianli();
  s += kbBaziShensha2();
  s += kbBaziShishen();
  s += kbBaziHehun();
  return s;
}

var GUA_NAME_MAP = {
  '乾为天':'乾','坤为地':'坤','水雷屯':'屯','山水蒙':'蒙','水天需':'需','天水讼':'讼',
  '地水师':'师','水地比':'比','风天小畜':'小畜','天泽履':'履','地天泰':'泰','天地否':'否',
  '天火同人':'同人','火天大有':'大有','地山谦':'谦','雷地豫':'豫','泽雷随':'随','山风蛊':'蛊',
  '地泽临':'临','风地观':'观','火雷噬嗑':'噬嗑','山火贲':'贲','山地剥':'剥','地雷复':'复',
  '天雷无妄':'无妄','山天大畜':'大畜','山雷颐':'颐','泽风大过':'大过','坎为水':'坎','离为火':'离',
  '泽山咸':'咸','雷风恒':'恒','天山遁':'遁','雷天大壮':'大壮','火地晋':'晋','地火明夷':'明夷',
  '风火家人':'家人','火泽睽':'睽','水山蹇':'蹇','雷水解':'解','山泽损':'损','风雷益':'益',
  '泽天夬':'夬','天风姤':'姤','泽地萃':'萃','地风升':'升','泽水困':'困','水风井':'井',
  '泽火革':'革','火风鼎':'鼎','震为雷':'震','艮为山':'艮','风山渐':'渐','雷泽归妹':'归妹',
  '雷火丰':'丰','火山旅':'旅','巽为风':'巽','兑为泽':'兑','风水涣':'涣','水泽节':'节',
  '风泽中孚':'中孚','雷山小过':'小过','水火既济':'既济','火水未济':'未济'
};

function kbLiuyao(pan) {
  const k = _kb?.gua || {};
  const fullName = pan.gua?.name;
  const guaName = GUA_NAME_MAP[fullName] || fullName?.[0];
  if (!guaName || !k.gua?.[guaName]) return '';
  const g = k.gua[guaName];
  let s = `\n\n【知识库参考】\n· 卦辞：${g.gua_ci}\n· 象义：${g.xiang}\n· 求财：${g.qiu_cai}\n· 事业：${g.shi_ye}\n· 感情：${g.gan_qing}`;
  const dongYao = pan.gua?.dongYao;
  if (dongYao && k.yao_ci?.[guaName]?.[dongYao]) {
    s += `\n· 动爻（第${dongYao}爻）爻辞：${k.yao_ci[guaName][dongYao]}`;
  }
  s += kbLiuyaoNajia();
  s += kbWannianli();
  s += kbLiuyaoCases();
  s += kbLiuyaoLiuqin();
  return s;
}

function kbQimen(pan) {
  const k = _kb?.qimen || {};
  const stars = new Set(), doors = new Set(), gods = new Set();
  for (const g of pan.gong9 || []) {
    if (g.jiuxing) stars.add(g.jiuxing);
    if (g.renpan) doors.add(g.renpan);
    if (g.shenpan) gods.add(g.shenpan);
  }
  let s = '\n\n【知识库参考】';
  for (const star of stars) { if (k.jiuxing?.[star]) s += `\n· 九星·${star}：${k.jiuxing[star]}`; }
  for (const door of doors) { if (k.bamen?.[door]) s += `\n· 八门·${door}：${k.bamen[door]}`; }
  for (const god of gods) { if (k.bashen?.[god]) s += `\n· 八神·${god}：${k.bashen[god]}`; }
  s += kbWannianli();
  s += kbQimenPaipan();
  s += kbQimenYongshen();
  return s;
}

function kbShouxiang() {
  const k = _kb?.shouxiang || {};
  let s = '\n\n【知识库参考】';
  // 掌型
  if (k.palm_types) {
    s += '\n\n· 掌型分类：';
    for (const [name, desc] of Object.entries(k.palm_types)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 手指特征
  if (k.fingers) {
    s += '\n\n· 手指特征：';
    for (const [name, info] of Object.entries(k.fingers)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 主线
  if (k.main_lines) {
    s += '\n\n· 主线详解：';
    for (const [name, info] of Object.entries(k.main_lines)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 辅线
  if (k.secondary_lines) {
    s += '\n\n· 辅线详解：';
    for (const [name, info] of Object.entries(k.secondary_lines)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 掌丘
  if (k.palm_mounds) {
    s += '\n\n· 掌丘释义：';
    for (const [name, desc] of Object.entries(k.palm_mounds)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 特殊纹
  if (k.special_marks) {
    s += '\n\n· 特殊纹路：';
    for (const [name, desc] of Object.entries(k.special_marks)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 手色手温
  if (k.hand_color_temp) {
    s += '\n\n· 手色与温度：';
    for (const [name, desc] of Object.entries(k.hand_color_temp)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 指甲
  if (k.nails) {
    s += '\n\n· 指甲解读：';
    for (const [name, desc] of Object.entries(k.nails)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 性别规则
  if (k.gender_rules) {
    s += '\n\n· 性别与左右手规则：';
    for (const [name, desc] of Object.entries(k.gender_rules)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  s += kbShouxiangWenli();
  return s;
}

function kbZiwei(chart) {
  const k = _kb?.ziwei || {};
  const mainStars = chart.mingGong?.stars?.filter(s => s.type === 'main').map(s => s.name) || [];
  let s = '\n\n【知识库参考】';
  for (const star of mainStars) { if (k.main_stars?.[star]) s += `\n· ${star}：${k.main_stars[star]}`; }
  for (const [, v] of Object.entries(chart.siHua || {})) { if (k.si_hua?.[v]) s += `\n· ${v}：${k.si_hua[v]}`; }
  if (k.palaces?.[chart.mingGong?.name]) s += `\n· ${chart.mingGong.name}：${k.palaces[chart.mingGong.name]}`;
  s += kbZiweiGongwei();
  s += kbWannianli();
  s += kbZiweiDaxian2();
  s += kbZiweiZuhe();
  s += kbZiweiSihua();
  return s;
}

function kbZiweiExt() {
  const k = _kb?.ziwei_ext || {};
  let s = '\n\n【扩展知识库·紫微】';
  // 星曜组合
  if (k.star_combo) {
    s += '\n· 星曜组合：';
    for (const [combo, desc] of Object.entries(k.star_combo)) {
      s += `\n  ${combo}：${desc}`;
    }
  }
  // 四化
  if (k.si_hua) {
    s += '\n· 四化释义：';
    for (const [name, desc] of Object.entries(k.si_hua)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 大限信息
  if (k.da_xian) {
    s += '\n· 大限运势：';
    for (const [name, desc] of Object.entries(k.da_xian)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 流年信息
  if (k.liu_nian) {
    s += '\n· 流年运势：';
    for (const [name, desc] of Object.entries(k.liu_nian)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 身宫
  if (k.shen_gong) {
    s += '\n· 身宫释义：';
    for (const [name, desc] of Object.entries(k.shen_gong)) {
      s += `\n  身宫在${name}：${desc}`;
    }
  }
  // 庙旺利陷
  if (k.miao_wang) {
    s += '\n· 主星庙旺利陷：';
    for (const [star, desc] of Object.entries(k.miao_wang)) {
      s += `\n  ${star}：${desc}`;
    }
  }
  // 辅星
  if (k.fu_xing) {
    s += '\n· 辅星释义：';
    for (const [star, desc] of Object.entries(k.fu_xing)) {
      s += `\n  ${star}：${desc}`;
    }
  }
  return s;
}

function kbZiweiFuxing() {
  const k = _kb?.ziwei_fuxing || {};
  let s = '\n\n【扩展知识库·紫微辅星】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.palace_effect) s += ` 入宫：${item.palace_effect}`;
      if (item.combo) s += ` 组合：${item.combo}`;
    }
  }
  return s;
}

function kbZiweiDaxian() {
  const k = _kb?.ziwei_daxian || {};
  let s = '\n\n【扩展知识库·紫微大限流年】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.example) s += ` 示例：${item.example}`;
      if (item.method) s += ` 方法：${item.method}`;
    }
  }
  return s;
}

function kbZiweiGeju() {
  const k = _kb?.ziwei_geju || {};
  let s = '\n\n【扩展知识库·紫微格局】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.condition) s += ` 条件：${item.condition}`;
      if (item.effect) s += ` 作用：${item.effect}`;
      if (item.taboo) s += ` 忌讳：${item.taboo}`;
      if (item.remedy) s += ` 化解：${item.remedy}`;
    }
  }
  return s;
}

function kbQimenXingmen() {
  const k = _kb?.qimen_xingmen || {};
  let s = '\n\n【扩展知识库·奇门八门九星八神】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.wangshuai) s += ` 旺衰：${item.wangshuai}`;
      if (item.usage) s += ` 用途：${item.usage}`;
      if (item.combo) s += ` 组合：${item.combo}`;
    }
  }
  return s;
}

function kbQimenGeju() {
  const k = _kb?.qimen_geju || {};
  let s = '\n\n【扩展知识库·奇门格局】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.condition) s += ` 条件：${item.condition}`;
      if (item.effect) s += ` 作用：${item.effect}`;
      if (item.usage) s += ` 用途：${item.usage}`;
    }
  }
  return s;
}

function kbQimenZhanji() {
  const k = _kb?.qimen_zhanji || {};
  let s = '\n\n【扩展知识库·奇门实战占断】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.method) s += ` 方法：${item.method}`;
    }
  }
  return s;
}

function kbLiuyaoLiushen() {
  const k = _kb?.liuyao_liushen || {};
  let s = '\n\n【扩展知识库·六爻六神】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.yao_effect) s += ` 临爻：${item.yao_effect}`;
      if (item.combo) s += ` 组合：${item.combo}`;
      if (item.usage) s += ` 用途：${item.usage}`;
    }
  }
  return s;
}

function kbLiuyaoXunkong() {
  const k = _kb?.liuyao_xunkong || {};
  let s = '\n\n【扩展知识库·六爻旬空月破】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.method) s += ` 方法：${item.method}`;
      if (item.check) s += ` 查法：${item.check}`;
    }
  }
  return s;
}

function kbLiuyaoJintui() {
  const k = _kb?.liuyao_jintui || {};
  let s = '\n\n【扩展知识库·六爻进神退神反吟伏吟】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.effect) s += ` 效应：${item.effect}`;
      if (item.method) s += ` 方法：${item.method}`;
      if (item.check) s += ` 查法：${item.check}`;
    }
  }
  return s;
}

function kbBaziExt(pan) {
  const k = _kb?.bazi_ext || {};
  let s = '\n\n【扩展知识库·八字】';
  // 神煞
  if (k.shen_sha) {
    s += '\n· 神煞释义：';
    for (const [name, desc] of Object.entries(k.shen_sha)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 格局
  if (k.ge_ju) {
    s += '\n· 格局释义：';
    for (const [name, desc] of Object.entries(k.ge_ju)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 刑冲合会
  if (k.xing_chong_he) {
    s += '\n· 刑冲合会：';
    for (const [name, desc] of Object.entries(k.xing_chong_he)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 空亡
  if (k.kong_wang) {
    s += '\n· 空亡释义：';
    for (const [name, desc] of Object.entries(k.kong_wang)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbLiuyaoExt() {
  const k = _kb?.liuyao_ext || {};
  let s = '\n\n【扩展知识库·六爻】';
  // 用神取法
  if (k.yong_shen) {
    s += '\n· 用神取法：';
    for (const [type, desc] of Object.entries(k.yong_shen)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  // 六神
  if (k.liu_shen) {
    s += '\n· 六神释义：';
    for (const [name, desc] of Object.entries(k.liu_shen)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 动爻
  if (k.dong_yao) {
    s += '\n· 动爻变化：';
    for (const [type, desc] of Object.entries(k.dong_yao)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  // 旬空
  if (k.kong_wang) {
    s += '\n· 旬空释义：';
    for (const [name, desc] of Object.entries(k.kong_wang)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 月破
  if (k.yue_po) {
    s += '\n· 月破释义：';
    for (const [name, desc] of Object.entries(k.yue_po)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 反吟伏吟
  if (k.fan_yin_fu_yin) {
    s += '\n· 反吟伏吟：';
    for (const [name, desc] of Object.entries(k.fan_yin_fu_yin)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 游魂归魂
  if (k.you_hun_gui_hun) {
    s += '\n· 游魂归魂：';
    for (const [name, desc] of Object.entries(k.you_hun_gui_hun)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 世应
  if (k.shi_ying) {
    s += '\n· 世应关系：';
    for (const [name, desc] of Object.entries(k.shi_ying)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbQimenExt() {
  const k = _kb?.qimen_ext || {};
  let s = '\n\n【扩展知识库·奇门】';
  // 吉凶格局
  if (k.ji_xiong_ge) {
    s += '\n· 吉凶格局：';
    for (const [name, desc] of Object.entries(k.ji_xiong_ge)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 九星
  if (k.jiu_xing) {
    s += '\n· 九星释义：';
    for (const [name, desc] of Object.entries(k.jiu_xing)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 八神
  if (k.ba_shen) {
    s += '\n· 八神释义：';
    for (const [name, desc] of Object.entries(k.ba_shen)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 八门
  if (k.men_pan) {
    s += '\n· 八门释义：';
    for (const [name, desc] of Object.entries(k.men_pan)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 日时关系
  if (k.ri_shi) {
    s += '\n· 日时关系：';
    for (const [name, desc] of Object.entries(k.ri_shi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 三奇六仪
  if (k.san_qi) {
    s += '\n· 三奇释义：';
    for (const [name, desc] of Object.entries(k.san_qi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 断事方法
  if (k.duan_shi) {
    s += '\n· 断事方法：';
    for (const [name, desc] of Object.entries(k.duan_shi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  s += kbMeihuaLeiXiang();
  return s;
}

function kbNihaiXia() {
  const k = _kb?.nihai_xia || {};
  let s = '\n\n【倪海厦命理精华】';
  // 八字
  if (k.bazi) {
    s += '\n· 八字诀窍：';
    for (const [tip, desc] of Object.entries(k.bazi)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 六爻
  if (k.liuyao) {
    s += '\n· 六爻诀窍：';
    for (const [tip, desc] of Object.entries(k.liuyao)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 奇门
  if (k.qimen) {
    s += '\n· 奇门诀窍：';
    for (const [tip, desc] of Object.entries(k.qimen)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 紫微
  if (k.ziwei) {
    s += '\n· 紫微诀窍：';
    for (const [tip, desc] of Object.entries(k.ziwei)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 常见误区
  if (k.common_pitfalls) {
    s += '\n· 常见误区纠正：';
    for (const [type, desc] of Object.entries(k.common_pitfalls)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  return s;
}

function kbGuxiang() {
  const k = _kb?.guxiang;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·骨相学】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbShengxiang() {
  const k = _kb?.shengxiang;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·声相与行相】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbQise() {
  const k = _kb?.qise;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·气色流年】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  s += kbMianxiangQise();
  s += kbMianxiangQise2();
  return s;
}

function kbBuddhismMantra() {
  const k = _kb?.buddhism_mantra;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·佛教经典咒语】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbBuddhismDivine() {
  const k = _kb?.buddhism_divine;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·佛教占卜法门】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

// ========== 道教知识库注入（v1.2.14 接入） ==========
function kbDaoismFuzhou() {
  const k = _kb?.daoism_fuzhou;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教符咒】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.function) s += ` 作用：${item.function}`;
    if (item.target) s += ` 适用：${item.target}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismZhoushu() {
  const k = _kb?.daoism_zhoushu;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教咒语】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismShoujue() {
  const k = _kb?.daoism_shoujue;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教手诀】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismJiuhuo() {
  const k = _kb?.daoism_jiuhuo;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教化解场景库（30场景）】';
  for (const item of k.entries) {
    s += `\n【${item.title}】\n  场景：${item.scenario || ''}\n  组合：${item.combination || ''}\n  用法：${item.usage || ''}\n  时机：${item.timing || ''}`;
  }
  return s;
}

function kbBaziDayun() {
  const k = _kb?.bazi_dayun;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字大运流年详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiGongwei() {
  const k = _kb?.ziwei_gongwei;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微十二宫详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbShouxiangWenli() {
  const k = _kb?.shouxiang_wenli;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·手相掌纹详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbWannianli() {
  const k = _kb?.wannianli;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·万年历与节气详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoNajia() {
  const k = _kb?.liuyao_najia;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻纳甲装卦详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbFengshuiBase() {
  const k = _kb?.fengshui_base;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·风水基础理论详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbXingshiCases() {
  const k = _kb?.xingshi_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·姓名学实战案例库】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbMianxiangQise() {
  const k = _kb?.mianxiang_qise;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·面相气色详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbMeihuaLeiXiang() {
  const k = _kb?.meihua_lei_xiang;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·梅花易数万物类象】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbDaoismZhaijiao() {
  const k = _kb?.daoism_zhaijiao;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教斋醮科仪详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiDaxian2() {
  const k = _kb?.ziwei_daxian2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数大限流年详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziShensha2() {
  const k = _kb?.bazi_shensha2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字神煞详解（扩展）】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbQimenPaipan() {
  const k = _kb?.qimen_paipan;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·奇门遁甲排盘详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoCases() {
  const k = _kb?.liuyao_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻断卦实例】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiZuhe() {
  const k = _kb?.ziwei_zuhe;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数星曜组合详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziShishen() {
  const k = _kb?.bazi_shishen;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字十神关系详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbFengshuiLuopan() {
  const k = _kb?.fengshui_luopan;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·风水罗盘详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZeriJixiong() {
  // v1.2.26 合并输出：择日通书扩展 + 择日吉神凶煞
  const k1 = _kb?.zeri_ext;
  const k2 = _kb?.zeri_jixiong;
  if (!k1?.entries && !k2?.entries) return '';
  let s = '\n\n【扩展知识库·择日通书+吉神凶煞（双库合并）】';
  if (k1?.entries) {
    s += '\n\n--- 择日通书扩展 ---';
    for (const item of k1.entries.slice(0, 12)) {
      s += `\n【${item.title}】${item.content}`;
    }
  }
  if (k2?.entries) {
    s += '\n\n--- 择日吉神凶煞 ---';
    for (const item of k2.entries.slice(0, 12)) {
      s += `\n【${item.title}】${item.content}`;
    }
  }
  return s;
}

function kbMianxiangQise2() {
  const k = _kb?.mianxiang_qise2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·面相气色详解（扩展）】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbXingshiCases() {
  const k = _kb?.xingshi_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·姓名学案例】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoLiuqin() {
  const k = _kb?.liuyao_liuqin;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻六亲详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbQimenYongshen() {
  const k = _kb?.qimen_yongshen;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·奇门遁甲用神详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiSihua() {
  const k = _kb?.ziwei_sihua;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数四化飞星详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziHehun() {
  const k = _kb?.bazi_hehun;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字合婚详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

// ========== 道佛知识库按需注入（v1.2.14） ==========
// 根据用户问题关键词动态加载道佛知识库，避免无关 token 浪费
// 同时支持负向关键词触发：用户问"病/灾/破财/失意"等时预载化解知识
function kbDaoismBuddhismOnDemand(question) {
  if (!question) return '';
  const q = String(question);
  // 关键词规则：每条匹配后注入对应知识库
  const triggers = [
    // 化解类：符咒+咒语
    { re: /化解|驱邪|镇宅|阴|邪气|噩梦|鬼|冲撞|太岁符|平安符|化煞|辟邪|护身符|流年不利|犯太岁|太岁/, libs: ['daoism_fuzhou', 'daoism_zhoushu'] },
    // 诵经念佛类：佛教咒语+道教咒语
    { re: /超度|放生|供养|诵经|念佛|念咒|回向|业障|阴宅|阳宅不安|噩梦|失眠|焦虑/, libs: ['buddhism_mantra', 'daoism_zhoushu'] },
    // 求签抽签类
    { re: /求签|抽签|灵签|观音签|地藏签|菩萨签|佛珠占|佛经占|心诚则灵/, libs: ['buddhism_divine'] },
    // 道场法事类
    { re: /道场|法事|科仪|斋醮|手诀|法印|掐诀|踏罡|步斗/, libs: ['daoism_shoujue', 'daoism_zhaijiao'] },
    // 佛教经典直接提及
    { re: /心经|大悲咒|准提|金刚经|楞严|药师|地藏|往生咒|普门品|观音菩萨|阿弥陀/, libs: ['buddhism_mantra'] },
    // 道教经典直接提及
    { re: /金光神咒|净心咒|净口咒|净身咒|八大神咒|祝香|玄蕴|太上老君|天尊/, libs: ['daoism_zhoushu'] },
    // 负向结果主动求助：注入化解+咒语
    { re: /怎么办|如何化解|怎么解决|有何建议|怎么改善|能化解吗|可破吗/, libs: ['daoism_fuzhou', 'buddhism_mantra'] }
  ];
  const libs = new Set();
  for (const t of triggers) {
    if (t.re.test(q)) for (const lib of t.libs) libs.add(lib);
  }
  if (libs.size === 0) return '';
  let s = '\n\n【道佛化解知识库·按问题关键词加载】';
  if (libs.has('daoism_fuzhou')) s += kbDaoismFuzhou();
  if (libs.has('daoism_zhoushu')) s += kbDaoismZhoushu();
  if (libs.has('daoism_shoujue')) s += kbDaoismShoujue();
  if (libs.has('daoism_zhaijiao')) s += kbDaoismZhaijiao();
  if (libs.has('buddhism_mantra')) s += kbBuddhismMantra();
  if (libs.has('buddhism_divine')) s += kbBuddhismDivine();
  s += '\n\n【化解建议指引】如解读发现负向结论（凶/衰/空破/被克/犯煞/病/灾/破财/失意等），请基于上述知识库在末尾【化解建议】区块给出 1-3 条化解方案（每条含方法、频次、注意事项）。';
  return s;
}


  window.Core = window.Core || {};
  window.Core.KB = {
    PAGE_KB_GROUPS,
    ensureCoreKB,
    loadKBGroup,
    loadKBGroups,
    loadPrimaryKbs,
    loadExtendedKbsByQuestion,
    loadKbsForQuestion,
    kbPrimary,
    kbExtended,
    kbDaoismBuddhismOnDemand
  };

  // 兼容层:router.js / ai-service.js 仍通过 window.* 访问
  window.PAGE_KB_GROUPS = PAGE_KB_GROUPS;
  window.ensureCoreKB = ensureCoreKB;
  window.ensureKB = ensureKB;
  window.loadKBGroups = loadKBGroups;
  window.loadKBGroup = loadKBGroup;
  window.kbPrimary = kbPrimary;
  window.kbExtended = kbExtended;
  window.kbDaoismBuddhismOnDemand = kbDaoismBuddhismOnDemand;
})();
