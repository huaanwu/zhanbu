// ========== 八字 ==========

var DI_ZHI_CANG_GAN = {
  '子': ['癸'], '丑': ['己','癸','辛'], '寅': ['甲','丙','戊'], '卯': ['乙'],
  '辰': ['戊','乙','癸'], '巳': ['丙','庚','戊'], '午': ['丁','己'], '未': ['己','丁','乙'],
  '申': ['庚','壬','戊'], '酉': ['辛'], '戌': ['戊','辛','丁'], '亥': ['壬','甲']
};

function getBaziPan(solar, gender) {
  const ec = solar.getLunar().getEightChar();
  const pan = {
    year: ec.getYear(),
    month: ec.getMonth(),
    day: ec.getDay(),
    hour: ec.getTime()
  };
  try {
    const yun = ec.getYun(gender === 'male' ? 1 : 0);
    pan.yun = {
      startYear: yun.getStartYear(),
      startMonth: yun.getStartMonth(),
      startDay: yun.getStartDay(),
      startSolar: yun.getStartSolar().toYmd(),
      forward: yun.getForward()
    };
    pan.daYun = yun.getDaYun().map(dy => ({
      ganZhi: dy.getGanZhi(),
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      startAge: dy.getStartAge(),
      endAge: dy.getEndAge()
    }));
  } catch (e) { console.log('大运计算失败:', e.message); }
  return pan;
}

