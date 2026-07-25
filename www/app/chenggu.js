// ========== 称骨算命(袁天罡称骨) v3.0.9 ==========
// 加:历法切换(阳/阴)+ 性别切换(断语只显示所选性别)
// 农历路径走 window.chenggu.chengguSuanByLunar(已存在,免去公转农步骤)

function selCgCal(btn) {
  document.querySelectorAll('[data-cg-cal]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.chenggu.cal = btn.dataset.cgCal;
  document.getElementById('cgSolarRow').style.display = btn.dataset.cgCal === 'solar' ? 'grid' : 'none';
  document.getElementById('cgLunarRow').style.display = btn.dataset.cgCal === 'lunar' ? 'grid' : 'none';
}
window.selCgCal = selCgCal;

function selCgGender(btn) {
  document.querySelectorAll('[data-cg-gender]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.chenggu.gender = btn.dataset.cgGender;
}
window.selCgGender = selCgGender;

async function doChenggu() {
  const btn = document.getElementById('cgBtn');
  btn.disabled = true; btn.textContent = '称骨中...';
  try {
    if (!window.chenggu) { showToast('称骨库加载中，请稍后', 'error'); return; }
    const cal = (state.chenggu && state.chenggu.cal) || 'solar';
    const gender = (state.chenggu && state.chenggu.gender) || 'male';
    const question = document.getElementById('cgQuestion').value.trim();

    let pan;
    if (cal === 'lunar') {
      // 农历路径: 直接读 y/m/d + 时支,走 chengguSuanByLunar
      const yearGZ = document.getElementById('cgYearGZ').value;
      const month = +document.getElementById('cgLunarMonth').value;
      const day = +document.getElementById('cgLunarDay').value;
      const hourZhi = document.getElementById('cgHourZhi').value;
      pan = window.chenggu.chengguSuanByLunar({ yearGZ, month, day, hourZhi });
    } else {
      // 阳历路径: dt → 自动转农历
      const year = +document.getElementById('cgYear').value;
      const month = +document.getElementById('cgMonth').value;
      const day = +document.getElementById('cgDay').value;
      const hour = +document.getElementById('cgHour').value;
      pan = window.chenggu.chengguSuan(new Date(year, month - 1, day, hour, 0));
    }
    pan.gender = gender;  // v3.0.9: 缓存 key + 渲染都用
    pan.question = question;
    pan.cal = cal;
    currentCg = pan;
    renderChenggu(pan);
    currentCgPrompt = window.chenggu.formatChengguPrompt(pan, question);
    document.getElementById('cgResult').classList.add('visible');
    document.getElementById('cgAI').style.display = 'block';
    document.getElementById('cgAIContent').innerHTML = '';
  } catch (e) {
    showToast('称骨失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '开始称骨';
  }
}
window.doChenggu = doChenggu;

function renderChenggu(pan) {
  const gender = pan.gender || 'male';
  const verdictText = gender === 'female' ? pan.verdict.female : pan.verdict.male;
  const genderLabel = gender === 'female' ? '女命' : '男命';

  let html = '<div class="result-title">称骨算命结果</div>';
  html += '<div class="gua-info">';
  const calLabel = pan.cal === 'lunar' ? '农历(用户输入)' : '农历(由阳历转)';
  html += `<span>${calLabel}：<strong>${pan.lunar.yearGZ}年${pan.lunar.isLeapMonth ? '闰' : ''}${pan.lunar.monthCN}${pan.lunar.dayCN} ${pan.lunar.hourZhi}时</strong></span>`;
  html += `<span>总骨重：<strong>${pan.totalText}</strong></span>`;
  html += `<span>断语按：<strong>${genderLabel}</strong></span>`;
  html += '</div>';

  // 四柱骨重明细
  const w = pan.weights;
  const items = [w.year, w.month, w.day, w.hour];
  const names = ['年', '月', '日', '时'];
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin:0.6rem 0;">';
  for (let i = 0; i < 4; i++) {
    html += `<div style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.6rem;text-align:center;">`;
    html += `<div style="font-size:0.7rem;color:var(--text-muted);">${names[i]}</div>`;
    html += `<div style="font-size:0.85rem;color:var(--text-secondary);margin:0.2rem 0;">${items[i].label}</div>`;
    html += `<div style="font-family:'Noto Serif SC',serif;font-weight:700;color:var(--accent-gold);">${items[i].text}</div>`;
    html += `</div>`;
  }
  html += '</div>';

  // 断语: 只显示所选性别的那段(原男女双段已废)
  html += `<div style="background:var(--bg-inner);border:2px solid var(--accent-gold);border-radius:8px;padding:0.7rem;margin-top:0.5rem;">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
  html += `<span style="font-size:0.85rem;color:var(--text-secondary);">总骨重：<strong style="color:var(--text-primary);">${pan.totalText}</strong></span>`;
  if (pan.verdict.title) html += `<span style="font-size:0.8rem;color:var(--accent-gold);font-weight:700;">${pan.verdict.title}</span>`;
  html += `</div>`;
  html += `<div style="font-size:0.85rem;color:var(--text-primary);margin-top:0.5rem;line-height:1.8;"><strong>${genderLabel}：</strong>${verdictText}</div>`;
  html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.4rem;">称骨歌断语为查表定论，闰月按当月计。本表按你选择的"${genderLabel}"显示。</div>`;
  html += '</div>';
  document.getElementById('cgResult').innerHTML = html;
}

async function doAIChenggu() {
  if (!currentCgPrompt) return;
  await ensureKB();
  await loadKBGroup('chenggu');
  await window.RAG.build();
  const btn = document.getElementById('cgAIBtn');
  const content = document.getElementById('cgAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const question = currentCg?.question || document.getElementById('cgQuestion')?.value?.trim() || '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  try {
    let system = await Core.AI.buildSystemPrompt({ domain: 'chenggu', pan: currentCg, question });
    const genderLabel = currentCg?.gender === 'female' ? '女' : '男';
    system += `\n\n【称骨算命解读要点】用户性别:${genderLabel}。四柱骨重、总骨重与称骨歌断语为代码确定事实，不可更改。请以总骨重与所选性别(男/女)对应的称骨歌断语为主线展开:解释歌诀含义，结合求测者所问之事分析一生荣枯、早年/中年/晚年运势节奏,给出平实可行的建议；不可把骨重轻重大小绝对化(骨重非越重越好),避免宿命论恐吓。`;
    const { finalText } = await Core.AI.interpret({
      domain: 'chenggu',
      prompt: currentCgPrompt,
      system,
      pan: currentCg,
      question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('chenggu', currentCg.totalText, question || '称骨算命解读', finalText);
    addFeedbackUI('chenggu', content, finalText, currentCgPrompt, system);
    showResultActions('cgAIContent', 'cgAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIChenggu = doAIChenggu;