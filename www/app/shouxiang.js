// ========== 看手相 (Tier 1: 双手掌心+手背 4 张图 + 结构化提示词) ==========
// sxImages[hand][side] = base64  hand: 'left'|'right'  side: 'palm'|'back'
const sxImages = { left: { palm: '', back: '' }, right: { palm: '', back: '' } };
let sxGender = 'male';

function sxGet(hand, side) { return sxImages[hand][side] || ''; }
function sxHasAll() { return sxGet('left','palm') && sxGet('left','back') && sxGet('right','palm') && sxGet('right','back'); }
function sxHasAny() { return sxGet('left','palm') || sxGet('left','back') || sxGet('right','palm') || sxGet('right','back'); }

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
  // 更新左右手标签 (先天/后天)
  if (gender === 'male') {
    document.getElementById('sxLeftLabel').textContent = '先天命格';
    document.getElementById('sxRightLabel').textContent = '后天运势';
  } else {
    document.getElementById('sxLeftLabel').textContent = '后天运势';
    document.getElementById('sxRightLabel').textContent = '先天命格';
  }
}
window.setSxGender = setSxGender;

async function onSxFileSelect(e, hand, side) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result);
    sxImages[hand][side] = compressed;
    const previewId = `sxPreview${hand.charAt(0).toUpperCase() + hand.slice(1)}${side.charAt(0).toUpperCase() + side.slice(1)}`;
    const wrapId = `sxPreviewWrap${hand.charAt(0).toUpperCase() + hand.slice(1)}${side.charAt(0).toUpperCase() + side.slice(1)}`;
    const uploadId = `sxUploadArea${hand.charAt(0).toUpperCase() + hand.slice(1)}${side.charAt(0).toUpperCase() + side.slice(1)}`;
    document.getElementById(previewId).src = compressed;
    document.getElementById(wrapId).style.display = 'block';
    document.getElementById(uploadId).style.display = 'none';
    document.getElementById('sxResult').style.display = 'none';
    if (sxHasAll()) {
      document.getElementById('sxActionArea').style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}
window.onSxFileSelect = onSxFileSelect;

function clearShouxiang() {
  sxImages.left = { palm: '', back: '' };
  sxImages.right = { palm: '', back: '' };
  [['left','palm'], ['left','back'], ['right','palm'], ['right','back']].forEach(function(p) {
    var hand = p[0], side = p[1];
    var cap = hand.charAt(0).toUpperCase() + hand.slice(1);
    var sCap = side.charAt(0).toUpperCase() + side.slice(1);
    var input = document.getElementById('sxFileInput' + cap + sCap);
    if (input) input.value = '';
    var wrap = document.getElementById('sxPreviewWrap' + cap + sCap);
    if (wrap) wrap.style.display = 'none';
    var upload = document.getElementById('sxUploadArea' + cap + sCap);
    if (upload) upload.style.display = 'block';
  });
  document.getElementById('sxActionArea').style.display = 'none';
  document.getElementById('sxResult').style.display = 'none';
}
window.clearShouxiang = clearShouxiang;

function sxFlipImage(hand, side) {
  var base64 = sxGet(hand, side);
  if (!base64) return;
  var img = new Image();
  img.onload = () => {
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    var flipped = canvas.toDataURL('image/jpeg', 0.9);
    sxImages[hand][side] = flipped;
    var cap = hand.charAt(0).toUpperCase() + hand.slice(1);
    var sCap = side.charAt(0).toUpperCase() + side.slice(1);
    document.getElementById('sxPreview' + cap + sCap).src = flipped;
  };
  img.src = base64;
}
window.sxFlipImage = sxFlipImage;

// 构建 4 张图的 Vision prompt (双手 + 掌心/手背)
function buildShouxiangPrompt(先天Hand, 后天Hand, isMale) {
  return `你是一位精通手相学的命理大师。用户性别为${isMale ? '男' : '女'}，传统手相学中${isMale ? '男看左先天右后天' : '女看右先天左后天'}。

【四张图片对应关系】
1️⃣ = ${先天Hand}·掌心 · 先天命格 (主线/纹路/丘位)
2️⃣ = ${先天Hand}·手背 · 先天体征 (指甲/关节/皮肤)
3️⃣ = ${后天Hand}·掌心 · 后天运势 (实际人生轨迹)
4️⃣ = ${后天Hand}·手背 · 后天体征

【关键观察要求 (先观察再推理)】
- 掌心照优先看主线: 生命线(拇指球侧弧)、智慧线(掌心横)、感情线(小指下弧)
- 手背照看: 指甲颜色/形状/半月痕(健康)、关节灵活度、青筋(气血)
- 每只手分两图交叉看,避免单图光线/角度误差

【分析维度 · 每只手按以下8项输出】
1. 掌型 (火/水/木/金/土型 + 理由)
2. 生命线 (长短/深浅/有无断裂/岛纹/分叉/链状)
3. 智慧线 (长短/弧度/分叉/末端朝向)
4. 感情线 (长短/弧度/分叉/有无断裂)
5. 事业线 + 财运线 + 婚姻线 (有无 + 特征)
6. 掌丘丰满度 (木丘/火星丘/土丘等)
7. 手指特征 (长短/指节/指纹)
8. 特殊标记 (三角纹/十字纹/星纹/链状纹/断裂)

【输出格式】
=== ${先天Hand}·先天命格 (掌+背) ===
1-8 项逐项分析...
=== ${后天Hand}·后天运势 (掌+背) ===
1-8 项逐项分析...
=== 双手对比 ===
- 先天到后天哪些纹路变化 (深/浅/新增/消失)
- 反映的运势转变 (事业/感情/健康等)
=== 综合解读 ===
健康、事业、财运、感情、性格、6-12个月运势、具体建议

【语言约束】纯中文输出,禁止英文/思考过程/分析步骤。`;
}

