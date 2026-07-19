/**
 * 思维链/打分/交叉验证系统 v1.0
 * --------------------------------------------------
 * 提供:
 *   Expert.chainOfThought(domain) - 各流派 CoT prompt 模板
 *   Expert.fewshot(domain) - few-shot 例子
 *   Expert.score(domain, pan) - 排盘打分
 *   Expert.crossValidate(cross) - 三术交叉验证
 *
 * 依赖: expert/tables.js 中的 TG_WX/DZ_WX/SHENG/KE/SHENGED/KEED/SHI_YING/GUA_FULL_TO_SHORT
 */

// ============= 思维链 Prompt =============
// 各流派规则(模块级 const,供中文/英文 key 共用,避免重复)
const _CO_BAZI = '八字分析重点：日主旺衰决定格局高低，用神取法需看月令+全局五行流通，忌见用神被冲克、闲神混杂。大运流年与命局形成刑冲合会时需特别关注。';
const _CO_LIUYAO = '六爻分析重点：用神选取看问测类型（财/官/父/子/兄），用神旺衰看月令+日辰+动爻生克，世爻代表自己、应爻代表对方/事情。动爻变出之爻为变卦，变爻对动爻有生克作用。';
const _CO_QIMEN = '奇门分析重点：值符为事体、值使为执行，日干为求测人、时干为所问之事。吉格（如青龙返首、飞鸟跌穴）主吉，凶格（如白虎猖狂、青龙逃走）主凶。生门/开门/休门为吉门，死门/惊门/伤门为凶门。';
const _CO_ZIWEI = '紫微分析重点：命宫主星决定基本性格，三方四正看格局高低，四化（禄权科忌）决定运势起伏。吉星（紫微天府日月同梁左右昌曲魁钺）多则格局清，煞星（羊陀火铃空劫）多则波折多。';
const _CO_XINGSHI = '姓名学分析重点：五格中人格为核心（主一生运势），地格主青年、总格主晚年。三才配置（天格人格地格的五行关系）需相生忌相克。数理吉凶看1-81数理的固定属性。';
const _CO_SHOUXIANG = '手相分析重点：三大主线（生命线/智慧线/感情线）为骨架，辅助纹路（太阳线/命运线/婚姻线）为细节。掌丘饱满主该领域能力强，纹路深长清晰主运势稳定。';
const _CO_CROSS = '三术同参重点：以八字定先天格局、六爻看具体事态、奇门择时定向。综合三方信号避免单一术数的局限,重点关注三术指向一致的结论。';

Expert.chainOfThought = function(domain) {
  const domainRules = {
    // 中文 key(对齐 index.html 调用方的实际传参)
    '八字': _CO_BAZI,
    '六爻': _CO_LIUYAO,
    '奇门': _CO_QIMEN,
    '紫微': _CO_ZIWEI,
    '姓名': _CO_XINGSHI,
    '手相': _CO_SHOUXIANG,
    '三术同参': _CO_CROSS,
    // 英文 key(向后兼容,避免内部/历史调用崩)
    bazi: _CO_BAZI,
    liuyao: _CO_LIUYAO,
    qimen: _CO_QIMEN,
    ziwei: _CO_ZIWEI,
    xingshi: _CO_XINGSHI,
    shouxiang: _CO_SHOUXIANG
  };

  if (!domainRules[domain]) {
    console.warn('[Expert.chainOfThought] 未知 domain:', domain, '回退到通用模板');
  }

  return `【解读要求】
你是一位精通传统命理的资深专家。基于上方确定事实和知识库，直接给出命理解读。

【${domain}专项规则】
${domainRules[domain] || '请基于传统命理知识进行严谨分析。'}

【输出格式】
## 命局概览
简要描述命盘整体格局。
## 详细分析
分健康、事业、财运、感情等方面逐一分析，必须基于确定事实推理。
## 流年运势
分析当前大运和流年对命局的影响。
## 综合建议
给出2-3条具体可行的建议。

【铁律】
- 必须用纯中文输出，禁止出现任何英文单词、英文标点或英文思考过程。
- 禁止展示分析步骤、思维链、thinking process 等元内容。
- 禁止用"可能""也许""大概"等模糊词汇，给出明确判断。
- 若信息不足，明确说"依据现有信息无法判断"。
- 涉及健康/投资等重大决策时，必须提醒"仅供参考，请结合实际情况判断"。`;
};

