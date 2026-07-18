// ========== 看手相 ==========
let sxLeftBase64 = '', sxRightBase64 = '', sxGender = 'male';

function compressImage(base64, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64;
  });
}

function setSxGender(gender) {
  sxGender = gender;
  const maleBtn = document.getElementById('sxGenderMale');
  const femaleBtn = document.getElementById('sxGenderFemale');
  if (gender === 'male') {
    maleBtn.style.borderColor = 'var(--accent-gold)';
    maleBtn.style.color = 'var(--accent-gold)';
    maleBtn.style.background = 'var(--bg-primary)';
    femaleBtn.style.borderColor = 'var(--border)';
    femaleBtn.style.color = 'var(--text-secondary)';
    femaleBtn.style.background = 'var(--bg-primary)';
  } else {
    femaleBtn.style.borderColor = 'var(--accent-gold)';
    femaleBtn.style.color = 'var(--accent-gold)';
    femaleBtn.style.background = 'var(--bg-primary)';
    maleBtn.style.borderColor = 'var(--border)';
    maleBtn.style.color = 'var(--text-secondary)';
    maleBtn.style.background = 'var(--bg-primary)';
  }
  // 更新左右手标签
  if (gender === 'male') {
    document.getElementById('sxLeftLabel').textContent = '先天命格';
    document.getElementById('sxRightLabel').textContent = '后天运势';
  } else {
    document.getElementById('sxLeftLabel').textContent = '后天运势';
    document.getElementById('sxRightLabel').textContent = '先天命格';
  }
}
window.setSxGender = setSxGender;

async function onSxFileSelect(e, hand) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result);
    if (hand === 'left') {
      sxLeftBase64 = compressed;
      document.getElementById('sxPreviewLeft').src = sxLeftBase64;
      document.getElementById('sxPreviewWrapLeft').style.display = 'block';
      document.getElementById('sxUploadAreaLeft').style.display = 'none';
    } else {
      sxRightBase64 = compressed;
      document.getElementById('sxPreviewRight').src = sxRightBase64;
      document.getElementById('sxPreviewWrapRight').style.display = 'block';
      document.getElementById('sxUploadAreaRight').style.display = 'none';
    }
    document.getElementById('sxResult').style.display = 'none';
    // 两只手都上传后显示解读按钮
    if (sxLeftBase64 && sxRightBase64) {
      document.getElementById('sxActionArea').style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}
window.onSxFileSelect = onSxFileSelect;

function clearShouxiang() {
  sxLeftBase64 = ''; sxRightBase64 = '';
  document.getElementById('sxFileInputLeft').value = '';
  document.getElementById('sxFileInputRight').value = '';
  document.getElementById('sxPreviewWrapLeft').style.display = 'none';
  document.getElementById('sxPreviewWrapRight').style.display = 'none';
  document.getElementById('sxUploadAreaLeft').style.display = 'block';
  document.getElementById('sxUploadAreaRight').style.display = 'block';
  document.getElementById('sxActionArea').style.display = 'none';
  document.getElementById('sxResult').style.display = 'none';
}
window.clearShouxiang = clearShouxiang;

function sxFlipImage(hand) {
  const base64 = hand === 'left' ? sxLeftBase64 : sxRightBase64;
  if (!base64) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    const flipped = canvas.toDataURL('image/jpeg', 0.9);
    if (hand === 'left') {
      sxLeftBase64 = flipped;
      document.getElementById('sxPreviewLeft').src = flipped;
    } else {
      sxRightBase64 = flipped;
      document.getElementById('sxPreviewRight').src = flipped;
    }
  };
  img.src = base64;
}
window.sxFlipImage = sxFlipImage;