async function doBazi() {
  const btn = document.getElementById('baziBtn');
  btn.disabled = true; btn.textContent = '排盘中...';

  try {
    const year = +document.getElementById('baziYear').value;
    const month = +document.getElementById('baziMonth').value;
    const day = +document.getElementById('baziDay').value;
    const hour = +document.getElementById('baziHour').value;
    const gender = state.bazi.gender;
    const question = document.getElementById('baziQuestion').value;

    let solar;
    if (state.bazi.cal === 'lunar') {
      const lunar = Lunar.fromYmd(year, month, day);
      solar = lunar.getSolar();
    } else {
      solar = Solar.fromYmd(year, month, day);
    }

    const gz = getBaziPan(solar, gender);
    const dayGan = gz.day[0];
    const tenGods = calcTenGods(dayGan, gz);

    // 计算流年干支（当前年份）
    const now = new Date();
    const liuNianGanZhi = getYearGZ(now.getFullYear());
    const liuNianShiShen = tenGodRelation(dayGan, liuNianGanZhi[0]);

    currentBazi = { solar, gz, tenGods, gender, question, pillars: gz, daYun: gz.daYun || [], wangShuai: judgeWangShuai(dayGan, gz), liuNian: { ganZhi: liuNianGanZhi, shiShen: liuNianShiShen } };
    renderBazi(currentBazi);
    currentBaziPrompt = buildBaziPrompt(currentBazi);
    document.getElementById('baziResult').classList.add('visible');
    document.getElementById('baziAI').style.display = 'block';
    document.getElementById('baziAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '开始排盘';
  }
}
window.doBazi = doBazi;

function calcTenGods(dayGan, gz) {
  const r = {};
  for (const k of ['year','month','day','hour']) {
    r[k + '_gan'] = tenGodRelation(dayGan, gz[k][0]);
    const zhi = gz[k][1];
    const cangGan = DI_ZHI_CANG_GAN[zhi] || [];
    r[k + '_zhi'] = cangGan.map(g => `${g}(${tenGodRelation(dayGan, g)})`).join('、');
  }
  return r;
}

function tenGodRelation(dayGan, targetGan) {
  const map = {
    '甲':{ '甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印' },
    '乙':{ '甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印' },
    '丙':{ '甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官' },
    '丁':{ '甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀' },
    '戊':{ '甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财' },
    '己':{ '甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财' },
    '庚':{ '甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官' },
    '辛':{ '甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神' },
    '壬':{ '甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财' },
    '癸':{ '甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩' },
  };
  return (map[dayGan] || {})[targetGan] || '';
}
window.tenGodRelation = tenGodRelation;

function renderBazi(pan) {
  const gz = pan.gz;
  const labels = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
  let html = '<div class="result-title">八字排盘结果</div>';
  html += '<div class="pillars-table">';
  for (const k of ['year','month','day','hour']) {
    html += `<div class="pillar-card"><div class="pillar-label">${labels[k]}</div>`;
    html += `<div class="pillar-ganzhi">${gz[k]}</div>`;
    html += `<div class="pillar-info">${WX[gz[k][0]]} · ${WX[gz[k][1]]}</div>`;
    html += `<div class="pillar-info" style="color:var(--accent-green);font-size:0.7rem;">${pan.tenGods[k+'_gan'] || ''}</div>`;
    if (pan.tenGods[k+'_zhi']) {
      html += `<div class="pillar-info" style="color:var(--text-secondary);font-size:0.65rem;">藏：${pan.tenGods[k+'_zhi']}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // 流年信息
  if (pan.liuNian) {
    html += `<div style="text-align:center;margin-top:0.5rem;font-size:0.8rem;color:var(--accent-gold);">流年：${pan.liuNian.ganZhi}（${pan.liuNian.shiShen}）</div>`;
  }

  document.getElementById('baziResult').innerHTML = html;
}

function getYearGZ(year) {
  const gan = ["庚","辛","壬","癸","甲","乙","丙","丁","戊","己"];
  const zhi = ["申","酉","戌","亥","子","丑","寅","卯","辰","巳","午","未"];
  return gan[year % 10] + zhi[year % 12];
}

function buildBaziPrompt(pan) {
  const gz = pan.gz;
  const now = new Date();
  const wangShuai = judgeWangShuai(gz.day[0], gz);
  let s = '=== 八字排盘 ===\n';
  s += `四柱：${gz.year} ${gz.month} ${gz.day} ${gz.hour}\n`;
  s += `日主：${gz.day[0]}\n性别：${pan.gender==='male'?'男':'女'}\n`;
  s += `旺衰判断：${wangShuai}${WX[gz.day[0]]}\n`;
  s += '地支藏干：';
  const zhiLabels = { year:'年', month:'月', day:'日', hour:'时' };
  for (const k of ['year','month','day','hour']) {
    if (pan.tenGods[k+'_zhi']) s += `${zhiLabels[k]}(${pan.tenGods[k+'_zhi']}) `;
  }
  s += '\n';
  s += `当前时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日\n`;
  if (gz.yun) {
    s += `起运：出生后${gz.yun.startYear}年${gz.yun.startMonth}个月${gz.yun.startDay}天起运（${gz.yun.startSolar}）\n`;
    s += `大运排列：${gz.yun.forward ? '顺排' : '逆排'}\n`;
    s += '大运：\n';
    for (const dy of (gz.daYun || []).slice(0, 8)) {
      const marker = (now.getFullYear() >= dy.startYear && now.getFullYear() <= dy.endYear) ? ' 【当前大运】' : '';
      s += `  ${dy.startYear}-${dy.endYear}年（${dy.startAge}-${dy.endAge}岁）：${dy.ganZhi}${marker}\n`;
    }
  }
  if (pan.liuNian) {
    s += `\n流年：${pan.liuNian.ganZhi}（流年天干对日主为${pan.liuNian.shiShen || '同我'}）\n`;
  }
  if (pan.question) s += `\n所问之事：${pan.question}\n`;
  s += '\n请根据以上八字命盘进行详细解读，重点分析当前大运和流年运势。';
  return s;
}

async function doAIBazi() {
  if (!currentBaziPrompt) return;
  const btn = document.getElementById('baziAIBtn');
  const content = document.getElementById('baziAIContent');
  btn.disabled = true; btn.textContent = '加载知识库...';
  content.textContent = '正在加载知识库，请稍候...';

  await ensureKB();
  await loadKBGroup('bazi');
  btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentBazi.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    const system = Core.AI.buildSystemPrompt({ domain: 'bazi', pan: currentBazi, question: currentBazi.question });
    // v3.0.5: 统一 AI 入口(任务 #19)— 缓存查询 + 流式输出 + 事件派发 + abort 由 Core.AI.interpret() 接管
    const { finalText } = await Core.AI.interpret({
      domain: 'bazi',
      prompt: currentBaziPrompt,
      system,
      pan: currentBazi,
      question: currentBazi.question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('bazi', currentBazi.gz.day, currentBazi.question || '八字解读', finalText);
    addFeedbackUI('bazi', content, finalText, currentBaziPrompt, system);
    showResultActions('baziAIContent', 'baziAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    // v3.0.5: hideStreamIndicator 由 Core.AI.interpret() 内部处理(失败 throw 也已 hide)
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIBazi = doAIBazi;
