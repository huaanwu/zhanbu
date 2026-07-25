function buildQimenPrompt(pan, question) {
  return window.qimen ? window.qimen.formatQimenPrompt(pan, question) : "";
}
// ========== 奇门 ==========
async function doQimen() {
  const btn = document.getElementById('qmBtn');
  btn.disabled = true; btn.textContent = '排盘中...';

  try {
    const year = +document.getElementById('qmYear').value;
    const month = +document.getElementById('qmMonth').value;
    const day = +document.getElementById('qmDay').value;
    const hour = +document.getElementById('qmHour').value;
    const question = document.getElementById('qmQuestion').value;

    if (!window.qimen) { showToast('奇门库加载中，请稍后', 'error'); return; }

    const pan = window.qimen.panQimen(year, month, day, hour, 0);
    currentQm = pan;
    renderQimen(pan);
    currentQmPrompt = window.qimen.formatQimenPrompt(pan, question);
    document.getElementById('qmResult').classList.add('visible');
    document.getElementById('qmAI').style.display = 'block';
    document.getElementById('qmAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '开始排盘';
  }
}
window.doQimen = doQimen;

function renderQimen(pan) {
  let html = '<div class="result-title">奇门遁甲排盘结果</div>';

  html += `<div class="gua-info">`;
  html += `<span>节气：<strong>${pan.jieqi}</strong></span>`;
  html += `<span>局数：<strong>${pan.jushu_text}</strong></span>`;
  if (pan.yuan) html += `<span>定局：<strong>${pan.dingju || '拆补法'} · ${pan.yuan}（符头${pan.futou}）</strong></span>`;
  html += `<span>旬首：<strong>${pan.xunshou}</strong></span>`;
  html += `</div>`;

  html += `<div style="text-align:center;margin-bottom:0.8rem;font-size:0.8rem;color:var(--text-secondary);">四柱：${pan.bazi.join(' ')}</div>`;

  // 九宫格按洛书顺序：4 9 2 / 3 5 7 / 8 1 6
  const luoshuOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const gongMap = {};
  pan.gong9.forEach(g => gongMap[g.gong] = g);

  html += '<div class="jiugong-grid">';
  for (const n of luoshuOrder) {
    const g = gongMap[n];
    if (!g) { html += '<div class="gong-card"></div>'; continue; }

    const cls = ['gong-card'];
    if (g.is_dipan_zhifu) cls.push('zhifu');
    if (g.is_renpan_zhishi) cls.push('zhishi');

    const mark = g.is_dipan_zhifu ? '<div class="mark">直符</div>' :
                 g.is_renpan_zhishi ? '<div class="mark">直使</div>' : '';

    html += `<div class="${cls.join(' ')}">${mark}`;
    html += `<div class="gong-name">${g.name}</div>`;
    html += `<div class="gong-direction">${g.direction} · ${g.wuxing}</div>`;
    html += `<div class="gong-item"><span class="label">九星</span> <span class="value star">${g.jiuxing}</span></div>`;
    html += `<div class="gong-item"><span class="label">八门</span> <span class="value door">${g.renpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">八神</span> <span class="value god">${g.shenpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">天盘</span> <span class="value">${g.tianpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">地盘</span> <span class="value">${g.dipan}</span></div>`;
    html += '</div>';
  }
  html += '</div>';

  document.getElementById('qmResult').innerHTML = html;
}

async function doAIQimen() {
  if (!currentQmPrompt) return;
  await ensureKB();
  await loadKBGroup('qimen');
  await window.RAG.build();
  const btn = document.getElementById('qmAIBtn');
  const content = document.getElementById('qmAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentQm.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    const system = await Core.AI.buildSystemPrompt({ domain: 'qimen', pan: currentQm, question: currentQm.question });
    // v3.0.5: 统一 AI 入口(任务 #19)
    const { finalText } = await Core.AI.interpret({
      domain: 'qimen',
      prompt: currentQmPrompt,
      system,
      pan: currentQm,
      question: currentQm.question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('qimen', currentQm.jushu_text, currentQm.question || '奇门解读', finalText);
    addFeedbackUI('qimen', content, finalText, currentQmPrompt, system);
    showResultActions('qmAIContent', 'qmAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIQimen = doAIQimen;