// ============= Few-shot 案例 =============
// 六爻样例(完整版,作为基线示范)
const FEWSHOT_LIUYAO = `【Few-shot 标准示范】

示范案例（问事业）：
排盘：乾卦，五爻动（兄弟持世），妻财爻动，官鬼静。
提问："问近期事业发展"

## 关键信号
1. 五爻动是兄弟爻（耗财之象）
2. 妻财爻动，财有动向
3. 官鬼静：暂无官职/升迁变动
4. 兄弟持世：竞争者多，需防争夺

## 推理过程
兄弟动则劫财，说明有同行竞争、朋友争夺资源。妻财动说明近期有财机，但动财不生世（兄弟克财反劫）。官鬼静说明事业升迁尚无明确信号。

## 结论
近期事业有竞争压力，财运虽有动向但易被他人分走。不宜冒进扩张，宜守不宜攻。

## 置信度
中，动爻信息明确但具体应期需结合流年。

## 行动建议
- 守正出奇，专注主业，不宜分心副业
- 防小人暗算，重要决策多与长辈商议
- 待官鬼动时再考虑主动求变

---

请参照上述风格进行本次解读。`;

// 八字样例(bazi 模块使用频率最高,优先保证质量)
const FEWSHOT_BAZI = `【Few-shot 标准示范】

示范案例（问财运）：
排盘：男，1990 年 6 月 15 日午时。八字：庚午、壬午、戊午、戊午（午午自刑）。
格局：戊土日主生于午月当令，地支三午一庚透干。身极旺，喜金水，忌木火。
提问："未来三年财运如何"

## 关键信号
1. 戊土日主当令又得三午火局生扶，身极旺
2. 庚金偏财透干但坐死地（午火克金），财星无根
3. 壬水正财藏于午中本气不透，财弱
4. 用神为金水，喜西北、秋冬

## 推理过程
身极旺而财弱，说明命主有赚钱能力但难得大财，需行金水运方能发富。当前大运若走木火则财运平平，若遇金水流年则有转机。三刑入命需注意人际关系破财。

## 结论
未来三年总体财运平稳，无大起大落。若遇申酉金年或亥子水年有偏财机会，但需防合伙破财。宜稳健理财，忌投机借贷。

## 置信度
中高，身旺喜忌明确；但具体年份应期需结合流年十神配置。

## 行动建议
- 主业深耕，不宜大幅扩张副业
- 西北方向发展有利，可考虑出差或异地求财
- 慎选合伙人，避免与午、未年生者大额合资
- 秋冬季节把握投资机会，春夏守为上

---

请参照上述风格进行本次解读。`;

// 紫微样例(命宫主星 + 四化 + 三方四正 + 大限流年,展示紫微范式)
const FEWSHOT_ZIWEI = `【Few-shot 标准示范】

示范案例（问事业）：
排盘：男，1988 年 5 月 20 日卯时。
紫微盘：命宫在子宫（壬子），主星紫微+天府同宫。
四化（戊年生年）：贪狼化禄、太阳化权、武曲化科、天同化忌。
三方四正：吉星 5 颗（紫微/天府/左辅/文昌/天魁），煞星 0 颗。
大限：当前 26-35 岁大限在巳宫（天机天梁）。
流年：2026 丙午年，流年命宫在寅宫（廉贞破军）。
提问："接下来五年事业发展如何"

## 关键信号
1. 紫微天府同宫于子位 → 帝星+财星组合,主格局清贵,事业起点高
2. 戊年贪狼化禄落命迁线 → 偏财/桃花星化禄,主机遇多
3. 三方四正吉星密度高(5/14),煞星 0 → 先天格局稳定
4. 当前大限天机天梁 → 主运筹帷幄、贵人扶持
5. 流年丙午,火旺克金(武曲化科受克),今年文书/合同易有变数

## 推理过程
紫微天府同宫者,事业起步即有格局,适合体制内或大平台。戊年贪狼化禄落命迁线,主三十岁前后有重要机遇(外派/升职/创业)。三方四正吉多煞少,说明先天抗压能力强,即使遇挫也能快速恢复。当前大限天机天梁,主靠智慧与长辈提拔,2025-2030 五年是关键成长期。但流年丙午克武曲化科,2026 年需注意合同细节、证书延期等小波折。

## 结论
未来五年事业总体向上,2026-2027 年是奠基期(可能平台/方向调整),2028-2030 年是大展期(化禄发力)。忌急躁跳槽,宜在大平台深耕,等大限吉星完全发力。

## 置信度
中高,紫微主星+四化+大限三处信号一致;但具体应期需结合流年逐盘推。

## 行动建议
- 选择行业优先考虑大平台(央国企/上市公司/头部外企)
- 流年丙午注意合同审核、文书签字
- 西北、北方发展方向有利
- 2028 戊申年(贪狼化禄到位)是事业关键年,提前 1-2 年布局

---

请参照上述风格进行本次解读。`;

