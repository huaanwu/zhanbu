// ========== 大六壬 ==========
async function doDaliuren() {
  const btn = document.getElementById('dlrBtn');
  btn.disabled = true; btn.textContent = '起课中...';
  try {
    const year = +document.getElementById('dlrYear').value;
    const month = +document.getElementById('dlrMonth').value;
    const day = +document.getElementById('dlrDay').value;
    const hour = +document.getElementById('dlrHour').value;
    const question = document.getElementById('dlrQuestion').value.trim();
    state.daliuren = { year, month, day, hour };

    if (!window.daliuren) { showToast('大六壬库加载中，请稍后', 'error'); return; }

    const dt = new Date(year, month - 1, day, hour, 0, 0);
    const pan = window.daliuren.paiKe('time', { dt });
    pan.question = question;
    currentDlr = pan;
    renderDaliuren(pan);
    currentDlrPrompt = window.daliuren.formatDaliurenPrompt(pan, question);
    document.getElementById('dlrResult').classList.add('visible');
    document.getElementById('dlrAI').style.display = 'block';
    document.getElementById('dlrAIContent').innerHTML = '';
  } catch (e) {
    showToast('起课失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '起课';
  }
}
window.doDaliuren = doDaliuren;

// 天地盘圆图(SVG): 外圈天盘神+天将,内圈地盘支,三传/干宫/支宫标记
// 传统方位: 午在南(顶),子在北(底),卯在东(左),酉在西(右),顺时针排布
function buildDlrCircle(pan) {
  const order = ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'];
  const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const C = 110, R_OUT = 93, R_IN = 64;
  // 天盘支 → 所临地盘支(用于三传落宫标记)
  const tp2dp = {};
  ZHI12.forEach(z => { tp2dp[pan.tianPan[z]] = z; });
  const chuanMark = {};
  const chuanColors = ['var(--accent-red)', 'var(--accent-gold)', 'var(--accent-green)'];
  pan.sanChuan.forEach((c, i) => {
    const dp = tp2dp[c.shen];
    if (dp) chuanMark[dp] = { label: ['初', '中', '末'][i], color: chuanColors[i], shen: c.shen };
  });
  const ganGong = pan.siKe.length ? window.daliuren.JIGONG[pan.siKe[0].xia] : null;
  const zhiGong = pan.siKe.length > 2 ? pan.siKe[2].xia : null;

  function pos(i, r) {
    const a = (-90 + i * 30) * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  }

  let svg = `<svg viewBox="0 0 220 220" style="display:block;margin:0 auto;max-width:260px;width:100%;">`;
  svg += `<circle cx="${C}" cy="${C}" r="104" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  svg += `<circle cx="${C}" cy="${C}" r="78" fill="none" stroke="var(--border)" stroke-width="0.75" stroke-dasharray="2,2"/>`;
  svg += `<circle cx="${C}" cy="${C}" r="50" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  order.forEach((dz, i) => {
    const tp = pan.tianPan[dz];
    const jiang = pan.tianJiang[tp] || '';
    const [xo, yo] = pos(i, R_OUT);
    const [xj, yj] = pos(i, R_OUT - 13);
    const [xi, yi] = pos(i, R_IN);
    // 三传落宫弧线
    const mark = chuanMark[dz];
    if (mark) {
      const a0 = (-90 + i * 30 - 13) * Math.PI / 180, a1 = (-90 + i * 30 + 13) * Math.PI / 180;
      const x0 = C + 86 * Math.cos(a0), y0 = C + 86 * Math.sin(a0);
      const x1 = C + 86 * Math.cos(a1), y1 = C + 86 * Math.sin(a1);
      svg += `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A 86 86 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${mark.color}" stroke-width="3" opacity="0.7"/>`;
      svg += `<text x="${xo}" y="${yo - 8}" text-anchor="middle" font-size="8" fill="${mark.color}" font-weight="700">${mark.label}</text>`;
    }
    // 天盘神 + 天将
    svg += `<text x="${xo}" y="${yo + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${mark ? mark.color : 'var(--accent-gold)'}">${tp}</text>`;
    svg += `<text x="${xj}" y="${yj + 10}" text-anchor="middle" font-size="7.5" fill="var(--text-muted)">${jiang}</text>`;
    // 地盘支 + 干/支宫标记
    let dpLabel = dz;
    svg += `<text x="${xi}" y="${yi + 4}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${dpLabel}</text>`;
    if (dz === ganGong) svg += `<text x="${xi}" y="${yi + 14}" text-anchor="middle" font-size="7" fill="var(--accent-blue)">干</text>`;
    if (dz === zhiGong) svg += `<text x="${xi}" y="${yi - 6}" text-anchor="middle" font-size="7" fill="var(--accent-purple)">支</text>`;
  });
  // 中心: 月将/占时
  svg += `<text x="${C}" y="${C - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--accent-gold)">${pan.yueJiang.zhi}将</text>`;
  svg += `<text x="${C}" y="${C + 8}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${pan.yueJiang.name}</text>`;
  svg += `<text x="${C}" y="${C + 21}" text-anchor="middle" font-size="9" fill="var(--text-muted)">占时 ${pan.hourZhi}</text>`;
  svg += '</svg>';
  return svg;
}

function renderDaliuren(pan) {
  let html = '<div class="result-title">大六壬起课结果</div>';

  html += '<div class="gua-info">';
  if (pan.siZhu) html += `<span>四柱：<strong>${pan.siZhu.year} ${pan.siZhu.month} ${pan.siZhu.day} ${pan.siZhu.hour}</strong></span>`;
  html += `<span>月将：<strong>${pan.yueJiang.zhi}将${pan.yueJiang.name}${pan.yueJiang.zhongqi ? '（' + pan.yueJiang.zhongqi + '后）' : ''}</strong></span>`;
  html += `<span>占时：<strong>${pan.hourZhi}时</strong></span>`;
  html += `<span>旬空：<strong>${pan.xunKong || '—'}</strong></span>`;
  html += '</div>';

  // 课式标记(伏吟/返吟/八专)
  if (pan.flags.fuYin || pan.flags.fanYin || pan.flags.baZhuan) {
    const flagText = pan.flags.fuYin ? '伏吟（诸神归本位）' : pan.flags.fanYin ? '返吟（天地盘相冲）' : '八专（干支同位）';
    html += `<div style="text-align:center;margin:0.4rem 0;font-size:0.8rem;color:var(--accent-gold);">课式：${flagText}</div>`;
  }

  // 天盘圆图: 传统十二宫圆盘(外圈天盘神+天将,内圈地盘,三传落宫弧标记)
  html += '<div style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.6rem;margin:0.5rem 0;">';
  html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.3rem;text-align:center;">天地盘（外圈天盘·天将 / 内圈地盘，弧标为三传落宫）</div>';
  html += buildDlrCircle(pan);
  html += '</div>';

  // 四课
  html += '<div style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.6rem;margin:0.5rem 0;">';
  html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.4rem;text-align:center;">四课（四三二一，上神/下神）</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.3rem;">';
  const keNames = ['一', '二', '三', '四'];
  pan.siKe.forEach((k, i) => {
    html += `<div style="text-align:center;font-size:0.8rem;padding:0.3rem;border:1px solid var(--border);border-radius:4px;">`
      + `<div style="font-size:0.65rem;color:var(--text-muted);">第${keNames[i]}课</div>`
      + `<div style="color:var(--accent-gold);font-weight:700;">${k.shang}<span style="font-size:0.65rem;color:var(--text-muted);"> ${k.shangJiang}</span></div>`
      + `<div style="color:var(--text-secondary);">${k.xia}</div></div>`;
  });
  html += '</div></div>';

  // 三传
  html += `<div style="background:var(--bg-inner);border:2px solid var(--accent-gold);border-radius:8px;padding:0.7rem;margin-top:0.5rem;">`;
  html += `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.4rem;">发用：<strong style="color:var(--accent-gold);">${pan.faYong.zongmen} · ${pan.faYong.keti}</strong></div>`;
  for (const c of pan.sanChuan) {
    html += `<div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px dashed var(--border);">`
      + `<span style="color:var(--text-secondary);font-size:0.85rem;">${c.name}</span>`
      + `<span style="font-weight:700;color:var(--text-primary);font-size:1.05rem;">${c.shen}</span>`
      + `<span style="color:var(--text-muted);font-size:0.75rem;">${c.jiang}${c.dunGan ? ' · 遁' + c.dunGan : ''}</span></div>`;
  }
  html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.4rem;line-height:1.6;">${pan.faYong.detail}</div>`;
  html += `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;">贵人${pan.guiRen.zhi}（${pan.guiRen.isDay ? '昼' : '夜'}贵，临${pan.guiRen.linGong}宫${pan.guiRen.shun ? '顺' : '逆'}布）</div>`;
  html += '</div>';

  document.getElementById('dlrResult').innerHTML = html;
}

async function doAIDaliuren() {
  if (!currentDlrPrompt) return;
  await ensureKB();
  await loadKBGroup('daliuren');
  await window.RAG.build();
  const btn = document.getElementById('dlrAIBtn');
  const content = document.getElementById('dlrAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const question = currentDlr?.question || document.getElementById('dlrQuestion')?.value?.trim() || '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  try {
    let system = await Core.AI.buildSystemPrompt({ domain: 'daliuren', pan: currentDlr, question });
    system += '\n\n【大六壬解读要点】月将、四课、三传、天将、发用宗门为代码确定事实，不可更改。请以初传为事之发端、中传为移易过程、末传为归宿结局，结合发用课体（如重审主迟、元首主速、蒿矢弹射主远事、伏吟主静守、返吟主反复）与十二天将意象，对所问之事给出具体判断与建议。';
    const { finalText } = await Core.AI.interpret({
      domain: 'daliuren',
      prompt: currentDlrPrompt,
      system,
      pan: currentDlr,
      question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('daliuren', currentDlr.sanChuan.map(c => c.shen).join(''), question || '大六壬解读', finalText);
    addFeedbackUI('daliuren', content, finalText, currentDlrPrompt, system);
    showResultActions('dlrAIContent', 'dlrAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIDaliuren = doAIDaliuren;
