// ========== 灵签(观音灵签/关帝灵签) ==========
function selLqKind(btn) {
  document.querySelectorAll('#pageLingqian [data-lq-kind]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.lingqian.kind = btn.dataset.lqKind;
}
window.selLqKind = selLqKind;

async function doLingqian() {
  const btn = document.getElementById('lqBtn');
  btn.disabled = true; btn.textContent = '抽签中...';
  try {
    if (!window.lingqian) { showToast('灵签库加载中，请稍后', 'error'); return; }
    const kind = state.lingqian.kind;
    const question = document.getElementById('lqQuestion').value.trim();
    // 按需加载对应 KB 组(观音: buddhism_divine / 关帝: guandi_qian)
    if (window.loadKBGroup) await loadKBGroup('lingqian');
    const kbData = kind === 'guanyin' ? window._kb?.buddhism_divine : window._kb?.guandi_qian;
    if (!kbData?.entries) { showToast('签文库未加载，请稍后重试', 'error'); return; }

    const num = window.lingqian.draw(kind);
    const qian = window.lingqian.parseQian(kind, num, kbData);
    qian.question = question;
    currentLq = qian;
    renderLingqian(qian);
    currentLqPrompt = window.lingqian.formatLingqianPrompt(qian, question);
    document.getElementById('lqResult').classList.add('visible');
    document.getElementById('lqAI').style.display = 'block';
    document.getElementById('lqAIContent').innerHTML = '';
  } catch (e) {
    showToast('抽签失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '虔诚抽签';
  }
}
window.doLingqian = doLingqian;

function renderLingqian(qian) {
  const levelColor = /上|吉/.test(qian.level) && qian.level.indexOf('下') < 0
    ? 'var(--accent-gold)'
    : qian.level.indexOf('平') >= 0 ? 'var(--text-secondary)' : 'var(--accent-red)';
  // 签诗按句拆行(七言四句, 古色古香竖排感居中排版)
  const poemLines = qian.poem.replace(/。$/, '').split(/[，。；]/).filter(s => s);
  let html = '<div class="result-title">' + escapeHtml(qian.kindName) + '</div>';
  html += `<div style="text-align:center;padding:1rem;background:var(--bg-inner);border-radius:8px;border:2px solid var(--accent-gold);">`;
  html += `<div style="font-size:0.8rem;color:var(--text-muted);">第 ${qian.num} 签${qian.ganzhi ? ' · ' + escapeHtml(qian.ganzhi) : ''} · 共一百签</div>`;
  html += `<div style="font-size:1.5rem;font-weight:bold;color:${levelColor};margin:0.3rem 0;font-family:'Noto Serif SC',serif;">${escapeHtml(qian.level)}签</div>`;
  html += `<div style="font-size:1.05rem;color:var(--accent-gold);margin:0.3rem 0;font-family:'Noto Serif SC',serif;">${escapeHtml(qian.gudian)}</div>`;
  html += `<div style="font-family:'Noto Serif SC',serif;font-size:1.05rem;color:var(--text-primary);line-height:2;margin:0.6rem 0;">`;
  poemLines.forEach(line => { html += `<div>${escapeHtml(line)}</div>`; });
  html += `</div>`;
  if (qian.shengyi) {
    html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border);line-height:1.8;"><strong>圣意：</strong>${escapeHtml(qian.shengyi)}</div>`;
  }
  if (qian.jie) {
    html += `<div style="font-size:0.85rem;color:var(--text-primary);margin-top:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border);line-height:1.8;text-align:left;"><strong>${qian.kind === 'guanyin' ? '签意' : '解曰'}：</strong>${escapeHtml(qian.jie)}</div>`;
  }
  if (qian.dongpo) {
    html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.4rem;line-height:1.8;text-align:left;"><strong>东坡解：</strong>${escapeHtml(qian.dongpo)}</div>`;
  }
  if (qian.bixian) {
    html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.2rem;line-height:1.8;text-align:left;"><strong>碧仙注：</strong>${escapeHtml(qian.bixian)}</div>`;
  }
  if (qian.advice) {
    html += `<div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border);">💡 化解：${escapeHtml(qian.advice)}</div>`;
  }
  if (qian.question) {
    html += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">【所问之事】${escapeHtml(qian.question)}</div>`;
  }
  html += `</div>`;
  document.getElementById('lqResult').innerHTML = html;
}

async function doAILingqian() {
  if (!currentLqPrompt) return;
  await ensureKB();
  await loadKBGroup('lingqian');
  await window.RAG.build();
  const btn = document.getElementById('lqAIBtn');
  const content = document.getElementById('lqAIContent');
  btn.disabled = true; btn.textContent = '解签中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const question = currentLq?.question || document.getElementById('lqQuestion')?.value?.trim() || '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  try {
    let system = await Core.AI.buildSystemPrompt({ domain: 'lingqian', pan: currentLq, question });
    system += '\n\n【灵签解签要点】签号、吉凶等级、签诗、圣意、解曰与典故为既定签文事实，不可更改。请以签诗为主线，结合吉凶等级、' + (currentLq?.kind === 'guandi' ? '圣意、东坡解、碧仙注与典故' : '签意与典故') + '，紧扣求签者所问之事解签：先总断此签吉凶与事情走向，再分项（如事业、财运、婚姻、健康、出行）结合签文意象具体指点，给出平实可行的建议；下下签非绝对之凶，多为警示，当劝其反省修德、谨慎待时，避免宿命论恐吓。';
    const { finalText } = await Core.AI.interpret({
      domain: 'lingqian',
      prompt: currentLqPrompt,
      system,
      pan: currentLq,
      question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('lingqian', currentLq.title, question || currentLq.kindName + '解签', finalText);
    addFeedbackUI('lingqian', content, finalText, currentLqPrompt, system);
    showResultActions('lqAIContent', 'lqAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解签';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAILingqian = doAILingqian;