// 奇门样例(九宫 + 值符值使 + 三奇六仪 + 格局)
const FEWSHOT_QIMEN = `【Few-shot 标准示范】

示范案例（问投资）：
排盘：男，1992 年 3 月 10 日午时。
奇门盘：阳遁 1 局,值符天蓬（落坎一宫）,值使休门（落坤二宫）。
日干丙（火）落艮八宫,时干庚（金）落震三宫。
格局：生门落巽四宫,天辅+戊土;开门落乾六宫,天心+壬水。
提问："近期股票投资是否合适"

## 关键信号
1. 值符天蓬主智谋/暗助,落坎一宫(水),得月令,主有贵人暗中指点
2. 值使休门主休养/等待,落坤二宫(土),主不宜急进
3. 日干丙落艮八宫,宫位属土,丙火泄于土(有消耗之象)
4. 时干庚为投资标的,落震三宫(木),金克木,主有阻力
5. 生门落巽四宫(木),木生火,与日干相生,可求小财

## 推理过程
奇门预测投资需看三要素:①日干(求测人)②时干(所测事)③生门/开门(财位)。本案日干丙火落艮八宫,虽然有戊土泄力,但宫位得月令,主有根。时干庚金为股票/投资标的,落震三宫木位,金克木,主力道受阻,投资环境不利。生门虽落巽四宫与日干相生,但生门宫位本身属木,木旺金弱时求财反致损耗。值使休门主休,综合判断:近三个月不宜激进投资。

## 结论
近期股票投资偏凶,主:①市场阻力大 ②求测人精力消耗 ③即便入场也难获利。建议观望至 2026 年下半年(丙午流年火旺金弱转金旺时)。可关注债券类稳定收益。

## 置信度
中,奇门盘信息丰富但解读依赖经验;具体个股选择需结合更多数据。

## 行动建议
- 暂停股票加仓,现有持仓可减半
- 关注债券/货币基金等低风险品种
- 2026 年 9-10 月(秋季金旺)再考虑入场
- 投资决策多与长辈/专业人士商议,忌独断

---

请参照上述风格进行本次解读。`;

