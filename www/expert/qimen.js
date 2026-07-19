/**
 * 奇门专家系统 v1.0
 * --------------------------------------------------
 * 输入: pan = qimen.panQimen() 输出
 * 输出: 【事实·...】格式事实清单
 *
 * 自包含: 不依赖 expert/tables.js
 */

Expert.qimen = function(pan) {
  const facts = [];
  facts.push(`【事实·局数】${pan.jushu_text}（${pan.jieqi}节气，已过${pan.days_in_jq}天）`);
  facts.push(`【事实·四柱】${pan.bazi.join(' ')}`);
  facts.push(`【事实·旬首】${pan.xunshou}`);

  // 值符值使（深化版）
  if (pan.gong9) {
    const zf = pan.gong9.find(g => g.is_dipan_zhifu);
    const zs = pan.gong9.find(g => g.is_renpan_zhishi);

    // 值符深化：值符落宫状态 + 天乙（值符星）
    if (zf) {
      facts.push(`【事实·值符】地盘值符在${zf.name}（${zf.dipan}）`);
      // 值符星（天乙贵人）
      if (zf.jiuxing) {
        facts.push(`【事实·值符星】天乙${zf.jiuxing}临${zf.name}，主事体性质${zf.jiuxing === '天蓬' ? '隐密' : zf.jiuxing === '天任' ? '稳重' : zf.jiuxing === '天冲' ? '冲动' : zf.jiuxing === '天辅' ? '文雅' : zf.jiuxing === '天英' ? '虚华' : zf.jiuxing === '天芮' ? '病疾' : zf.jiuxing === '天柱' ? '破坏' : zf.jiuxing === '天心' ? '医道' : ''}`);
      }
      // 值符所落宫位的五行状态（宫生/克/比和值符）
      const GONG_WX = { '坎一宫':'水','坤二宫':'土','震三宫':'木','巽四宫':'木','中五宫':'土','乾六宫':'金','兑七宫':'金','艮八宫':'土','离九宫':'火' };
      const XING_WX = { '天蓬':'水','天任':'土','天冲':'木','天辅':'木','天英':'火','天芮':'土','天柱':'金','天心':'金','天禽':'土' };
      // 寄宫时 jiuxing 可能为 "天心 天禽" 双星, 取任一匹配
      const xingName = (zf.jiuxing || '').split(/\s+/).find(n => XING_WX[n]) || '';
      const gongWx = GONG_WX[zf.name];
      const xingWx = XING_WX[xingName];
      const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
      const KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
      if (gongWx && xingWx) {
        if (gongWx === xingWx) facts.push(`【事实·值符宫星】${zf.name}属${gongWx}，值符星${xingName}属${xingWx}，宫星比和，值符有力`);
        else if (SHENG[gongWx] === xingWx) facts.push(`【事实·值符宫星】宫${gongWx}生星${xingWx}，值符得宫生助，事体有根基`);
        else if (KE[gongWx] === xingWx) facts.push(`【事实·值符宫星】宫${gongWx}克星${xingWx}，值符受宫压制，事体有阻`);
        else if (SHENG[xingWx] === gongWx) facts.push(`【事实·值符宫星】星${xingWx}生宫${gongWx}，值符泄气于宫，事体费力`);
        else facts.push(`【事实·值符宫星】星${xingWx}克宫${gongWx}，值符主动，事体有变`);
      }
    }

    // 值使深化：运行阶段 + 宫位状态 + 与值符关系 + 门迫/受制
    if (zs) {
      const step = zs.zhishi_step != null ? zs.zhishi_step : 0;
      let stage = '';
      if (step === 0) stage = '起点，事情刚启动';
      else if (step <= 2) stage = '初期，正在发展';
      else if (step <= 5) stage = '中期，关键阶段';
      else stage = '后期，接近尾声';
      facts.push(`【事实·值使】人盘值使${zs.renpan}在${zs.name}（${pan.yang_dun ? '阳遁顺行' : '阴遁逆行'}第${step}步，${stage}）`);

      // 值使门与值符的关系（同宫/相生/相克）
      if (zf && zs) {
        const MEN_WX = { '开门':'金','休门':'水','生门':'土','伤门':'木','杜门':'木','景门':'火','死门':'土','惊门':'金' };
        const GONG_WX = { '坎一宫':'水','坤二宫':'土','震三宫':'木','巽四宫':'木','中五宫':'土','乾六宫':'金','兑七宫':'金','艮八宫':'土','离九宫':'火' };
        const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
        const KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
        const menWx = MEN_WX[zs.renpan];
        const zfGongWx = GONG_WX[zf.name];
        const zsGongWx = GONG_WX[zs.name];

        // 值使门落宫状态
        if (menWx && zsGongWx) {
          if (zsGongWx === menWx) facts.push(`【事实·值使宫门】值使${zs.renpan}属${menWx}，落${zs.name}属${zsGongWx}，宫门比和，值使有力`);
          else if (SHENG[zsGongWx] === menWx) facts.push(`【事实·值使宫门】宫${zsGongWx}生门${menWx}，值使得宫生助，执行顺畅`);
          else if (KE[zsGongWx] === menWx) facts.push(`【事实·值使宫门】宫${zsGongWx}克门${menWx}，值使受宫压制（门迫），执行受阻`);
          else if (SHENG[menWx] === zsGongWx) facts.push(`【事实·值使宫门】门${menWx}生宫${zsGongWx}，值使泄气，执行费力`);
          else facts.push(`【事实·值使宫门】门${menWx}克宫${zsGongWx}，值使主动，执行有变`);
        }

        // 值符与值使宫位关系
        if (zf.name === zs.name) {
          facts.push(`【事实·符使同宫】值符值使同落${zf.name}，符使同心，事体统一，效率最高`);
        } else if (zfGongWx && zsGongWx) {
          if (SHENG[zfGongWx] === zsGongWx) facts.push(`【事实·符使关系】值符宫${zfGongWx}生值使宫${zsGongWx}，上级支持下级，执行有助力`);
          else if (KE[zfGongWx] === zsGongWx) facts.push(`【事实·符使关系】值符宫${zfGongWx}克值使宫${zsGongWx}，上级约束下级，执行受管制`);
          else if (SHENG[zsGongWx] === zfGongWx) facts.push(`【事实·符使关系】值使宫${zsGongWx}生值符宫${zfGongWx}，下级回报上级，执行有回馈`);
          else if (KE[zsGongWx] === zfGongWx) facts.push(`【事实·符使关系】值使宫${zsGongWx}克值符宫${zfGongWx}，下级对抗上级，执行有抵触`);
        }

        // 值使门是否临凶格/吉格
        if (zs.tianpan && zs.dipan) {
          const tp = zs.tianpan, dp = zs.dipan;
          if (tp === '戊' && dp === '丙') facts.push(`【事实·值使吉格】值使临青龙返首，执行大吉`);
          if (tp === '丙' && dp === '戊') facts.push(`【事实·值使吉格】值使临飞鸟跌穴，执行顺畅`);
          if (tp === '辛' && dp === '乙') facts.push(`【事实·值使凶格】值使临白虎猖狂，执行凶险`);
          if (tp === '乙' && dp === '辛') facts.push(`【事实·值使凶格】值使临青龙逃走，执行失误`);
          if (tp === '庚') facts.push(`【事实·值使庚格】值使临庚，执行有阻力`);
        }
      }
    }

    // 生门/死门方位
    const sheng = pan.gong9.find(g => g.renpan === '生门');
    const si = pan.gong9.find(g => g.renpan === '死门');
    if (sheng) facts.push(`【事实·生门】生门在${sheng.name}（${sheng.direction}），主财位`);
    if (si) facts.push(`【事实·死门】死门在${si.name}（${si.direction}），主凶位`);

    // 【新增】吉格/凶格识别
    const jiGeList = [], xiongGeList = [];
    for (const g of pan.gong9) {
      const tianPan = g.tianpan; // 天盘
      const diPan = g.dipan;     // 地盘
      if (!tianPan || !diPan) continue;
      
      // 吉格检查
      if (tianPan === '戊' && diPan === '丙') jiGeList.push(`青龙返首（${g.name}）`);
      if (tianPan === '丙' && diPan === '戊') jiGeList.push(`飞鸟跌穴（${g.name}）`);
      if (tianPan === '乙' && diPan === '丙') jiGeList.push(`日月并行（${g.name}）`);
      if (tianPan === '丙' && diPan === '乙') jiGeList.push(`三奇得使（${g.name}）`);
      
      // 凶格检查
      if (tianPan === '辛' && diPan === '乙') xiongGeList.push(`白虎猖狂（${g.name}）`);
      if (tianPan === '乙' && diPan === '辛') xiongGeList.push(`青龙逃走（${g.name}）`);
      if (tianPan === '丁' && diPan === '癸') xiongGeList.push(`朱雀投江（${g.name}）`);
      if (tianPan === '癸' && diPan === '丁') xiongGeList.push(`螣蛇夭矫（${g.name}）`);
      if (tianPan === '丙' && diPan === '庚') xiongGeList.push(`荧惑入白（${g.name}）`);
      if (tianPan === '庚' && diPan === '丙') xiongGeList.push(`白入荧惑（${g.name}）`);
      if (tianPan === '庚') {
        // 庚加年/月/日/时干为悖格
        const yearGan = pan.bazi[0][0];
        const monthGan = pan.bazi[1][0];
        const dayGan = pan.bazi[2][0];
        const hourGan = pan.bazi[3][0];
        if (diPan === yearGan) xiongGeList.push(`岁悖格（${g.name}）`);
        if (diPan === monthGan) xiongGeList.push(`月悖格（${g.name}）`);
        if (diPan === dayGan) xiongGeList.push(`日悖格（${g.name}）`);
        if (diPan === hourGan) xiongGeList.push(`时悖格（${g.name}）`);
      }
    }
    
    if (jiGeList.length > 0) facts.push(`【事实·吉格】${jiGeList.join('、')}`);
    if (xiongGeList.length > 0) facts.push(`【事实·凶格】${xiongGeList.join('、')}`);
    
    // 【新增】门迫检查（门克宫）
    const MEN_WX = { '开门':'金','休门':'水','生门':'土','伤门':'木','杜门':'木','景门':'火','死门':'土','惊门':'金' };
    const GONG_WX = { '坎一宫':'水','坤二宫':'土','震三宫':'木','巽四宫':'木','中五宫':'土','乾六宫':'金','兑七宫':'金','艮八宫':'土','离九宫':'火' };
    const KE = { '金':'木','木':'土','土':'水','水':'火','火':'金' };
    const menPoList = [];
    for (const g of pan.gong9) {
      if (!g.renpan || !g.name) continue;
      const menWx = MEN_WX[g.renpan];
      const gongWx = GONG_WX[g.name];
      if (menWx && gongWx && KE[menWx] === gongWx) {
        menPoList.push(`${g.renpan}克${g.name}（${menWx}克${gongWx}）`);
      }
    }
    if (menPoList.length > 0) facts.push(`【事实·门迫】${menPoList.join('、')}—— 门克宫，力量受制`);
    
    // 【新增】入墓检查
    const RU_MU = { '乙':'乾六宫','丙':'乾六宫','丁':'艮八宫','戊':'乾六宫','己':'艮八宫','庚':'艮八宫','辛':'巽四宫','壬':'巽四宫','癸':'坤二宫' };
    const ruMuList = [];
    for (const g of pan.gong9) {
      if (!g.tianpan) continue;
      const muGong = RU_MU[g.tianpan];
      if (muGong && g.name === muGong) {
        ruMuList.push(`${g.tianpan}入墓于${g.name}`);
      }
    }
    if (ruMuList.length > 0) facts.push(`【事实·入墓】${ruMuList.join('、')}—— 力量潜藏不出`);
  }

  return facts.join('\n') + '\n';
};

