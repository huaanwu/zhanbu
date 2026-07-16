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
  } else if (domain === 'qimen' && pan.gong9) {
    signals.push(pan.jushu_text);
    if (pan.zhishi) signals.push('直使' + pan.zhishi.men);
    const zhifuGong = pan.gong9.find(g => g.is_tianpan_zhifu);
    if (zhifuGong) signals.push('直符宫' + zhifuGong.name);
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

    // 4. 奇门（如选中）
    let qmPan = null;
    if (cxState.modules.includes('qimen')) {
      if (!window.qimen) throw new Error('奇门库加载中，请稍后');
      qmPan = window.qimen.panQimen(year, month, day, hour, 0);
      if (!qmPan || !qmPan.gong9) throw new Error('奇门排盘失败');
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

    // 奇门摘要（仅当选中）
    const qmSig = qmPan ? extractSignals(qmPan, 'qimen') : [];
    if (cxState.modules.includes('qimen') && qmPan) {
      html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
        <div style="color:var(--accent-gold);">🔮 奇门：${qmPan.jushu_text} · ${qmPan.jieqi}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
          直符宫：${qmSig.find(s=>s.includes('直符宫'))||'-'} · 直使：${qmSig.find(s=>s.includes('直使'))||'-'} · 信号：${qmSig.join('、')}
        </div>
      </div>`;
    }

    result.innerHTML = html;

    currentCross = { bazi: baziPan, ziwei: ziweiPan, liuyao: lyPan, qimen: qmPan, question, modules: cxState.modules, signals: { bazi: baziSig, ziwei: zwSig, liuyao: lySig, qimen: qmSig } };
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

  if (mods.includes('qimen') && c.qimen) {
    s += `【奇门盘】\n`;
    s += `局数：${c.qimen.jushu_text} · 节气：${c.qimen.jieqi}\n`;
    s += `直使：${c.qimen.zhishi ? c.qimen.zhishi.men + ' → ' + c.qimen.zhishi.gong : '无'}\n`;
    s += `奇门信号：${(c.signals.qimen || []).join('、')}\n\n`;
  }

  s += `【请按"多维联合"模式解读】\n`;
  s += `1. 提取各盘关键信号（旺相/动爻/格局/四化/用神/奇门值符值使）\n`;
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
  const KB = window.Core?.KB || {};
  const mods = (currentCross && currentCross.modules) || ['bazi', 'ziwei', 'liuyao'];
  for (const m of mods) {
    if (KB.loadPrimaryKbs) await KB.loadPrimaryKbs(m);
    if (KB.loadExtendedKbsByQuestion) await KB.loadExtendedKbsByQuestion(m, currentCross.question);
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
  const moduleNames = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门' };
  if (!prefix) text.textContent = `⏳ 正在综合${mods.map(m=>moduleNames[m]||m).join('+')}多维联合解读...\n`;

  let fullText = `⏳ 正在综合${mods.map(m=>moduleNames[m]||m).join('+')}多维联合解读...\n`;
  try {
    // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    // cross 特殊:buildSystemPrompt 自动调 Expert.bazi/ziwei/liuyao + crossValidate + kbDaoism
    const system = Core.AI.buildSystemPrompt({ domain: 'cross', pan: currentCross, question: currentCross.question });

    // v3.0.5: 统一 AI 入口(任务 #19)— 三术同参用完整 currentCross 作为 cache key 与 Expert 输入
    const { finalText: outFinal } = await Core.AI.interpret({
      domain: 'cross',
      prompt: currentCrossPrompt,
      system,
      pan: currentCross,
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