// 三术同参样例(八字+紫微+六爻联合,展示三方一致性判断)
const FEWSHOT_CROSS = `【Few-shot 标准示范】

示范案例（问事业）：
八字：男，1990 年 6 月 15 日午时 — 庚午、壬午、戊午、戊午（午午自刑）。
格局：戊土日主生于午月当令,地支三午一庚,身极旺,喜金水忌木火。
紫微盘：命宫在未宫（己未）,主星紫微+天府同宫。壬年生年:天梁化禄、紫微化权、左辅化科、武曲化忌。
六爻盘：时间起卦（当日午时）→ 天水讼卦（本宫坎）,三爻父母动。
共同提问："未来三年事业财运如何"

## 关键信号
1. **八字**:身极旺(戊土+三午),喜金水(财官方位),忌木火(印比耗泄)
2. **紫微**:紫微天府同宫(大贵之格),天梁化禄主名声/荫庇,紫微化权主权柄
3. **六爻**:官鬼爻持世(事业有根),三爻父母动(文书/合同/调动)
4. **三方一致性**:三术都指向"事业有格局但需金水年触发" — 高置信

## 推理过程
八字定先天:身旺需财官(庚金/壬水)激发,2028 戊申、2029 己酉、2030 庚戌是金旺年。
紫微定十年大运:紫微化权在命,主 30-40 岁掌权;壬年天梁化禄主遇贵人提拔。
六爻定近期事件:父母动主近期有合同/调动相关事,官鬼持世动则事业主体活跃。
三术交叉:共同指向 2028-2030 三年是事业黄金期(八字金年+紫微大限发力+六爻官鬼动),2026 丙午年(克金)需守。

## 结论
未来三年事业有"先蹲后跳"特征:2026-2027 奠基/调整(可能换平台/换岗),2028-2030 跃升(升职/创业/分红)。财运与事业同步,主业收入大幅增长,副业/投资可适度参与但需在 2028 后。

## 置信度
高,八字用神/紫微化禄/六爻官鬼三方一致。

## 行动建议
- 2026-2027 强化专业能力,争取关键项目/证书
- 西北方向发展有利,可考虑外派/异地机会
- 2028 春(戊申)开始留意晋升/创业信号
- 2026 丙午年避免重大财务决策(签约/投资/合伙)
- 重视六亲(尤其父母/长辈)助力,紫微天梁化禄主长辈荫庇

---

请参照上述风格进行本次解读。`;

Expert.fewshot = function(domain) {
  const map = {
    '六爻': FEWSHOT_LIUYAO,
    'liuyao': FEWSHOT_LIUYAO,
    '八字': FEWSHOT_BAZI,
    'bazi': FEWSHOT_BAZI,
    '紫微': FEWSHOT_ZIWEI,
    'ziwei': FEWSHOT_ZIWEI,
    '奇门': FEWSHOT_QIMEN,
    'qimen': FEWSHOT_QIMEN,
    '三术同参': FEWSHOT_CROSS,
    'cross': FEWSHOT_CROSS,
  };
  if (!map[domain]) {
    console.warn('[Expert.fewshot] 未知 domain:', domain, '回退到六爻示例');
  }
  return map[domain] || FEWSHOT_LIUYAO;
};