async function doShouxiang() {
  if (!sxHasAny()) {
    showToast('请至少上传一只手的一张手相照片', 'error');
    return;
  }
  const resultEl = document.getElementById('sxResult');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">AI 正在分析手相(4 张图)...</div>';
  await ensureKB();
  await loadKBGroup('shouxiang');

  const isMale = sxGender === 'male';
  const 先天Hand = isMale ? '左手' : '右手';
  const 后天Hand = isMale ? '右手' : '左手';
  const visionPrompt = buildShouxiangPrompt(先天Hand, 后天Hand, isMale);

  // 构造图片数组 (按提示词对应顺序: 先天掌心→先天手背→后天掌心→后天手背)
  const imageUrls = [];
  [['left', 先天Hand], ['right', 后天Hand]].forEach(function(p) {
    var hand = p[0];
    ['palm', 'back'].forEach(function(side) {
      var data = sxGet(hand, side);
      if (data) imageUrls.push({ type: 'image_url', image_url: { url: data } });
    });
  });

  // Tier 2 联动: 把八字/紫微/三术同参最近一次排盘注入 system prompt
  // 从 currentBazi/currentZw/currentCross/currentLy/currentQm 中按优先级取一个
  var linkPan = null;
  var linkSrc = '';
  if (window.currentCross && (window.currentCross.bazi || window.currentCross.ziwei)) {
    linkPan = window.currentCross;
    linkSrc = '三术同参';
  } else if (window.currentBazi) {
    linkPan = { bazi: window.currentBazi };
    linkSrc = '八字';
  } else if (window.currentZw) {
    linkPan = { ziwei: window.currentZw };
    linkSrc = '紫微';
  }
  var linkHint = '';
  if (linkPan) {
    linkHint = `\n\n【已联动】本次手相解读结合用户最新一次${linkSrc}排盘做交叉印证。`;
  }
  const system = await Core.AI.buildSystemPrompt({
    domain: 'shouxiang',
    pan: linkPan,
    question: '',
    extraSystem: (visionPrompt || '') + linkHint
  });

  // 检测本地模型
  async function checkLocalModel(port) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`http://${getLocalServerIp()}:${port}/v1/models`, { method: 'GET', signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch (e) { return false; }
  }

  const localPort = getLocalServerPort();
  const hasVL = await checkLocalModel(localPort);

  // 统一调用: 本地 VL 优先, 失败则降级到云端
  // system 由 Core.AI.buildSystemPrompt 统一组装(含跨域命盘事实 + KB + 反馈)
  // user 内容 = visionPrompt + 4 张图
  const messages = [{
    role: 'user',
    content: [{ type: 'text', text: visionPrompt + '\n\n【语言约束】所有输出必须使用纯中文,禁止英文/思考过程/分析步骤。' }].concat(imageUrls)
  }];

  // ========== 本地 VL 一把搞定 ==========
  if (hasVL) {
    try {
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在深度思考(最长8分钟)...</div>`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 600000);
      const res = await fetch(`${getLocalServerUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'local', system, messages, temperature: 0.15, max_tokens: 4096 }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('VL HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
      const cleanText = stripThinking(text);
      resultEl.innerHTML = '<div style="white-space:pre-wrap;">[本地 VL 模型 · ' + imageUrls.length + ' 张图]\n\n' + escapeHtml(cleanText) + '</div>';
      return;
    } catch (e) {
      console.log('本地 VL 失败:', e.message);
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})失败: ` + escapeHtml(e.message) + '，准备切换云端...</div>';
    }
  }

  // ========== 云端 VL fallback ==========
  const vKey = localStorage.getItem('vision_api_key') || '';
  if (!vKey) {
    resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置识图 API Key。<br>请在设置页填写阿里云百炼 API Key，或启动本地 VL 模型。</div>`;
    return;
  }

  resultEl.innerHTML = '<div class="loading">调用云端识图(' + imageUrls.length + ' 张图分析)...</div>';
  try {
    const model = localStorage.getItem('vision_model') || 'qwen-vl-plus';
    const ctrl3 = new AbortController();
    const t3 = setTimeout(() => ctrl3.abort(), 120000);
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
      body: JSON.stringify({ model, system, messages, temperature: 0.6, max_tokens: 4096 }),
      signal: ctrl3.signal
    });
    clearTimeout(t3);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
    const cleanText = stripThinking(text);
    resultEl.innerHTML = '<div style="white-space:pre-wrap;">[云端模型 · ' + imageUrls.length + ' 张图]\n\n' + escapeHtml(cleanText) + '</div>';
  } catch (e) {
    resultEl.innerHTML = `<div class="error"><strong>分析失败</strong><br>本地模型无法连接，云端模型也未配置或不可用。<br><br><strong>解决步骤：</strong><br>1. 确认手机和电脑在同一WiFi下<br>2. 检查本地模型是否已启动（${localPort}端口）<br>3. 或在设置页配置阿里云百炼API Key<br><br>错误详情: ` + escapeHtml(e.message) + '</div>';
  }
}
window.doShouxiang = doShouxiang;

// 拖拽上传 (适配 4 张图, 每个上传区独立)
function setupSxDragDrop(areaId, inputId, hand, side) {
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
      onSxFileSelect({ target: { files: [file] } }, hand, side);
    }
  });
}