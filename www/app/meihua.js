// ========== 梅花易数 ==========
function selMhMethod(btn) {
  document.querySelectorAll('#pageMeihua [data-mh-method]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.meihua.method = btn.dataset.mhMethod;
  document.getElementById('mhNumberRow').style.display = btn.dataset.mhMethod === 'number' ? 'grid' : 'none';
}
window.selMhMethod = selMhMethod;

async function doMeihua() {
  const btn = document.getElementById('mhBtn');
  btn.disabled = true; btn.textContent = '起卦中...';
  try {
    const method = state.meihua.method;
    const question = document.getElementById('mhQuestion').value.trim();
    let pan;
    if (method === 'number') {
      const n3Raw = document.getElementById('mhNum3').value;
      pan = window.meihua.paiGua('number', {
        num1: Number(document.getElementById('mhNum1').value),
        num2: Number(document.getElementById('mhNum2').value),
        num3: n3Raw === '' ? null : Number(n3Raw),
      });
    } else {
      pan = window.meihua.paiGua('time', { dt: new Date() });
    }
    pan.question = question;
    currentMh = pan;
    renderMeihua(pan);
    currentMhPrompt = window.meihua.formatMeihuaPrompt(pan, question);
    document.getElementById('mhResult').classList.add('visible');
    document.getElementById('mhAI').style.display = 'block';
    document.getElementById('mhAIContent').innerHTML = '';
  } catch (e) {
    showToast('起卦失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '起卦';
  }
}
window.doMeihua = doMeihua;

function renderMeihua(pan) {
  const jiXiongColor = (jx) => jx.indexOf('凶') >= 0 ? 'var(--accent-red)' : 'var(--accent-green)';
  let html = '<div class="result-title">梅花易数起卦结果</div>';
  html += '<div class="gua-info">';
  html += `<span>起卦：<strong>${pan.methodLabel}</strong></span>`;
  if (pan.lunar) {
    html += `<span>农历：<strong>${pan.lunar.month}月${pan.lunar.day}日${pan.lunar.isLeapMonth ? '(闰月)' : ''} ${pan.lunar.hourZhi}时</strong></span>`;
  }
  html += `<span>动爻：<strong>${pan.dongYaoName}</strong></span>`;
  html += `</div>`;

  // 本卦 + 体用
  const tiTag = '<span style="color:var(--accent-gold);font-weight:700;">【体】</span>';
  const yongTag = '<span style="color:var(--accent-red);font-weight:700;">【用】</span>';
  const upperTag = pan.yong.position === '上卦' ? yongTag : tiTag;
  const lowerTag = pan.yong.position === '下卦' ? yongTag : tiTag;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin:0.6rem 0;">';
  html += `<div style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.6rem;text-align:center;">`;
  html += `<div style="font-size:0.7rem;color:var(--text-muted);">上卦 ${upperTag}</div>`;
  html += `<div style="font-size:1.6rem;line-height:1.2;">${pan.gua.upperSymbol}</div>`;
  html += `<div style="font-family:'Noto Serif SC',serif;font-weight:700;color:var(--accent-gold);">${pan.gua.upperGua} · ${pan.yong.position === '上卦' ? pan.yong.wuxing : pan.ti.wuxing}</div>`;
  html += `</div>`;
  html += `<div style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.6rem;text-align:center;">`;
  html += `<div style="font-size:0.7rem;color:var(--text-muted);">下卦 ${lowerTag}</div>`;
  html += `<div style="font-size:1.6rem;line-height:1.2;">${pan.gua.lowerSymbol}</div>`;
  html += `<div style="font-family:'Noto Serif SC',serif;font-weight:700;color:var(--accent-gold);">${pan.gua.lowerGua} · ${pan.yong.position === '下卦' ? pan.yong.wuxing : pan.ti.wuxing}</div>`;
  html += `</div></div>`;

  html += `<div style="text-align:center;margin:0.4rem 0;font-family:'Noto Serif SC',serif;">`;
  html += `<span style="font-size:1.15rem;font-weight:700;color:var(--text-primary);">本卦 ${pan.gua.name}</span>`;
  html += `<span style="color:var(--text-muted);margin:0 0.5rem;">→</span><span style="color:var(--text-secondary);">互 ${pan.hu.name}</span>`;
  html += `<span style="color:var(--text-muted);margin:0 0.5rem;">→</span><span style="color:var(--text-secondary);">变 ${pan.bian.name}</span>`;
  html += `</div>`;

  // 体用生克
  html += `<div style="background:var(--bg-inner);border:2px solid ${jiXiongColor(pan.relation.jixiong)};border-radius:8px;padding:0.7rem;margin-top:0.5rem;">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
  html += `<span style="font-size:0.85rem;color:var(--text-secondary);">体用关系：<strong style="color:var(--text-primary);">${pan.relation.label}</strong>（体${pan.ti.name}${pan.ti.wuxing} / 用${pan.yong.name}${pan.yong.wuxing}）</span>`;
  html += `<span style="font-weight:700;color:${jiXiongColor(pan.relation.jixiong)};">${pan.relation.jixiong}</span>`;
  html += `</div>`;
  html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.4rem;line-height:1.7;">${pan.relation.desc}</div>`;
  html += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem;line-height:1.6;">过程（互卦）：${pan.hu.upperRel}；${pan.hu.lowerRel}<br>结果（变卦）：${pan.bian.rel}</div>`;
  html += `<div style="font-size:0.8rem;color:var(--text-primary);margin-top:0.4rem;line-height:1.7;border-top:1px dashed var(--border);padding-top:0.4rem;">${pan.verdict}</div>`;
  html += '</div>';
  document.getElementById('mhResult').innerHTML = html;
}

async function doAIMeihua() {
  if (!currentMhPrompt) return;
  await ensureKB();
  await loadKBGroup('meihua');
  await window.RAG.build();
  const btn = document.getElementById('mhAIBtn');
  const content = document.getElementById('mhAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const question = currentMh?.question || document.getElementById('mhQuestion')?.value?.trim() || '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  try {
    let system = await Core.AI.buildSystemPrompt({ domain: 'meihua', pan: currentMh, question });
    system += '\n\n【梅花易数解读要点】体用生克吉凶为代码确定事实，不可更改。请以体卦为求测者、用卦为所占之事，结合互卦（过程）与变卦（结果）分析事情演变，并依据万物类象对所问之事取象具体化（如方位、人物、物色、时令），给出简明可行的建议。';
    const { finalText } = await Core.AI.interpret({
      domain: 'meihua',
      prompt: currentMhPrompt,
      system,
      pan: currentMh,
      question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('meihua', currentMh.gua.name, question || '梅花易数解读', finalText);
    addFeedbackUI('meihua', content, finalText, currentMhPrompt, system);
    showResultActions('mhAIContent', 'mhAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIMeihua = doAIMeihua;