Expert.score = function(domain, pan) {
  const scores = {};
  
  if (domain === 'bazi') {
    // 八字评分：五行平衡度、十神配置、大运配合
    const wuxing = pan.wuxing || {};
    const total = Object.values(wuxing).reduce((a, b) => a + b, 0) || 1;
    const balance = 100 - Math.max(...Object.values(wuxing)) / total * 100;
    scores.balance = Math.round(balance);
    scores.career = pan.shiShen?.['正官'] || pan.shiShen?.['七杀'] ? 75 : 50;
    scores.wealth = pan.shiShen?.['正财'] || pan.shiShen?.['偏财'] ? 70 : 45;
    scores.marriage = pan.shiShen?.['正财'] || pan.shiShen?.['正官'] ? 72 : 48;
    scores.health = balance > 70 ? 75 : 55;
  }
  
  if (domain === 'ziwei') {
    // 紫微评分：格局高低、吉星数量、煞星数量
    const stars = pan.stars || [];
    const goodStars = stars.filter(s => ['紫微','天府','太阳','太阴','天同','天梁','左辅','右弼','文昌','文曲','天魁','天钺'].includes(s)).length;
    const badStars = stars.filter(s => ['擎羊','陀罗','火星','铃星','地空','地劫'].includes(s)).length;
    scores.pattern = Math.min(95, 60 + goodStars * 5 - badStars * 3);
    scores.career = goodStars >= 3 ? 78 : 52;
    scores.wealth = stars.includes('武曲') || stars.includes('天府') ? 80 : 50;
    scores.marriage = stars.includes('太阳') || stars.includes('太阴') ? 75 : 48;
    scores.health = badStars <= 2 ? 72 : 45;
  }
  
  if (domain === 'liuyao') {
    // 六爻评分：用神旺衰、动爻数量、世应关系
    const yaoList = pan.yaoList || [];
    const dongYao = yaoList.filter(y => y.isDong).length;
    const liuyaoShortName = GUA_FULL_TO_SHORT[pan.gua.name] || (pan.gua.name && pan.gua.name[0]) || pan.gua.name;
    const liuyaoSY = SHI_YING[liuyaoShortName] || {};
    const shiYao = yaoList[liuyaoSY.shi - 1];
    const yingYao = yaoList[liuyaoSY.ying - 1];
    scores.accuracy = dongYao >= 1 && dongYao <= 3 ? 80 : 55;
    scores.timing = dongYao > 0 ? 75 : 40;
    scores.outcome = shiYao && yingYao ? 70 : 45;
  }
  
  if (domain === 'qimen') {
    // 奇门评分：吉格凶格、吉门吉星、值符值使
    const gong9 = pan.gong9 || [];
    const goodMen = ['休门','生门','开门'];
    const badMen = ['死门','惊门','伤门'];
    const goodCount = gong9.filter(g => goodMen.includes(g.renpan)).length;
    const badCount = gong9.filter(g => badMen.includes(g.renpan)).length;
    scores.opportunity = goodCount >= 2 ? 78 : 50;
    scores.risk = badCount <= 2 ? 72 : 40;
    scores.timing = pan.zhishi ? 75 : 45;
  }
  
  if (domain === 'xingshi') {
    // 姓名评分：五格吉凶、三才配置、数理得分
    // xingshi.calculateGege() 返回扁平对象 {tiange, renge, ...},无 wuge wrapper
    const ge = pan.wuge || pan;
    const goodGe = [1,3,5,6,7,8,11,13,15,16,17,18,21,23,24,25,31,32,33,35,37,39,41,45,47,48,52,57,61,63,65,67,68,77,78,81];
    const scores_list = [ge.tiange, ge.renge, ge.dige, ge.waige, ge.zongge].map(g => goodGe.includes(g) ? 80 : 50);
    scores.overall = Math.round(scores_list.reduce((a,b)=>a+b,0) / 5);
    scores.career = scores_list[1]; // 人格
    scores.wealth = scores_list[0]; // 天格
    scores.health = scores_list[2]; // 地格
  }
  
  // 统一格式
  const result = [];
  for (const [k, v] of Object.entries(scores)) {
    result.push(`${k === 'balance' ? '五行平衡' : k === 'pattern' ? '格局高低' : k === 'accuracy' ? '准确度' : k === 'timing' ? '时机把握' : k === 'outcome' ? '结果预测' : k === 'opportunity' ? '机遇指数' : k === 'risk' ? '风险指数' : k === 'overall' ? '综合评分' : k === 'career' ? '事业运' : k === 'wealth' ? '财运' : k === 'marriage' ? '婚姻运' : k === 'health' ? '健康运' : k}: ${v}分`);
  }
  return result.join(' | ');
};

