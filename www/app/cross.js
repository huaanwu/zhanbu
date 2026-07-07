// ========== 三术同参（八字+紫微+六爻） ==========
let cxGender = 'male';
let cxCal = 'solar', cxLeap = false;
let cxState = { cal: 'solar', leap: false, gender: 'male', modules: ['bazi', 'ziwei', 'liuyao'] };
function selCxGender(btn) { document.querySelectorAll('#pageCross [data-gender]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); cxGender = btn.dataset.gender; cxState.gender = cxGender; }

// v1.3.1 三术同参多选：模块选择
function selCxModule(btn) {
  btn.classList.toggle('active');
  const selected = Array.from(document.querySelectorAll('#pageCross [data-cxmod].active')).map(b => b.dataset.cxmod);
  cxState.modules = selected;
}
window.selCxModule = selCxModule;
function selCxCal(btn) {
  document.querySelectorAll('#pageCross [data-cal]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cxCal = btn.dataset.cal; cxState.cal = cxCal;
  document.getElementById('cxLeapWrap').style.display = cxCal === 'lunar' ? 'block' : 'none';
}
function selCxLeap(btn) {
  document.querySelectorAll('#pageCross [data-leap]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cxLeap = btn.dataset.leap === 'true'; cxState.leap = cxLeap;
}
window.selCxGender = selCxGender;
window.selCxCal = selCxCal;
window.selCxLeap = selCxLeap;

// currentCross已在上方声明
// let currentCross = null, currentCrossPrompt = '';

// 三盘信号词提取（用于让 AI 找共性）
function extractSignals(pan, domain) {
  const signals = [];
  if (domain === 'bazi' && pan.gz) {
    const wx = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' }[pan.gz.day[0]];
    signals.push(pan.gz.day[0] + wx); // 日主五行
    if (pan.tenGods) {
      const gods = new Set();
      Object.values(pan.tenGods).forEach(v => v && ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'].forEach(g => v.includes(g) && gods.add(g)));
      signals.push([...gods].join(','));
    }
  } else if (domain === 'ziwei' && pan.mingGong) {
    pan.mingGong.stars?.forEach(s => s.type === 'main' && signals.push(s.name));
  } else if (domain === 'liuyao' && pan.yaoList) {
    const dong = pan.yaoList.filter(y => y.isDong);
    signals.push(pan.gua.name);
    if (dong.length > 0) {
      signals.push('动' + dong[0].liuqin);
    }
    const cai = pan.yaoList.find(y => y.liuqin === '妻财');
    if (cai) signals.push('财在' + cai.name + '(' + (cai.isDong ? '动' : '静') + ')');
  }
  return signals;
}

function doCross() {
  const year = +document.getElementById('cxYear').value;
  const month = +document.getElementById('cxMonth').value;
  const day = +document.getElementById('cxDay').value;
  const hour = +document.getElementById('cxHour').value;
  const question = document.getElementById('cxQuestion').value || '问近期运势';
  const gender = cxGender;
  if (!year || year < 1900 || year > 2030) { showToast('请输入有效年份(1900-2030)', 'error'); return; }
  if (!month || month < 1 || month > 12) { showToast('请输入有效月份(1-12)', 'error'); return; }
  if (!day || day < 1 || day > 31) { showToast('请输入有效日期(1-31)', 'error'); return; }
  if (hour < 0 || hour > 23) { showToast('请输入有效小时(0-23)', 'error'); return; }

  const result = document.getElementById('cxResult');
  result.style.display = 'block';
  result.innerHTML = '<div class="loading">三术同参排盘中...</div>';

  try {
    // 1. 八字（支持农历+闰月）
    let solar;
    if (cxCal === 'lunar') {
      // lunar-javascript 1.6.x：闰月用负数月表示，如 2017 闰六月 = -6
      // isLeapMonth 参数 = true 时表示闰月（不论 month 是正负，true 才是闰月）
      const lunar = window.Lunar.fromYmd(year, month, day, cxLeap);
      solar = lunar.getSolar();
    } else {
      solar = window.Solar.fromYmd(year, month, day);
    }
    const gz = getBaziPan(solar, gender);
    if (!gz || !gz.day || gz.day.length < 2) {
      throw new Error(`八字排盘失败：日柱未生成（请检查日期是否有效）`);
    }
    const tg = gz.day[0];
    const tenGods = calcTenGods(tg, gz);
    const wangShuai = judgeWangShuai(tg, gz);
    const baziPan = { solar, gz, tenGods, gender, question, wangShuai };

    // 2. 紫微（小时转地支序号）
    const zhiIdx = Math.floor((hour + 1) / 2) % 12;
    let chart;
    if (cxCal === 'lunar') {
      // iztro 1.x 闰月参数：第四个参数 true=闰月
      chart = window.iztroAstro.byLunar(`${year}-${month}-${day}`, zhiIdx, gender, cxLeap, true, 'zh-CN');
    } else {
      chart = window.iztroAstro.bySolar(`${year}-${month}-${day}`, zhiIdx, gender, true, 'zh-CN');
    }
    if (!chart || !chart.palaces) throw new Error('紫微排盘失败：命盘未生成');
    const ziweiPan = adaptZiwei(chart);

    // 3. 六爻（用当前时刻起卦，时间起卦）
    const lyDt = new Date(year, month - 1, day, hour);
    if (isNaN(lyDt.getTime())) throw new Error('日期无效，无法起六爻');
    const lyPan = window.liuyao.panGua('time', { dt: lyDt });
    if (!lyPan || !lyPan.gua || !lyPan.yaoList || lyPan.yaoList.length !== 6) {
      throw new Error('六爻排盘失败');
    }

    // 渲染三盘
    const moduleNames = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门' };
    const moduleIcons = { bazi: '📅', ziwei: '⭐', liuyao: '☯', qimen: '🔮' };
    const selectedList = (cxState.modules || ['bazi', 'ziwei', 'liuyao']).map(m => moduleNames[m] || m).join(' + ');
    let html = `<h3 style="color:var(--accent-gold);">🔀 ${selectedList} 同参结果</h3>`;
    if (cxCal === 'lunar') {
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">⚠️ 已按${cxLeap ? '闰' : '非闰'}农历${year}年${month}月${day}日 → 公历${solar.toYmd()} 排盘</div>`;
    }

    // 八字摘要（仅当选中）
    const baziSig = extractSignals(baziPan, 'bazi');
    if (cxState.modules.includes('bazi')) {
      html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
        <div style="color:var(--accent-gold);">📅 八字：${gz.year} ${gz.month} ${gz.day} ${gz.hour}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
          旺衰：${wangShuai === '身强' ? '<span style="color:var(--accent-green)">身强</span>' : '<span style="color:var(--accent-red)">身弱</span>'}
          · 信号：${baziSig.join('、')}
        </div>
      </div>`;
    }

    // 紫微摘要（仅当选中）
    const zwSig = extractSignals(ziweiPan, 'ziwei');
    if (cxState.modules.includes('ziwei')) {
      const mainStars = ziweiPan.mingGong.stars?.filter(s => s.type === 'main').map(s => s.name).join('、') || '无';
      html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
        <div style="color:var(--accent-gold);">⭐ 紫微：命宫在${ziweiPan.mingGong.name}（${ziweiPan.mingGong.ganzhi}）</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
          主星：${mainStars} · 信号：${zwSig.join('、')}
        </div>
      </div>`;
    }

    // 六爻摘要（仅当选中）
    const lySig = extractSignals(lyPan, 'liuyao');
    if (cxState.modules.includes('liuyao')) {
      const dongList = lyPan.gua.dongYaoList || [];
      html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
        <div style="color:var(--accent-gold);">☯ 六爻：${lyPan.gua.name} ${dongList.length > 0 ? '动第' + dongList.join('、') + '爻' : '静卦'}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
          信号：${lySig.join('、')}
        </div>
      </div>`;
    }

    result.innerHTML = html;

    currentCross = { bazi: baziPan, ziwei: ziweiPan, liuyao: lyPan, qimen: null, question, modules: cxState.modules, signals: { bazi: baziSig, ziwei: zwSig, liuyao: lySig } };
    currentCrossPrompt = buildCrossPrompt(currentCross);

    document.getElementById('cxAI').style.display = 'block';
    document.getElementById('cxAIBtn').style.display = 'inline-block';
    document.getElementById('cxAILoading').style.display = 'none';
    document.getElementById('cxAIText').style.display = 'none';
  } catch (e) {
    result.innerHTML = `<div class="error">排盘失败: ${escapeHtml(e.message)}</div>`;
  }
}
window.doCross = doCross;

function buildCrossPrompt(c) {
  const mods = c.modules || ['bazi', 'ziwei', 'liuyao'];
  const moduleNames = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门' };
  const selectedNames = mods.map(m => moduleNames[m] || m).join(' + ');
  let s = `=== ${selectedNames} 多维联合排盘（v1.3.1）===\n`;
  s += `问题：${c.question}\n`;
  s += `生辰：${c.bazi.gz.year} ${c.bazi.gz.month} ${c.bazi.gz.day} ${c.bazi.gz.hour}\n`;
  s += `性别：${c.bazi.gender === 'male' ? '男' : '女'}\n\n`;

  if (mods.includes('bazi') && c.bazi) {
    s += `【八字盘】\n`;
    s += `四柱：${c.bazi.gz.year} ${c.bazi.gz.month} ${c.bazi.gz.day} ${c.bazi.gz.hour}\n`;
    s += `日主：${c.bazi.gz.day[0]}（${c.signals.bazi[0]||''}） 旺衰：${c.bazi.wangShuai || '?'}\n`;
    s += `十神信号：${c.signals.bazi.join('、')}\n\n`;
  }

  if (mods.includes('ziwei') && c.ziwei) {
    s += `【紫微盘】\n`;
    s += `命宫：${c.ziwei.mingGong.name}（${c.ziwei.mingGong.ganzhi}）\n`;
    s += `主星：${c.ziwei.mingGong.stars?.filter(s=>s.type==='main').map(s=>s.name).join('、')||'无'}\n`;
    s += `四化：${Object.entries(c.ziwei.siHua||{}).map(([k,v])=>v+k).join(' ') || '无'}\n\n`;
  }

  if (mods.includes('liuyao') && c.liuyao) {
    s += `【六爻盘】\n`;
    s += `卦名：${c.liuyao.gua.name}\n`;
    s += `动爻：${(c.liuyao.gua.dongYaoList||[]).length > 0 ? '第' + c.liuyao.gua.dongYaoList.join('、') + '爻' : '无'}\n`;
    s += `六亲信号：${c.signals.liuyao.join('、')}\n\n`;
  }

  s += `【请按"多维联合"模式解读】\n`;
  s += `1. 提取各盘关键信号（旺相/动爻/格局/四化/用神）\n`;
  s += `2. 比较各盘对同一问题的方向（吉/凶/中）\n`;
  s += `3. 一致处为高置信结论（${mods.length} 术中 ${mods.length} 术一致=高/${Math.ceil(mods.length*0.6)} 术一致=中/其他=低）\n`;
  s += `4. 矛盾处需特别说明（哪术为什么判断不同）\n`;
  s += `5. 给出综合判断及具体建议\n`;
  s += `6. 总结：${mods.length} 术整体倾向（吉/中/凶）\n`;
  return s;
}

async function doAICross() {
  if (!currentCrossPrompt || !currentCross || !currentCross.bazi) {
    showToast('请先进行三术排盘', 'error');
    return;
  }
  await ensureKB();
  // v1.3.1 按选中模块加载 primary KB
  const mods = (currentCross && currentCross.modules) || ['bazi', 'ziwei', 'liuyao'];
  for (const m of mods) {
    await loadPrimaryKbs(m);
    await loadExtendedKbsByQuestion(m, currentCross.question);
  }
  await window.RAG.build();
  const btn = document.getElementById('cxAIBtn');
  const loading = document.getElementById('cxAILoading');
  const text = document.getElementById('cxAIText');
  btn.disabled = true; btn.textContent = '综合中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentCross.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '⏳ 正在综合八字+紫微+六爻三术...\n';

  let fullText = '⏳ 正在综合八字+紫微+六爻三术...\n';
  try {
    const factsBazi = window.Expert.bazi(currentCross.bazi);
    const factsLiu = window.Expert.liuyao(currentCross.liuyao);
    const factsZiwei = window.Expert.ziwei(currentCross.ziwei);
    // 交叉验证（代码层面确定三术一致性）
    const crossCheck = window.Expert.crossValidate ? window.Expert.crossValidate(currentCross) : null;
    const abCfg = getActiveABConfig();
    // cross 检索 3 个事实模块,默认 maxChars 更小以避免 prompt 爆炸
    const crossMaxChars = Math.min(abCfg.maxChars, 2000);
    const ragContent = window.RAG.search(currentCross.bazi, currentCross.question, {
      topK: Math.min(abCfg.topK, 8),
      maxChars: crossMaxChars
    });
    const historyPrompt = getSimilarHistoryPrompt('cross', currentCross.bazi.gz.day, currentCross.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('cross') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('cross', currentCross.question) : '';
    const system = '【三术同参原则】\n'
      + '1. 三术皆属同一人生轨迹的"不同投影"，不应有本质矛盾\n'
      + '2. 一致结论置信度高，可作主要建议\n'
      + '3. 矛盾时需分析是排盘差异还是时点差异，不轻易否定\n'
      + '4. 给每条结论标注：八字+紫微+六爻 三/二/一 术支持\n'
      + '5. 优先采信交叉验证中"高置信度"结论\n'
      + '6. 用神一致时结论更可靠，用神不一致时需分别说明各术视角\n\n'
      + (crossCheck?.formatted || '')
      + '\n'
      + (factsBazi ? '【八字事实·100%准确】\n' + factsBazi + '\n' : '')
      + (factsZiwei ? '【紫微事实·100%准确】\n' + factsZiwei + '\n' : '')
      + (factsLiu ? '【六爻事实·100%准确】\n' + factsLiu + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbDaoismBuddhismOnDemand(currentCross.question)
      + '\n\n'
      + (function() {
          let instruction = '';
          if (abCfg.useChainOfThought) instruction += window.Expert.chainOfThought('三术同参');
          if (abCfg.useFewshot)         instruction += (instruction ? '\n\n' : '') + window.Expert.fewshot('三术同参');
          return instruction;
        })();

    // 引导用户问题转化为三术共同关心的方向
    // v3.0.5: 统一 AI 入口(任务 #19)— 三术同参用 crossParams 作为 cache key
    const { finalText: outFinal } = await Core.AI.interpret({
      domain: 'cross',
      prompt: currentCrossPrompt,
      system,
      pan: { bazi: currentCross.bazi, liuyao: currentCross.liuyao },
      question: currentCross.question,
      contentEl: text,
      prefix,
      separator,
    });
    saveHistory('cross', currentCross.bazi.gz.day, currentCross.question, outFinal);
    addFeedbackUI('cross', text, outFinal, currentCrossPrompt, system);
    showResultActions('cxAIText', 'cxAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error">综合解读失败: ' + escapeHtml(e.message) + '</div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 综合解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAICross = doAICross;
