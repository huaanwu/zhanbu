// ========== 小六壬 ==========
function selXlrMethod(btn) {
  document.querySelectorAll('#pageXiaoliuren [data-xlr-method]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.xiaoliuren.method = btn.dataset.xlrMethod;
  document.getElementById('xlrLunarRow').style.display = btn.dataset.xlrMethod === 'lunar' ? 'grid' : 'none';
  document.getElementById('xlrNumberRow').style.display = btn.dataset.xlrMethod === 'number' ? 'grid' : 'none';
}
window.selXlrMethod = selXlrMethod;

async function doXiaoliuren() {
  const btn = document.getElementById('xlrBtn');
  btn.disabled = true; btn.textContent = '起课中...';
  try {
    const method = state.xiaoliuren.method;
    const question = document.getElementById('xlrQuestion').value.trim();
    let pan;
    if (method === 'lunar') {
      pan = window.xiaoliuren.paiKe('lunar', {
        month: Number(document.getElementById('xlrMonth').value),
        day: Number(document.getElementById('xlrDay').value),
        hourZhi: Number(document.getElementById('xlrHour').value),
      });
    } else if (method === 'number') {
      pan = window.xiaoliuren.paiKe('number', {
        num1: Number(document.getElementById('xlrNum1').value),
        num2: Number(document.getElementById('xlrNum2').value),
        num3: Number(document.getElementById('xlrNum3').value),
      });
    } else {
      pan = window.xiaoliuren.paiKe('time', { dt: new Date() });
    }
    pan.question = question;
    currentXlr = pan;
    renderXiaoliuren(pan);
    currentXlrPrompt = window.xiaoliuren.formatXiaoliurenPrompt(pan, question);
    document.getElementById('xlrResult').classList.add('visible');
    document.getElementById('xlrAI').style.display = 'block';
    document.getElementById('xlrAIContent').innerHTML = '';
  } catch (e) {
    showToast('起课失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '掐指起课';
  }
}
window.doXiaoliuren = doXiaoliuren;

function renderXiaoliuren(pan) {
  let html = '<div class="result-title">小六壬起课结果</div>';
  html += '<div class="gua-info">';
  html += `<span>起课：<strong>${pan.methodLabel}</strong></span>`;
  if (pan.lunar) {
    html += `<span>农历：<strong>${pan.lunar.text}${pan.lunar.isLeapMonth ? '(闰月)' : ''} ${pan.lunar.timeZhi}时</strong></span>`;
    html += `<span>干支：<strong>${pan.lunar.ganzhi.day}日 ${pan.lunar.ganzhi.time}时</strong></span>`;
  } else if (pan.method === 'lunar') {
    html += `<span>农历：<strong>${pan.month}月${pan.day}日 ${window.xiaoliuren.ZHI_NAMES[pan.hourZhi - 1]}时</strong></span>`;
  } else {
    html += `<span>报数：<strong>${pan.input.num1}、${pan.input.num2}、${pan.input.num3}</strong></span>`;
  }
  html += '</div>';

  // 三传落宫
  const stages = [
    { label: '月宫 · 开端', gong: pan.yueGong },
    { label: '日宫 · 过程', gong: pan.riGong },
    { label: '时宫 · 结果', gong: pan.shiGong },
  ];
  const jiXiongColor = (jx) => jx.indexOf('凶') >= 0 ? 'var(--accent-red)' : 'var(--accent-green)';
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin:0.6rem 0;">';
  stages.forEach((s, i) => {
    const isFinal = i === 2;
    html += `<div style="background:var(--bg-inner);border:${isFinal ? '2px' : '1px'} solid ${isFinal ? 'var(--accent-gold)' : 'var(--border)'};border-radius:8px;padding:0.6rem;text-align:center;">`;
    html += `<div style="font-size:0.7rem;color:var(--text-muted);">${s.label}</div>`;
    html += `<div style="font-family:'Noto Serif SC',serif;font-size:1.3rem;font-weight:700;color:var(--accent-gold);margin:0.2rem 0;">${s.gong.name}</div>`;
    html += `<div style="font-size:0.7rem;color:var(--text-secondary);">${s.gong.wuxing} · ${s.gong.liushen} · ${s.gong.fangwei}</div>`;
    html += `<div style="font-size:0.75rem;font-weight:600;color:${jiXiongColor(s.gong.jixiong)};">${s.gong.jixiong}</div>`;
    if (isFinal) html += '<div style="font-size:0.65rem;color:var(--accent-gold);margin-top:0.2rem;">★ 落宫为断</div>';
    html += '</div>';
  });
  html += '</div>';

  // 口诀 + 断意
  html += `<div style="background:var(--bg-inner);border-radius:8px;padding:0.7rem;margin-top:0.4rem;">`;
  html += `<div style="color:var(--accent-gold);font-size:0.8rem;margin-bottom:0.3rem;">【${pan.final.name}】口诀</div>`;
  html += `<div style="font-family:'Noto Serif SC',serif;font-size:0.9rem;line-height:1.8;color:var(--text-primary);">${pan.koujue}</div>`;
  html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.4rem;line-height:1.7;">${pan.duanyi}</div>`;
  html += '</div>';
  document.getElementById('xlrResult').innerHTML = html;
}

async function doAIXiaoliuren() {
  if (!currentXlrPrompt) return;
  await ensureKB();
  await loadKBGroup('xiaoliuren');
  await window.RAG.build();
  const btn = document.getElementById('xlrAIBtn');
  const content = document.getElementById('xlrAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const question = currentXlr?.question || document.getElementById('xlrQuestion')?.value?.trim() || '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  try {
    let system = await Core.AI.buildSystemPrompt({ domain: 'xiaoliuren', pan: currentXlr, question });
    system += '\n\n【小六壬解读要点】落宫吉凶为代码确定事实，不可更改。请结合三传（月宫开端→日宫过程→时宫结果）分析事情演变节奏，并针对所问之事给出简明可行的建议；小六壬是快占法门，解读应简洁直接，不作过度展开。';
    const { finalText } = await Core.AI.interpret({
      domain: 'xiaoliuren',
      prompt: currentXlrPrompt,
      system,
      pan: currentXlr,
      question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('xiaoliuren', currentXlr.final.name, question || '小六壬解读', finalText);
    addFeedbackUI('xiaoliuren', content, finalText, currentXlrPrompt, system);
    showResultActions('xlrAIContent', 'xlrAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIXiaoliuren = doAIXiaoliuren;