// ============= 三术同参交叉验证器 =============
// 在 AI 解读前，用代码层面对八字/紫微/六爻做交叉验证
Expert.crossValidate = function(cross) {
  const { bazi, ziwei, liuyao, question } = cross;
  const result = {
    yongShen: {},      // 用神一致性
    direction: {},     // 吉凶方向一致性
    conflicts: [],     // 矛盾点
    confidence: {},    // 置信度
    formatted: ''      // 格式化输出
  };

  // ===== 1. 八字用神分析 =====
  const dayGan = bazi?.gz?.day?.[0];
  const dayWx = TG_WX[dayGan];
  const wangShuai = bazi?.wangShuai;
  let baziYongShen = '';
  if (wangShuai === '身强') {
    // 身强喜克泄耗（官杀、食伤、财星）
    baziYongShen = KE[dayWx] || ''; // 官杀（克我）
  } else {
    // 身弱喜生扶（印星、比劫）
    baziYongShen = SHENGED[dayWx] || ''; // 印星（生我）
  }

  // ===== 2. 六爻用神分析（按问测类型） =====
  let liuyaoYongShen = '';
  const q = (question || '').toLowerCase();
  if (q.includes('财') || q.includes('钱') || q.includes('投资') || q.includes('生意')) {
    liuyaoYongShen = '妻财';
  } else if (q.includes('官') || q.includes('工作') || q.includes('事业') || q.includes('升职')) {
    liuyaoYongShen = '官鬼';
  } else if (q.includes('学') || q.includes('考') || q.includes('证书') || q.includes('文书')) {
    liuyaoYongShen = '父母';
  } else if (q.includes('子') || q.includes('孩') || q.includes('产') || q.includes('宠物')) {
    liuyaoYongShen = '子孙';
  } else if (q.includes('友') || q.includes('合伙') || q.includes('竞争')) {
    liuyaoYongShen = '兄弟';
  } else if (q.includes('病') || q.includes('健康') || q.includes('医') || q.includes('药')) {
    liuyaoYongShen = '官鬼'; // 官鬼为病，子孙为医药
  } else if (q.includes('出行') || q.includes('旅行') || q.includes('出远门') || q.includes('搬家') || q.includes('迁移')) {
    liuyaoYongShen = '父母'; // 父母为行李、交通工具
  } else if (q.includes('失物') || q.includes('丢') || q.includes('找') || q.includes('寻')) {
    liuyaoYongShen = '妻财'; // 失物以妻财为用（物品属财）
  } else if (q.includes('官司') || q.includes('诉讼') || q.includes('纠纷') || q.includes('矛盾')) {
    liuyaoYongShen = '官鬼'; // 官鬼为官非、诉讼
  } else if (q.includes('婚') || q.includes('嫁') || q.includes('娶') || q.includes('感情') || q.includes('对象') || q.includes('恋爱')) {
    liuyaoYongShen = '妻财'; // 男问妻财，女问官鬼（此处简化取妻财）
  } else if (q.includes('房') || q.includes('屋') || q.includes('宅') || q.includes('地') || q.includes('装修')) {
    liuyaoYongShen = '父母'; // 父母为房屋、庇护
  } else {
    // 默认：问运势看官鬼（事业）
    liuyaoYongShen = '官鬼';
  }

  // 六爻用神五行（从卦中找用神爻的五行）
  let liuyaoYongShenWx = '';
  if (liuyao?.yaoList) {
    const yongYao = liuyao.yaoList.find(y => y.liuqin === liuyaoYongShen);
    if (yongYao) liuyaoYongShenWx = yongYao.wuxing;
  }

  // ===== 3. 用神一致性判断 =====
  result.yongShen = {
    bazi: { target: baziYongShen, reason: `日主${dayGan}属${dayWx}，${wangShuai === '身强' ? '身强喜克泄' : '身弱喜生扶'}，用神为${baziYongShen}` },
    liuyao: { target: liuyaoYongShen, wuxing: liuyaoYongShenWx, reason: `问"${question}"，六爻取${liuyaoYongShen}为用神` }
  };

  // 八字用神五行 vs 六爻用神五行是否一致
  const yongShenMatch = baziYongShen && liuyaoYongShenWx && (
    baziYongShen === liuyaoYongShenWx ||
    SHENG[baziYongShen] === liuyaoYongShenWx || // 用神相生
    SHENG[liuyaoYongShenWx] === baziYongShen
  );
  result.yongShen.consistent = yongShenMatch;
  if (!yongShenMatch && baziYongShen && liuyaoYongShenWx) {
    result.conflicts.push(`用神不一致：八字用神五行${baziYongShen}，六爻用神${liuyaoYongShen}五行${liuyaoYongShenWx}，方向不同`);
  }

  // ===== 4. 吉凶方向提取 =====
  // 八字方向（基于旺衰+喜忌）
  let baziDirection = '中';
  if (bazi?.wangShuai && bazi?.liuNian) {
    const lnZhi = bazi.liuNian.ganZhi?.[1];
    const lnWx = DZ_WX[lnZhi];
    if (wangShuai === '身强') {
      // 身强喜克泄，流年克/泄日主为吉
      if (KE[dayWx] === lnWx || SHENG[dayWx] === lnWx) baziDirection = '吉';
      else if (lnWx === dayWx || SHENGED[dayWx] === lnWx) baziDirection = '凶';
    } else {
      // 身弱喜生扶，流年生/扶日主为吉
      if (SHENGED[dayWx] === lnWx || lnWx === dayWx) baziDirection = '吉';
      // 身弱忌克泄耗：官杀（克我）、食伤（泄）、财（耗）
      else if (KEED[dayWx] === lnWx || SHENG[dayWx] === lnWx || KE[dayWx] === lnWx) baziDirection = '凶';
    }
  }

  // 紫微方向（综合三方四正密度 + 主星 + 四化加权打分）
  let ziweiDirection = '中';
  if (ziwei?.mingGong?.stars) {
    const jiStars = ['紫微','天府','太阳','太阴','天同','天梁','左辅','右弼','文昌','文曲','天魁','天钺'];
    const xiongStars = ['擎羊','陀罗','火星','铃星','地空','地劫'];
    // 1) 三方四正密度(若 palaces 可用):吉星 +2/颗,煞星 -3/颗
    let sifangScore = 0;
    if (ziwei.palaces && Array.isArray(ziwei.palaces)) {
      const mingIdx = ziwei.palaces.findIndex(p => p.isMing);
      if (mingIdx >= 0) {
        const oppIdx = (mingIdx + 6) % 12;
        const triIdx1 = (mingIdx + 4) % 12;
        const triIdx2 = (mingIdx + 8) % 12;
        const sifang = [ziwei.palaces[mingIdx], ziwei.palaces[oppIdx], ziwei.palaces[triIdx1], ziwei.palaces[triIdx2]];
        const allStars = sifang.flatMap(p => (p.stars || []).map(s => s.name));
        const jiC = allStars.filter(s => jiStars.includes(s)).length;
        const xiongC = allStars.filter(s => xiongStars.includes(s)).length;
        sifangScore = jiC * 2 - xiongC * 3;
      }
    }
    // 2) 命宫主星 fallback(若 palaces 不可用,至少看命宫)
    if (sifangScore === 0) {
      const mainStars = ziwei.mingGong.stars.filter(s => s.type === 'main').map(s => s.name);
      const jiC = mainStars.filter(s => jiStars.includes(s)).length;
      const xiongC = mainStars.filter(s => xiongStars.includes(s)).length;
      sifangScore = jiC * 2 - xiongC * 3;
    }
    // 3) 四化加权:禄/权/科 +2,忌 -2
    let siHuaScore = 0;
    if (ziwei.siHua && typeof ziwei.siHua === 'object') {
      for (const k of Object.keys(ziwei.siHua)) {
        if (k === '化禄' || k === '化权' || k === '化科') siHuaScore += 2;
        else if (k === '化忌') siHuaScore -= 2;
      }
    }
    // 4) 综合判定:总得分 ≥ 4 吉,≤ -4 凶,其余中
    const totalScore = sifangScore + siHuaScore;
    if (totalScore >= 4) ziweiDirection = '吉';
    else if (totalScore <= -4) ziweiDirection = '凶';
  }

  // 六爻方向（基于用神旺衰+世应关系）
  let liuyaoDirection = '中';
  if (liuyao?.yaoList && liuyao?.timeGanzhi) {
    const monthZhi = liuyao.timeGanzhi.month[1];
    const zhiMain = { '寅':'木','卯':'木','巳':'火','午':'火','申':'金','酉':'金','亥':'水','子':'水','辰':'土','戌':'土','丑':'土','未':'土' };
    const monthMain = zhiMain[monthZhi];
    const yongYao = liuyao.yaoList.find(y => y.liuqin === liuyaoYongShen);
    if (yongYao) {
      if (yongYao.wuxing === monthMain) liuyaoDirection = '吉';
      else if (SHENGED[yongYao.wuxing] === monthMain) liuyaoDirection = '吉';
      else if (KE[yongYao.wuxing] === monthMain) liuyaoDirection = '凶';
    }
    // 世应生克关系
    const cvShortName = GUA_FULL_TO_SHORT[liuyao.gua.name] || (liuyao.gua.name && liuyao.gua.name[0]) || liuyao.gua.name;
    const cvSY = SHI_YING[cvShortName] || {};
    const shiYao = liuyao.yaoList[cvSY.shi - 1];
    const yingYao = liuyao.yaoList[cvSY.ying - 1];
    if (shiYao && yingYao && SHENG[shiYao.wuxing] === yingYao.wuxing) {
      // 世生应，我生对方，对我不利
      if (liuyaoDirection === '吉') liuyaoDirection = '中';
    }
  }

  result.direction = {
    bazi: baziDirection,
    ziwei: ziweiDirection,
    liuyao: liuyaoDirection
  };

  // ===== 5. 方向一致性判断 =====
  const directions = [baziDirection, ziweiDirection, liuyaoDirection];
  const jiCount = directions.filter(d => d === '吉').length;
  const xiongCount = directions.filter(d => d === '凶').length;
  const zhongCount = directions.filter(d => d === '中').length;

  if (jiCount === 3) {
    result.direction.overall = '大吉';
    result.direction.agreement = 100;
  } else if (xiongCount === 3) {
    result.direction.overall = '大凶';
    result.direction.agreement = 100;
  } else if (jiCount >= 2) {
    result.direction.overall = '偏吉';
    result.direction.agreement = 67;
  } else if (xiongCount >= 2) {
    result.direction.overall = '偏凶';
    result.direction.agreement = 67;
  } else {
    result.direction.overall = '吉凶参半';
    result.direction.agreement = 33;
  }

  // 矛盾检测
  if (jiCount > 0 && xiongCount > 0) {
    const jiDomains = [];
    if (baziDirection === '吉') jiDomains.push('八字');
    if (ziweiDirection === '吉') jiDomains.push('紫微');
    if (liuyaoDirection === '吉') jiDomains.push('六爻');
    const xiongDomains = [];
    if (baziDirection === '凶') xiongDomains.push('八字');
    if (ziweiDirection === '凶') xiongDomains.push('紫微');
    if (liuyaoDirection === '凶') xiongDomains.push('六爻');
    result.conflicts.push(`方向分歧：${jiDomains.join('+')}示吉，${xiongDomains.join('+')}示凶。可能原因：八字看长期格局，六爻看短期事件，紫微看十年大运，时点不同导致结论差异。`);
  }

  // ===== 6. 综合置信度 =====
  let confidenceScore = result.direction.agreement;
  // 用神一致加分
  if (yongShenMatch) confidenceScore += 10;
  // 矛盾减分
  confidenceScore -= result.conflicts.length * 10;
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  result.confidence = {
    overall: confidenceScore >= 80 ? '高' : confidenceScore >= 50 ? '中' : '低',
    score: confidenceScore,
    breakdown: `方向一致度${result.direction.agreement}% + 用神匹配${yongShenMatch ? 10 : 0} - 矛盾${result.conflicts.length * 10}`
  };

  // ===== 7. 格式化输出（注入 Prompt） =====
  const lines = ['【三术交叉验证·代码层确定事实】'];
  lines.push(`问题：${question || '未指定'}`);
  lines.push(`八字用神：${baziYongShen || '未确定'}（${result.yongShen.bazi.reason}）`);
  lines.push(`六爻用神：${liuyaoYongShen}（${liuyaoYongShenWx || '?'}）（${result.yongShen.liuyao.reason}）`);
  lines.push(`用神一致性：${yongShenMatch ? '✓ 方向一致' : '✗ 方向不同，需分别解读'}`);
  lines.push(`吉凶方向：八字${baziDirection} · 紫微${ziweiDirection} · 六爻${liuyaoDirection} → 综合${result.direction.overall}`);
  lines.push(`一致度：${result.direction.agreement}%`);
  lines.push(`置信度：${result.confidence.overall}（${confidenceScore}分）`);
  if (result.conflicts.length > 0) {
    lines.push('【矛盾点】');
    for (const c of result.conflicts) lines.push(`⚠ ${c}`);
  }
  lines.push('【解读要求】基于上述交叉验证事实，给每条结论标注：八字/紫微/六爻 几术支持。矛盾处优先采用高置信度结论。');

  result.formatted = lines.join('\n') + '\n';
  return result;
};
// 暴露到 globalThis(最后加载, 包含所有 Expert.xxx 赋值)
if (typeof window !== 'undefined') window.Expert = Expert;
if (typeof globalThis !== 'undefined') globalThis.Expert = Expert;
