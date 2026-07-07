// ========== 姓名学 ==========
let xsGender = 'male';
function selXsGender(btn) {
  document.querySelectorAll('#pageXingshi [data-gender]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  xsGender = btn.dataset.gender;
}
window.selXsGender = selXsGender;

// currentXs已在上方声明
// let currentXs = null, currentXsPrompt = '';

function doXingshi() {
  const surname = document.getElementById('xsSurname').value.trim();
  const name = document.getElementById('xsName').value.trim();
  if (!surname || !name) { showToast('请输入完整的姓氏和名字', 'error'); return; }
  if (!window.Xingshi) { showToast('姓名学模块加载中', 'error'); return; }

  try {
    const data = window.Xingshi.calculateGege(surname, name);
    const result = document.getElementById('xsResult');
    result.style.display = 'block';

    const wuxingMap = { 1:'木', 2:'木', 3:'火', 4:'火', 5:'土', 6:'土', 7:'金', 8:'金', 9:'火' };
    const dotGe = (n) => {
      const last = n % 10;
      return [1, 3, 5, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 77, 78, 81].includes(last) ? '大吉'
           : [29, 38, 49, 53, 73, 80].includes(last) ? '中吉'
           : '凶';
    };
    const clr = (s) => s === '大吉' ? 'var(--accent-green)' : s === '中吉' ? 'var(--accent-gold)' : 'var(--accent-red)';

    result.innerHTML = `
      <h3 style="color:var(--accent-gold);">📜 姓名五格排盘</h3>
      <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
        <div style="font-size:1.3rem;font-weight:600;color:var(--accent-gold);">${surname}${name}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">
          姓「${data.surname.split('').map(c => c + '(' + window.Xingshi.getCharBihua(c) + ')').join('、')}」 ·
          名「${data.name.split('').map(c => c + '(' + window.Xingshi.getCharBihua(c) + ')').join('、')}」
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:0.8rem;font-size:0.9rem;">
        <thead>
          <tr style="background:var(--bg-inner);">
            <th style="padding:0.4rem;">五格</th><th>数</th><th>五行</th><th>吉凶</th><th>影响</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>天格</td><td>${data.tiange}</td><td>${wuxingMap[data.tiange]||''}</td><td style="color:${clr(dotGe(data.tiange))};">${dotGe(data.tiange)}</td><td>先天运、父母</td></tr>
          <tr><td><strong>人格</strong></td><td><strong>${data.renge}</strong></td><td><strong>${wuxingMap[data.renge]||''}</strong></td><td style="color:${clr(dotGe(data.renge))};"><strong>${dotGe(data.renge)}</strong></td><td><strong>主运、事业【最重】</strong></td></tr>
          <tr><td>地格</td><td>${data.dige}</td><td>${wuxingMap[data.dige]||''}</td><td style="color:${clr(dotGe(data.dige))};">${dotGe(data.dige)}</td><td>前运、基础</td></tr>
          <tr><td>外格</td><td>${data.waige}</td><td>${wuxingMap[data.waige]||''}</td><td style="color:${clr(dotGe(data.waige))};">${dotGe(data.waige)}</td><td>副运、社交</td></tr>
          <tr><td>总格</td><td>${data.zongge}</td><td>${wuxingMap[data.zongge]||''}</td><td style="color:${clr(dotGe(data.zongge))};">${dotGe(data.zongge)}</td><td>后运、总格局</td></tr>
        </tbody>
      </table>
      <div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.8rem;font-size:0.9rem;">
        <span style="color:var(--accent-gold);">三才配置：</span>
        <span style="font-weight:600;">${data.sancaiWuge.join(' → ')}</span>
        <span style="color:var(--text-muted);font-size:0.8rem;">（天格·人格·地格）</span>
      </div>
    `;
    currentXs = { ...data, gender: xsGender, birth: document.getElementById('xsBirth').value.trim() };
    currentXsPrompt = window.Xingshi.buildXingshiPrompt(data, xsGender, currentXs.birth);
    document.getElementById('xsAI').style.display = 'block';
    document.getElementById('xsAIBtn').style.display = 'inline-block';
    document.getElementById('xsAILoading').style.display = 'none';
    document.getElementById('xsAIText').style.display = 'none';
  } catch (e) {
    showToast('测算失败: ' + e.message, 'error');
  }
}
window.doXingshi = doXingshi;

async function doAIXingshi() {
  if (!currentXsPrompt) return;
  await ensureKB();
  await loadKBGroup('xingshi');
  const btn = document.getElementById('xsAIBtn');
  const loading = document.getElementById('xsAILoading');
  const text = document.getElementById('xsAIText');
  btn.disabled = true; btn.textContent = '解读中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '';

  let fullText = '';
  try {
    // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    const sys = Core.AI.buildSystemPrompt({
      domain: 'xingshi', pan: currentXs, question: currentXs.birth || '',
      extraSystem: '你是一位精通姓名学的命理大师，请根据五格剖象进行专业解读。重点说明人格（主运）、地格（基础）、总格（后运）的吉凶含义，并结合三才配置分析。注意：吉数并非绝对好，需要配合三才平衡。'
    });
    // v3.0.5: 统一 AI 入口(任务 #19)
    await Core.AI.interpret({
      domain: 'xingshi',
      prompt: currentXsPrompt,
      system: sys,
      pan: currentXs,
      question: currentXs.birth || '',
      contentEl: text,
      prefix,
      separator,
    });
    showResultActions('xsAIText', 'xsAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error">解读失败: ' + escapeHtml(e.message) + '</div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIXingshi = doAIXingshi;

function kbXingshi() {
  return '\n\n【知识库参考】五格数理吉凶简表：\n'
    + '大吉数：1, 3, 5, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 77, 78, 81\n'
    + '中吉数：29, 38, 49, 53, 73, 80\n'
    + '三才配置要点：人格地格五行相生或比和最吉；相克则主波折。三才配合五格主次分明、人格吉利、总格不凶者为上佳姓名。'
    + kbXingshiCases()
    + kbXingshiExt();
}
