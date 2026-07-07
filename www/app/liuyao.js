function buildLiuyaoPrompt(pan, question) {
  return window.liuyao ? window.liuyao.formatLiuyaoPrompt(pan, question) : "";
}
// ========== 六爻 ==========
function selLiuyaoMethod(btn) {
  document.querySelectorAll('#pageLiuyao [data-method]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.liuyao.method = btn.dataset.method;
  document.getElementById('liuyaoNumberRow').style.display = btn.dataset.method === 'number' ? 'grid' : 'none';
}
window.selLiuyaoMethod = selLiuyaoMethod;

function selLiuyaoMode(btn) {
  document.querySelectorAll('#pageLiuyao [data-mode]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.liuyao.mode = btn.dataset.mode;
  const xw1 = document.getElementById('lyXunwuRow1');
  const xw2 = document.getElementById('lyXunwuRow2');
  const qLabel = document.getElementById('lyQuestionLabel');
  const qInput = document.getElementById('lyQuestion');
  if (btn.dataset.mode === 'xunwu') {
    xw1.style.display = 'grid';
    xw2.style.display = 'grid';
    if(qLabel) qLabel.textContent = '寻物描述（描述丢失经过，心诚则灵）';
    if(qInput) qInput.placeholder = '例如：我的黑色钱包昨天不见了';
  } else {
    xw1.style.display = 'none';
    xw2.style.display = 'none';
    if(qLabel) qLabel.textContent = '所问之事（可选）';
    if(qInput) qInput.placeholder = '例如：明日出行是否顺利？';
  }
}
window.selLiuyaoMode = selLiuyaoMode;

async function doLiuyao() {
  const btn = document.getElementById('lyBtn');
  btn.disabled = true; btn.textContent = '排盘中...';
  try {
    const method = state.liuyao.method;
    const mode = state.liuyao.mode || 'normal';
    const question = document.getElementById('lyQuestion').value;
    let enhancedQuestion = question;
    let lostItemName = '';
    if (mode === 'xunwu') {
      lostItemName = document.getElementById('lyLostItem').value.trim();
      if (!lostItemName) { showToast('请输入失物名称', 'error'); btn.disabled = false; btn.textContent = '起卦排盘'; return; }
      const lostPlace = document.getElementById('lyLostPlace').value.trim();
      const lostTime = document.getElementById('lyLostTime').value;
      enhancedQuestion = `寻物占：寻找丢失的${lostItemName}`;
      if (lostPlace) enhancedQuestion += `，丢失地点：${lostPlace}`;
      if (lostTime) {
        const dt = new Date(lostTime);
        enhancedQuestion += `，丢失时间：${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      }
      if (question) enhancedQuestion += `。原描述：${question}`;
    }
    let pan;
    if (method === 'time') {
      pan = window.liuyao.panGua('time', { dt: new Date() });
    } else if (method === 'number') {
      const n1 = +document.getElementById('lyNum1').value || 1;
      const n2 = +document.getElementById('lyNum2').value || 1;
      const n3 = document.getElementById('lyNum3').value;
      pan = window.liuyao.panGua('number', { num1: n1, num2: n2, num3: n3 ? +n3 : null });
    } else if (method === 'coin') {
      pan = window.liuyao.panGua('coin', { dt: new Date() });
    } else {
      pan = window.liuyao.panGua('random', {});
    }
    currentLy = pan;
    renderLiuyao(pan);
    currentLyPrompt = window.liuyao.formatLiuyaoPrompt(pan, enhancedQuestion);
    if (mode === 'xunwu' && lostItemName) {
      const analysis = analyzeXunWu(pan, lostItemName);
      renderXunWuReport(analysis);
    } else {
      document.getElementById('lyXunwuReport').style.display = 'none';
    }
    document.getElementById('lyResult').classList.add('visible');
    document.getElementById('lyAI').style.display = 'block';
    document.getElementById('lyAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '起卦排盘';
  }
}
window.doLiuyao = doLiuyao;

function renderLiuyao(pan) {
  let html = '<div class="result-title">六爻排盘结果</div>';
  html += `<div class="gua-info">`;
  html += `<span>卦名：<strong>${pan.gua.name}</strong></span>`;
  if (pan.gua.dongYaoList && pan.gua.dongYaoList.length > 0) {
    html += `<span>动爻：<strong>第${pan.gua.dongYaoList.join('、')}爻（${pan.gua.dongYaoName}）</strong></span>`;
  } else {
    html += `<span>动爻：<strong style="color:var(--text-muted)">无</strong></span>`;
  }
  html += `</div>`;

  // 铜钱摇卦：显示每爻摇出结果
  if (pan.coinResults && pan.coinResults.length === 6) {
    const labels = ['初爻','二爻','三爻','四爻','五爻','上爻'];
    html += '<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin:0.5rem 0;font-size:0.8rem;">';
    html += '<div style="color:var(--accent-gold);margin-bottom:0.3rem;">🪙 铜钱摇卦记录（从初爻到上爻）</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.3rem;text-align:center;">';
    for (let i = 0; i < 6; i++) {
      const r = pan.coinResults[i];
      const clr = r.isDong ? 'var(--accent-red)' : 'var(--text-primary)';
      html += `<div style="background:var(--bg-card);padding:0.3rem;border-radius:4px;color:${clr};font-size:0.7rem;">`;
      html += `<div style="font-size:0.65rem;color:var(--text-muted);">${labels[i]}</div>`;
      html += `<div style="font-weight:600;">${r.label}</div>`;
      html += `<div style="font-size:0.6rem;color:var(--text-muted);">${r.desc}</div>`;
      html += `</div>`;
    }
    html += '</div></div>';
  }

  html += '<div class="yao-list">';
  for (const yao of [...pan.yaoList].reverse()) {
    const dong = yao.isDong ? '<span class="dong">【动】</span>' : '';
    html += `<div class="yao-item">`;
    html += `<span>${yao.name} ${yao.gan}${yao.zhi}(${yao.wuxing}) ${yao.liuqin} ${yao.liushen}</span>`;
    html += `${dong}</div>`;
  }
  html += '</div>';

  if (pan.huGua) {
    html += `<div style="text-align:center;margin-top:0.5rem;color:var(--text-secondary);font-size:0.8rem;">互卦：${pan.huGua}</div>`;
  }
  document.getElementById('lyResult').innerHTML = html;
}

// ========== 寻物占分析 ==========
var XUNWU_CATEGORIES = {
  '妻财': { keywords: ['钱包','钱','现金','手机','首饰','珠宝','手表','项链','戒指','耳环','黄金','银子','银行卡','信用卡','手表','手镯','玉','翡翠'], description: '金银钱财类' },
  '父母': { keywords: ['身份证','护照','驾照','证件','证书','合同','文件','书本','笔记','钥匙','车钥匙','房本','发票','单据','毕业证','学位证','档案'], description: '文书证件类' },
  '子孙': { keywords: ['猫','狗','宠物','鸟','鱼','动物','玩具','小孩','婴儿','毛孩子','仓鼠','兔子'], description: '动物宠物类' },
  '兄弟': { keywords: ['衣服','裤子','鞋','帽子','伞','包','背包','箱子','工具','锅','碗','水杯','眼镜','围巾','手套','袜子','毛巾','化妆品','梳子'], description: '衣物用品类' },
  '官鬼': { keywords: ['自行车','电动车','汽车','摩托车','锁','门','窗','电器','电脑','平板','耳机','充电器','数据线','U盘','硬盘','相机'], description: '交通工具/电器类' }
};

var XUNWU_DIRECTION = {
  '木': { primary: '东方', secondary: '东南方', reason: '木主东方' },
  '火': { primary: '南方', secondary: '南方', reason: '火主南方' },
  '金': { primary: '西方', secondary: '西北方', reason: '金主西方' },
  '水': { primary: '北方', secondary: '北方', reason: '水主北方' },
  '土': { primary: '中央/原地', secondary: '西南方、东北方', reason: '土主中央' }
};

var XUNWU_ENV = {
  '青龙': { desc: '高处、洁净、明亮处', places: ['柜子上','书架顶层','高处台面','整洁的桌面'], reason: '青龙主高贵洁净' },
  '朱雀': { desc: '文书附近、说话处、喧哗处', places: ['桌上','打印机旁','电视旁','说话交流的地方'], reason: '朱雀主口舌文书' },
  '勾陈': { desc: '地面、土中、陈旧处', places: ['地面','地下','旧物堆','地板缝隙','土堆旁'], reason: '勾陈主土地陈旧' },
  '腾蛇': { desc: '缠绕处、中空物内、拐角', places: ['包里','袋中','缝隙处','管道旁','沙发垫下','被科中'], reason: '腾蛇主缠绕中空' },
  '白虎': { desc: '道路边、金属旁、凶煞处', places: ['路边','金属架旁','车旁','垃圾桶','利器旁'], reason: '白虎主道路金属' },
  '玄武': { desc: '暗处、隐蔽处、水边', places: ['床底','厕所','水池旁','阴暗角落','抽屉深处'], reason: '玄武主阴暗隐蔽' }
};

function classifyLostItem(itemName) {
  if (!itemName) return { category: '妻财', description: '未分类' };
  const name = itemName.toLowerCase();
  for (const [category, info] of Object.entries(XUNWU_CATEGORIES)) {
    for (const kw of info.keywords) {
      if (name.includes(kw.toLowerCase())) { return { category, description: info.description }; }
    }
  }
  return { category: '妻财', description: '贵重物品' };
}

function findYongShen(yaoList, category) {
  for (let i = 0; i < yaoList.length; i++) {
    if (yaoList[i].liuqin === category) { return { position: i, yao: yaoList[i] }; }
  }
  return null;
}

function analyzeXunWu(pan, lostItemName) {
  const classification = classifyLostItem(lostItemName);
  const yongShen = findYongShen(pan.yaoList, classification.category);
  if (!yongShen) return { error: '未能定位用神' };
  const yl = yongShen.yao;
  const isMoving = yl.isDong;
  const direction = XUNWU_DIRECTION[yl.wuxing] || { primary: '未知', reason: '无法确定五行' };
  const environment = XUNWU_ENV[yl.liushen] || { desc: '无法判断', places: [], reason: '六神信息不足' };
  const probLevel = isMoving ? 'high' : 'medium';
  const probPercent = isMoving ? 75 : 55;
  const probReason = isMoving ? '用神发动，化变有力，失物有动向' : '用神安静，需主动寻找';
  const timing = isMoving ? { desc: '3-7日内有望', reason: '动父主变化，近期会有动向' } : { desc: '近期留意', reason: '用神状态平稳' };
  return {
    itemName: lostItemName, category: classification,
    yongShen: { position: yongShen.position + 1, liuqin: yl.liuqin, wuxing: yl.wuxing, liushen: yl.liushen, isMoving },
    direction, environment,
    probability: { level: probLevel, percentage: probPercent, reason: probReason, canFind: true },
    timing
  };
}

function renderXunWuReport(analysis) {
  const report = document.getElementById('lyXunwuReport');
  const grid = document.getElementById('lyXunwuGrid');
  if (!report || !grid) return;
  if (analysis.error) { report.style.display = 'none'; return; }
  report.style.display = 'block';
  const probLabel = analysis.probability.level === 'high' ? '高' : analysis.probability.level === 'medium' ? '中' : '低';
  const probColor = analysis.probability.level === 'high' ? 'var(--accent-green)' : analysis.probability.level === 'medium' ? 'var(--accent-gold)' : 'var(--accent-red)';
  grid.innerHTML = `
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">失物类别 / 用神</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:var(--accent-gold);">${analysis.category.category}父 · ${analysis.category.description}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">「${analysis.itemName}」取${analysis.category.category}为用神，位于第${analysis.yongShen.position}父</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">方位判断</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:var(--accent-gold);">${analysis.direction.primary}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">用神五行属${analysis.yongShen.wuxing||'?'}，${analysis.direction.reason}${analysis.direction.secondary?'，也可留意'+analysis.direction.secondary:''}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">环境特征</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.1rem;font-weight:700;color:var(--accent-gold);">${analysis.environment.desc}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">临${analysis.yongShen.liushen||'?'}六神，${analysis.environment.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">找回概率</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:${probColor};">${analysis.probability.percentage}% · ${probLabel}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">${analysis.probability.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;grid-column:1/-1;">
      <div style="font-size:0.7rem;color:var(--text-muted);">预计找回时间</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.1rem;font-weight:700;color:var(--accent-gold);">${analysis.timing.desc}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">${analysis.timing.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;grid-column:1/-1;">
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.5rem;">具体建议</div>
      <ul style="margin-left:1rem;font-size:0.8rem;color:var(--text-secondary);line-height:1.7;">
        ${analysis.direction.primary!=='未知'?`<li>重点搜索${analysis.direction.primary}区域${analysis.direction.secondary?'及'+analysis.direction.secondary:''}</li>`:''}
        ${analysis.environment.places.length>0?`<li>重点查看：${analysis.environment.places.join('、')}</li>`:''}
        <li>保持信心，细心寻找</li>
        <li>心诚则灵，起卦后第一时间按提示方向寻找成功率最高</li>
      </ul>
    </div>
  `;
}

async function doAILiuyao() {
  if (!currentLyPrompt) return;
  await ensureKB();
  await loadKBGroup('liuyao');
  await window.RAG.build();
  const btn = document.getElementById('lyAIBtn');
  const content = document.getElementById('lyAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentLy.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const abCfg = getActiveABConfig();
    const facts = window.Expert.liuyao(currentLy);
    const ragContent = window.RAG.search(currentLy, currentLy.question, {
      topK: abCfg.topK,
      maxChars: abCfg.maxChars,
      source: '六爻'
    });
    const historyPrompt = getSimilarHistoryPrompt('liuyao', currentLy.gua.name, currentLy.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('liuyao') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('liuyao', currentLy.question) : '';
    let system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbPrimary('liuyao')
      + kbExtended('liuyao', currentLy.question)
      + kbDaoismBuddhismOnDemand(currentLy.question)
      + '\n\n'
      + (function() {
          let instruction = '';
          if (abCfg.useChainOfThought) instruction += window.Expert.chainOfThought('六爻');
          if (abCfg.useFewshot)         instruction += (instruction ? '\n\n' : '') + window.Expert.fewshot('六爻');
          return instruction;
        })();
    if ((state.liuyao.mode || 'normal') === 'xunwu') {
      system += '\n\n【此为寻物占】用户正在寻找丢失的物品。重点解读：方位、距离、环境特征、是否还在原处、找回可能性、最佳时间、具体建议。';
    }
    // v3.0.5: 统一 AI 入口(任务 #19)
    const { finalText } = await Core.AI.interpret({
      domain: 'liuyao',
      prompt: currentLyPrompt,
      system,
      pan: currentLy,
      question: currentLy.question,
      contentEl: content,
      prefix,
      separator,
    });
    saveHistory('liuyao', currentLy.gua.name, currentLy.question || '六爻解读', finalText);
    addFeedbackUI('liuyao', content, finalText, currentLyPrompt, system);
    showResultActions('lyAIContent', 'lyAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error">${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAILiuyao = doAILiuyao;