async function doShouxiang() {
  if (!sxLeftBase64 || !sxRightBase64) {
    showToast('请上传左右两只手的手掌照片', 'error');
    return;
  }
  const resultEl = document.getElementById('sxResult');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">AI 正在分析双手手相...</div>';
  await ensureKB();
  await loadKBGroup('shouxiang');

  const isMale = sxGender === 'male';
  const 先天Hand = isMale ? '左手' : '右手';
  const 后天Hand = isMale ? '右手' : '左手';

  const visionPrompt = `请仔细观察以下两张手相照片。

【重要规则：左右手已由用户上传时明确标注，严格按以下顺序分析，不要自行判断方向】
第一张图片 = ${先天Hand}（${先天Hand === '左手' ? '用户上传的左边照片' : '用户上传的右边照片'}）· 先天命格
第二张图片 = ${后天Hand}（${后天Hand === '右手' ? '用户上传的右边照片' : '用户上传的左边照片'}）· 后天运势
用户性别：${isMale ? '男' : '女'}

【性别与左右手分工】
${isMale ? '男性手相：左手代表先天命格（天生底子），右手代表后天运势（实际人生经历）。' : '女性手相：右手代表先天命格（天生底子），左手代表后天运势（实际人生经历）。'}

请对每张照片分别提取结构化信息，并做双手对比：

【${先天Hand} · 先天命格】（第一张图片）
1. 掌型判断（火/水/木/金/土型及理由）
2. 生命线特征（长短、深浅、断裂/岛纹/分叉/链状纹）
3. 智慧线特征
4. 感情线特征
5. 事业线/财运线/婚姻线有无及特征
6. 掌丘丰满度
7. 手指特征
8. 特殊标记（三角纹、十字纹、星纹等）

【${后天Hand} · 后天运势】（第二张图片）
（同上8项）

【双手对比】
9. 两只手纹路的相似度与差异
10. 从先天手到后天手，哪些纹路变深/变浅/新增/消失
11. 这种变化反映的运势转变

请用中文输出结构化观察结果。`;

  // ========== 检测本地模型是否可用 ==========
  async function checkLocalModel(port) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`http://${getLocalServerIp()}:${port}/v1/models`, {
        method: 'GET',
        signal: ctrl.signal
      });
      clearTimeout(t);
      return res.ok;
    } catch (e) {
      console.log('检测端口' + port + '失败:', e.message);
      return false;
    }
  }

  // ========== 架构(任务 #42 固化):
  //   手相图片 → **云端 qwen-vl-plus**(稳定,中文断掌纹好)
  //   文字解读 → **本地 llama-server** b10064 + 35B(44 tok/s,极速)
  //   仅在云端 Key 缺失时才尝试本地 VL(降级路径)
  // ==================================================

  const localPort = getLocalServerPort();
  const hasVL   = await checkLocalModel(localPort);  // 识图模型
  const hasText = await checkLocalModel(localPort);  // 文本模型

  // ========== 本地 VL 一把搞定 ==========
  if (hasVL) {
    try {
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在深度思考（最长8分钟）...</div>`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 600000); // 10分钟，深度思考慢模型需要足够时间，深度思考慢模型需要足够时间
      const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('shouxiang') : '';
      const fullPrompt = `你是一位精通手相学的命理大师。用户性别为${isMale ? '男' : '女'}，传统手相学中${isMale ? '男看左先天右后天' : '女看右先天左后天'}。

【重要规则】
第一张图片 = ${先天Hand} · 先天命格
第二张图片 = ${后天Hand} · 后天运势

请直接观察这两张手相照片，给出完整的命理解读：
1. ${先天Hand}先天命格分析
2. ${后天Hand}后天运势分析
3. 先天到后天的运势变化
4. 健康、事业、财运、感情等方面
5. 两只手差异的含义
6. 改善建议与趋吉避凶

知识库参考：
` + kbPrimary('shouxiang') + kbExtended('shouxiang', '') + (feedbackCalib ? '\n\n' + feedbackCalib : '') + `

【语言约束】所有输出必须使用纯中文，禁止输出任何英文单词、句子或混合中英文内容。禁止输出思考过程、分析步骤、"thinking process"等元内容。`;
      const res = await fetch(`${getLocalServerUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'local',
          messages: [{ role: 'user', content: [
            { type: 'text', text: fullPrompt },
            { type: 'image_url', image_url: { url: sxLeftBase64 } },
            { type: 'image_url', image_url: { url: sxRightBase64 } }
          ] }],
          temperature: 0.15, max_tokens: 4096
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('VL HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
      const cleanText = stripThinking(text);
      resultEl.innerHTML = '<div style="white-space:pre-wrap;">[本地 VL 模型 · 一把搞定]\n\n' + escapeHtml(cleanText) + '</div>';
      return;
    } catch (e) {
      console.log('本地 VL 失败:', e.message);
      resultEl.innerHTML = `<div class="loading">本地 模型(${localPort})失败: ` + escapeHtml(e.message) + '，准备切换云端...</div>';
    }
  }

  // ========== Fallback: 云端 VL 一把搞定 ==========
  const vKey = localStorage.getItem('vision_api_key') || '';
  if (!vKey) {
    resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置识图 API Key。<br>请在设置页填写阿里云百炼 API Key，或启动本地 VL 模型。</div>`;
    return;
  }

  resultEl.innerHTML = '<div class="loading">本地不可用，调用云端识图（双手分析）...</div>';
  try {
    const model = localStorage.getItem('vision_model') || 'qwen-vl-plus';
    const promptText = `你是一位精通手相学的命理大师。用户性别为${isMale ? '男' : '女'}，传统手相学中${isMale ? '男看左先天右后天' : '女看右先天左后天'}。\n\n【重要规则：左右手已由用户上传时明确标注，严格按以下顺序分析】\n第一张图片 = ${先天Hand} · 先天命格\n第二张图片 = ${后天Hand} · 后天运势\n\n请仔细观察这两张手相照片（${先天Hand}和${后天Hand}），从以下维度进行详细分析：\n\n【${先天Hand}分析】（第一张图片）\n1. 掌型（火型、水型、木型、金型、土型）\n2. 三大主线（生命线、智慧线、感情线）\n3. 事业线、财运线、婚姻线等辅助纹路\n4. 掌丘与手指特征\n\n【${后天Hand}分析】（第二张图片）\n（同上）\n\n【双手对比】\n5. 先天到后天的运势变化\n6. 两只手差异的含义\n\n请用通俗易懂的语言给出详细解读。` + kbPrimary('shouxiang') + kbExtended('shouxiang', '') + (window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('shouxiang') : '') + `

【语言约束】所有输出必须使用纯中文，禁止输出任何英文单词、句子或混合中英文内容。禁止输出思考过程、分析步骤、"thinking process"等元内容。`;
    const ctrl3 = new AbortController();
    const t3 = setTimeout(() => ctrl3.abort(), 90000);
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: sxLeftBase64 } },
          { type: 'image_url', image_url: { url: sxRightBase64 } }
        ] }],
        temperature: 0.6, max_tokens: 4096
      }),
      signal: ctrl3.signal
    });
    clearTimeout(t3);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
    const cleanText = stripThinking(text);
    resultEl.innerHTML = '<div style="white-space:pre-wrap;">[云端模型]\n\n' + escapeHtml(cleanText) + '</div>';
  } catch (e) {
    resultEl.innerHTML = `<div class="error"><strong>分析失败</strong><br>本地模型无法连接，云端模型也未配置或不可用。<br><br><strong>解决步骤：</strong><br>1. 确认手机和电脑在同一WiFi下<br>2. 检查本地模型是否已启动（${localPort}端口）<br>3. 或在设置页配置阿里云百炼API Key<br><br>错误详情: ` + escapeHtml(e.message) + '</div>';
  }
}
window.doShouxiang = doShouxiang;
// 拖拽上传
function setupSxDragDrop(areaId, inputId, hand) {
  const area = document.getElementById(areaId);
  const input = document.getElementById(inputId);
  if (!area || !input) return;
  area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = 'var(--accent-gold)'; });
  area.addEventListener('dragleave', e => { e.preventDefault(); area.style.borderColor = 'var(--border)'; });
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      onSxFileSelect({ target: { files: [file] } }, hand);
    }
  });
}
