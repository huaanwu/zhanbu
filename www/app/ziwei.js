// ========== 紫微 ==========
async function doZiwei() {
  const btn = document.getElementById('zwBtn');
  btn.disabled = true; btn.textContent = '排盘中...';
  try {
    const year = +document.getElementById('zwYear').value;
    const month = +document.getElementById('zwMonth').value;
    const day = +document.getElementById('zwDay').value;
    const hour = +document.getElementById('zwHour').value;
    const gender = state.zw.gender;
    const question = document.getElementById('zwQuestion').value;

    if (!window.iztroAstro) { showToast('紫微库加载中，请稍后', 'error'); return; }

    let chart;
    if (state.zw.cal === 'lunar') {
      chart = window.iztroAstro.byLunar(`${year}-${month}-${day}`, hour, gender, state.zw.leap, true, 'zh-CN');
    } else {
      chart = window.iztroAstro.bySolar(`${year}-${month}-${day}`, hour, gender, true, 'zh-CN');
    }

    currentZw = adaptZiwei(chart, new Date());
    renderZiwei(currentZw);
    currentZwPrompt = buildZiweiPrompt(currentZw, question);
    document.getElementById('zwResult').classList.add('visible');
    document.getElementById('zwAI').style.display = 'block';
    document.getElementById('zwAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '排盘';
  }
}
window.doZiwei = doZiwei;

function adaptZiwei(chart, targetDate) {
  const palaces = [];
  const mingIdx = chart.palaces?.findIndex?.(p => p.name === '命宫') ?? -1;
  const shenIdx = chart.palaces?.findIndex?.(p => p.bodyPalace) ?? -1;

  if (chart.palaces) {
    for (const p of chart.palaces) {
      const stars = [];
      if (p.majorStars) for (const s of p.majorStars) stars.push({ name: s.name, type: 'main', brightness: s.brightness });
      if (p.minorStars) for (const s of p.minorStars) stars.push({ name: s.name, type: 'aux' });
      if (p.adjectiveStars) for (const s of p.adjectiveStars) stars.push({ name: s.name, type: 'adj' });
      palaces.push({
        name: p.name, ganzhi: (p.heavenlyStem||'')+(p.earthlyBranch||''),
        stars, isMing: p.name === '命宫', isShen: !!p.bodyPalace,
      });
    }
  }
  const siHua = {};
  // iztro v2+ 四化在星的 mutagen 属性上，chart 无 mutagen 数组
  // 从 chineseDate 取年干，用 iztro.util.getMutagensByHeavenlyStem 获取四化
  try {
    const yearlyStem = chart.chineseDate?.split(' ')[0]?.[0];
    if (yearlyStem && window.iztro?.util?.getMutagensByHeavenlyStem) {
      const mutagens = window.iztro.util.getMutagensByHeavenlyStem(yearlyStem);
      if (mutagens && mutagens.length === 4) {
        siHua['化禄'] = mutagens[0];
        siHua['化权'] = mutagens[1];
        siHua['化科'] = mutagens[2];
        siHua['化忌'] = mutagens[3];
      }
    }
  } catch (e) { console.warn('四化计算失败:', e); }
  // 兼容旧版 iztro（chart.mutagen 数组）
  if (Object.keys(siHua).length === 0 && chart.mutagen) {
    if (chart.mutagen[0]) siHua['化禄'] = chart.mutagen[0];
    if (chart.mutagen[1]) siHua['化权'] = chart.mutagen[1];
    if (chart.mutagen[2]) siHua['化科'] = chart.mutagen[2];
    if (chart.mutagen[3]) siHua['化忌'] = chart.mutagen[3];
  }
  // 大限流年排盘
  let horoscope = null;
  try {
    if (targetDate && chart.horoscope) {
      const hs = chart.horoscope(targetDate);
      if (hs) {
        horoscope = {
          decadal: hs.decadal ? {
            name: hs.decadal.name || '大限',
            palace: hs.decadal.palaceNames?.[0] || '',
            ganzhi: (hs.decadal.heavenlyStem || '') + (hs.decadal.earthlyBranch || ''),
            mutagen: hs.decadal.mutagen || [],
            ageRange: hs.decadal.range || []
          } : null,
          age: hs.age ? {
            nominalAge: hs.age.nominalAge,
            palace: hs.age.palaceNames?.[0] || '',
            ganzhi: (hs.age.heavenlyStem || '') + (hs.age.earthlyBranch || '')
          } : null,
          yearly: hs.yearly ? {
            name: hs.yearly.name || '流年',
            palace: hs.yearly.palaceNames?.[0] || '',
            ganzhi: (hs.yearly.heavenlyStem || '') + (hs.yearly.earthlyBranch || ''),
            mutagen: hs.yearly.mutagen || []
          } : null
        };
      }
    }
  } catch (e) { console.warn('大限流年排盘失败:', e); }

  return { mingGong: palaces[mingIdx] || {}, shenGong: palaces[shenIdx] || {}, palaces, siHua, horoscope };
}

function renderZiwei(chart) {
  let html = '<div class="result-title">紫微斗数命盘</div>';
  html += '<div style="display:flex;justify-content:center;gap:1rem;margin-bottom:0.8rem;font-size:0.8rem;color:var(--text-secondary);">';
  if (chart.mingGong.name) {
    const ms = chart.mingGong.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    html += `<span>命宫：<strong style="color:var(--accent-gold)">${chart.mingGong.name} ${chart.mingGong.ganzhi}</strong> ${ms}</span>`;
  }
  if (Object.keys(chart.siHua).length) {
    const h = Object.entries(chart.siHua).map(([k,v])=>`${v}${k}`).join(' ');
    html += `<span>四化：<strong style="color:var(--accent-gold)">${h}</strong></span>`;
  }
  // 大限流年信息
  if (chart.horoscope) {
    const hs = chart.horoscope;
    html += '<div style="display:flex;justify-content:center;gap:1rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--text-secondary);">';
    if (hs.decadal) html += `<span>大限：${hs.decadal.palace} ${hs.decadal.ganzhi}</span>`;
    if (hs.age) html += `<span>小限：${hs.age.nominalAge}岁 ${hs.age.palace}</span>`;
    if (hs.yearly) html += `<span>流年：${hs.yearly.palace} ${hs.yearly.ganzhi}</span>`;
    html += '</div>';
  }

  html += '<div class="palaces-grid">';
  for (const p of chart.palaces) {
    const cls = ['palace-card']; if (p.isMing) cls.push('ming');
    const mains = p.stars.filter(s=>s.type==='main').map(s=> s.name + (s.brightness?'('+s.brightness+')':'')).join(' ');
    const auxs = p.stars.filter(s=>s.type!=='main').map(s=>s.name).join(' ');
    html += `<div class="${cls.join(' ')}">`;
    html += `<div style="font-weight:600;color:var(--accent-gold-light);">${p.name}${p.isMing?'(命)':''}</div>`;
    html += `<div style="color:var(--text-muted);font-size:0.65rem;">${p.ganzhi}</div>`;
    if (mains) html += `<div style="color:var(--accent-gold);font-size:0.75rem;">${mains}</div>`;
    if (auxs) html += `<div style="color:var(--text-secondary);font-size:0.65rem;">${auxs}</div>`;
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('zwResult').innerHTML = html;
}

function buildZiweiPrompt(chart, question) {
  const now = new Date();
  let s = '=== 紫微斗数排盘 ===\n';
  s += `当前时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日\n`;
  if (chart.mingGong.name) {
    const ms = chart.mingGong.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    s += `命宫：${chart.mingGong.name}（${chart.mingGong.ganzhi}）${ms}\n`;
  }
  if (chart.shenGong.name) s += `身宫：${chart.shenGong.name}（${chart.shenGong.ganzhi}）\n`;
  if (Object.keys(chart.siHua).length) {
    s += '四化：' + Object.entries(chart.siHua).map(([k,v])=>`${v}${k}`).join(' ') + '\n';
  }
  s += '\n十二宫：\n';
  for (const p of chart.palaces) {
    const ms = p.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    s += `  ${p.name}（${p.ganzhi}）：${ms || '无主星'}\n`;
  }
  if (question) s += `\n所问之事：${question}\n`;
  s += '\n请根据以上紫微斗数命盘进行详细解读，重点分析当前流年运势。';
  return s;
}

async function doAIZiwei() {
  if (!currentZwPrompt) return;
  await ensureKB();
  await loadKBGroup('ziwei');
  await window.RAG.build();
  const btn = document.getElementById('zwAIBtn');
  const content = document.getElementById('zwAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentZw.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const abCfg = getActiveABConfig();
    const facts = window.Expert.ziwei(currentZw);
    const ragContent = window.RAG.search(currentZw, currentZw.question, {
      topK: abCfg.topK,
      maxChars: abCfg.maxChars,
      source: '紫微'
    });
    const historyPrompt = getSimilarHistoryPrompt('ziwei', currentZw.mingGong.ganzhi, currentZw.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('ziwei') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('ziwei', currentZw.question) : '';
    const system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbPrimary('ziwei')
      + kbExtended('ziwei', currentZw.question)
      + kbDaoismBuddhismOnDemand(currentZw.question)
      + '\n\n'
      + (function() {
          let instruction = '';
          if (abCfg.useChainOfThought) instruction += window.Expert.chainOfThought('紫微');
          if (abCfg.useFewshot)         instruction += (instruction ? '\n\n' : '') + window.Expert.fewshot('紫微');
          return instruction;
        })();
    // v3.0.5: 统一 AI 入口(任务 #19)
    const { finalText } = await Core.AI.interpret({
      domain: 'ziwei',
      prompt: currentZwPrompt,
      system,
      pan: currentZw,
      question: currentZw.question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('ziwei', currentZw.mingGong.ganzhi, currentZw.question || '紫微解读', finalText);
    addFeedbackUI('ziwei', content, finalText, currentZwPrompt, system);
    showResultActions('zwAIContent', 'zwAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIZiwei = doAIZiwei;
