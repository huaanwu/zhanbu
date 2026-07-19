// ========== 看手相 (Tier 1: 双手掌心+手背 4 张图 + 结构化提示词) ==========
// sxImages[hand][side] = base64  hand: 'left'|'right'  side: 'palm'|'back'
// sxKeypoints[hand][side] = MediaPipe 量化结果 (可选, 启用 MediaPipe 后填充)
// shouxiang-mp.js 通过 type=module script 标签加载,挂到 window.ShouXiangMP
const sxImages = { left: { palm: '', back: '' }, right: { palm: '', back: '' } };
const sxKeypoints = { left: { palm: null, back: null }, right: { palm: null, back: null } };
let sxGender = 'male';
let sxMPEnabled = false;  // 用户是否启用 MediaPipe 关键点检测

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
  reader.onload = ev => {
    (async () => {
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

      // Tier 3 关键点: fire-and-forget (后台跑,不阻塞上传流程)
      // 之前临时屏蔽验证主流程通过,现在恢复
      if (sxMPEnabled && window.ShouXiangMP?.isReady?.()) {
        const imgEl = document.getElementById(previewId);
        Promise.race([
          window.ShouXiangMP.detectHand(imgEl, sxGender),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000))
        ]).then((detection) => {
          if (detection) {
            const quant = window.ShouXiangMP.quantifyHand(detection);
            sxKeypoints[hand][side] = quant;
            drawKeypointsOverlay(imgEl, detection);
            updateSxMPStatus();
            showToast(`✓ ${hand === 'left' ? '左' : '右'}手·${side === 'palm' ? '掌心' : '手背'} 21 关键点检测完成`, 'success');
          } else {
            sxKeypoints[hand][side] = null;
            updateSxMPStatus();
            showToast('⚠️ ' + (hand === 'left' ? '左' : '右') + '手·' + side + ' 未检测到手,请重新拍照(手指展开、掌心清晰)', 'warning');
          }
        }).catch((err) => {
          console.warn('[sx] keypoint detect fail:', err.message);
          sxKeypoints[hand][side] = null;
        });
      }
    })();
  };
  reader.readAsDataURL(file);
}

// 在 img 上叠加 canvas 显示关键点骨架
function drawKeypointsOverlay(imgEl, detection) {
  if (!window.ShouXiangMP?.drawKeypoints) return;
  let canvas = imgEl.nextElementSibling;
  // 每次新上传都把旧 canvas 删了重建,避免 offsetTop/offsetLeft 漂移
  // 修复 finding #5:旧实现 cache 了第一次的 offset,后续重绘还在老位置
  if (canvas && canvas.classList?.contains('sx-kp-overlay')) {
    canvas.remove();
    canvas = null;
  }
  canvas = document.createElement('canvas');
  canvas.className = 'sx-kp-overlay';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  if (getComputedStyle(imgEl.parentElement).position === 'static') {
    imgEl.parentElement.style.position = 'relative';
  }
  imgEl.parentElement.appendChild(canvas);
  window.ShouXiangMP.drawKeypoints(canvas, detection);
}
window.onSxFileSelect = onSxFileSelect;

function clearShouxiang() {
  sxImages.left = { palm: '', back: '' };
  sxImages.right = { palm: '', back: '' };
  sxKeypoints.left = { palm: null, back: null };
  sxKeypoints.right = { palm: null, back: null };
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
    // 同时把上一个 drawKeypointsOverlay 留下的 .sx-kp-overlay canvas 也清掉
    // 修复 finding #5:clearShouxiang 之前只 display:none wrap,canvas 残留在 DOM 里
    var preview = document.getElementById('sxPreview' + cap + sCap);
    if (preview) {
      var next = preview.nextElementSibling;
      if (next && next.classList?.contains('sx-kp-overlay')) next.remove();
    }
  });
  document.getElementById('sxActionArea').style.display = 'none';
  document.getElementById('sxResult').style.display = 'none';
  updateSxMPStatus();
}
window.clearShouxiang = clearShouxiang;

// MediaPipe 关键点开关 + 状态显示
function updateSxMPStatus() {
  var statusEl = document.getElementById('sxMPStatus');
  var btn = document.getElementById('sxMPToggleBtn');
  if (!statusEl || !btn) return;
  if (!sxMPEnabled) {
    statusEl.textContent = '未启用';
    statusEl.style.color = 'var(--text-muted)';
    btn.textContent = '启用关键点';
    btn.style.background = 'var(--accent-gold)';
    return;
  }
  var ready = window.ShouXiangMP?.isReady?.();
  if (ready) {
    var done = sxKeypoints.left.palm || sxKeypoints.left.back || sxKeypoints.right.palm || sxKeypoints.right.back;
    statusEl.textContent = done ? '✓ 已检测' : '就绪';
    statusEl.style.color = done ? 'var(--accent-green)' : 'var(--accent-gold)';
    btn.textContent = '已启用';
    btn.style.background = 'var(--bg-inner)';
  } else {
    statusEl.textContent = '加载中...';
    statusEl.style.color = 'var(--accent-gold)';
  }
}

async function sxToggleMediaPipe() {
  if (sxMPEnabled && window.ShouXiangMP?.isReady?.()) {
    // 关闭:卸载模型释放 GPU 张量 (finding #13) + 清掉用户数据
    sxMPEnabled = false;
    sxKeypoints.left = { palm: null, back: null };
    sxKeypoints.right = { palm: null, back: null };
    // 把 .sx-kp-overlay 残 canvas 也清掉
    document.querySelectorAll('.sx-kp-overlay').forEach(n => n.remove());
    try { await window.ShouXiangMP.disposeHandpose?.(); } catch (e) { console.warn('[sx] handpose dispose warn:', e.message); }
    updateSxMPStatus();
    showToast('已关闭 AI 关键点检测', 'info');
    return;
  }
  // 启用:加载 TF.js handpose
  sxMPEnabled = true;
  updateSxMPStatus();
  try {
    showToast('正在加载 MediaPipe Hands 模型...', 'info');
    await window.ShouXiangMP.loadMediaPipe();
    updateSxMPStatus();
    showToast('MediaPipe 加载完成,上传图时自动检测', 'success');
  } catch (e) {
    sxMPEnabled = false;
    // 加载失败也要 dispose 掉半加载的 model (finding #2 risk)
    try { await window.ShouXiangMP.disposeHandpose?.(); } catch (disposeErr) { console.warn('[sx] handpose dispose warn:', disposeErr.message); }
    updateSxMPStatus();
    showToast('MediaPipe 加载失败,降级为纯 AI 解读: ' + e.message, 'error');
  }
}
window.sxToggleMediaPipe = sxToggleMediaPipe;

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
    // 翻转后关键点坐标是镜像前的,必须清掉避免把 stale keypoints 发给 AI
    // 修复 finding #2:sxFlipImage 不清 sxKeypoints
    sxKeypoints[hand][side] = null;
    updateSxMPStatus();
    var cap = hand.charAt(0).toUpperCase() + hand.slice(1);
    var sCap = side.charAt(0).toUpperCase() + side.slice(1);
    var preview = document.getElementById('sxPreview' + cap + sCap);
    if (preview) {
      preview.src = flipped;
      // 同一张图残 canvas 也清掉
      var next = preview.nextElementSibling;
      if (next && next.classList?.contains('sx-kp-overlay')) next.remove();
    }
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

// ===== doShouxiang 帮助函数 (v3.0.6 cleanup) =====
// 统一渲染调用结果 — 避免 pre-wrap + escapeHtml 在 3 处重复(cache-hit / streaming / final)
function renderSx(label, text) {
  resultEl.innerHTML = '<div style="white-space:pre-wrap;">[' + label + ' · ' + imageUrls.length + ' 张图]\n\n' + escapeHtml(text) + '</div>';
}
// 从 window.current* 全局中取第一个有效命盘,返回 {pan, src} 或 null
function pickLinkPan() {
  if (window.currentCross && (window.currentCross.bazi || window.currentCross.ziwei || window.currentCross.liuyao || window.currentCross.qimen)) {
    return { pan: window.currentCross, src: '三术同参' };
  }
  if (window.currentBazi) return { pan: { bazi: window.currentBazi }, src: '八字' };
  if (window.currentZw)  return { pan: { ziwei: window.currentZw }, src: '紫微' };
  if (window.currentLy)  return { pan: { liuyao: window.currentLy }, src: '六爻' };
  if (window.currentQm)  return { pan: { qimen: window.currentQm }, src: '奇门' };
  return null;
}

async function doShouxiang() {
  console.log("[sx] doShouxiang 入口, images:", JSON.stringify(Object.keys(sxImages).map(function(h){return [h,Object.keys(sxImages[h]).filter(function(s){return !!sxImages[h][s]}).join(",")];})), "localPort:", getLocalServerPort(), "localUrl:", getLocalServerUrl());
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
  // 男左先天/右后天; 女右先天/左后天(传统手相学)
  const 先天Hand = isMale ? '左手' : '右手';
  const 后天Hand = isMale ? '右手' : '左手';
  // 物理手映射: sxImages[sxImagesKey] 存文件, 左 = 'left'
  const 先天Side = isMale ? 'left' : 'right';
  const 后天Side = isMale ? 'right' : 'left';

  // Tier 3: MediaPipe 量化事实 (如果有)
  // 去掉之前的 3 行 truncated back-of-hand 截断 —— 要么全输出要么不输出
  // (finding #2:formatQuantifiedForPrompt(back).slice(0,3) 是信息损失的 hack)
  var quantFacts = '';
  [[先天Side, 先天Hand], [后天Side, 后天Hand]].forEach(function(p) {
    var sideKey = p[0], handName = p[1];
    var palm = sxKeypoints[sideKey].palm, back = sxKeypoints[sideKey].back;
    if (palm || back) {
      quantFacts += '\n【' + handName + '·Tier-3 量化】\n';
      if (palm) quantFacts += window.ShouXiangMP.formatQuantifiedForPrompt(palm) + '\n';
      if (back) quantFacts += window.ShouXiangMP.formatQuantifiedForPrompt(back) + '\n';
    }
  });
  if (quantFacts) quantFacts = '\n\n【量化锚点 (TF.js Handpose 21 关键点 · 相对量,占原图宽 %)】\n' + quantFacts;

  // visionPrompt 是 user-side 的内容,绝不进 system (避免双发 / 同时丢)
  // 之前 quantFacts 既塞 extraSystem 又塞 user,这条 PR 已经合并
  var visionPrompt = buildShouxiangPrompt(先天Hand, 后天Hand, isMale) + quantFacts;

  // 构造图片数组 (按提示词对应顺序: 先天掌心→先天手背→后天掌心→后天手背)
  const imageUrls = [];
  const missingSlots = [];
  // 同时构造 cache key 用的 images 字典 (修复 Cache.makeKey 4图字段)
  const imagesForCache = {};
  [[先天Side, 先天Hand], [后天Side, 后天Hand]].forEach(function(p) {
    var sideKey = p[0], handName = p[1];
    ['palm', 'back'].forEach(function(side) {
      var data = sxGet(sideKey, side);
      const cacheKey4 = sideKey + (side === 'palm' ? 'Palm' : 'Back');
      if (data) {
        imagesForCache[cacheKey4] = data;
        imageUrls.push({ type: 'image_url', image_url: { url: data } });
      } else {
        missingSlots.push(`${handName}·${side === 'palm' ? '掌心' : '手背'}`);
      }
    });
  });
  if (missingSlots.length) {
    visionPrompt += `\n\n【缺失照片】以下位置用户未上传,解读时不要瞎编:${missingSlots.join('、')}`;
  }

  // Tier 2 联动: pickLinkPan() 遍历全局命盘,返回命盘对象 + 来源标签
  const link = pickLinkPan();
  const linkPan = link ? link.pan : null;
  const linkSrc = link ? link.src : '';
  var linkHint = '';
  if (linkPan) {
    linkHint = `\n\n【已联动】本次手相解读结合用户最新一次${linkSrc}排盘做交叉印证。`;
  }
  const system = await Core.AI.buildSystemPrompt({
    domain: 'shouxiang',
    pan: linkPan,
    question: '',
    extraSystem: linkHint
  });

  // v3.0.6:Cache 命中先返回 (避免重复付费 + 重复等待)
  const Cache = window.Cache;
  const hasAnyKPs = sxKeypoints.left.palm || sxKeypoints.left.back || sxKeypoints.right.palm || sxKeypoints.right.back;
  const cacheParams = {
    linkPan: linkPan || null,
    images: imagesForCache,
    keypoints: hasAnyKPs ? 1 : 0,
    sxGender: sxGender,
    question: '',
  };
  const sxCacheKey = Cache ? Cache.makeKey('shouxiang', cacheParams) : null;
  if (sxCacheKey) {
    const cached = Cache.get('shouxiang', cacheParams);
    if (cached) {
      renderSx('缓存命中', cached);
      finalizeShouxiang(resultEl, cached);
      return;
    }
  }

  // ========== 通用 VL 调用封装 (本地→云端 fallback + 流式 + abort) ==========
  // interpret() 不支持 multimodal,所以这里手写一个 multimodal 版,但复用
  // Core.Stream 的 indicator + Core.AI 的 abort 管理,保持 v3.0.5 全局状态一致
  // note: 下面直接调 Core.AI.setCurrentStreamAbort / clearCurrentStreamAbort,
  // 不再需要 _setAbort 闭包胶水 — callMultimodalVision 内部一个 try/finally 直接接 Core.AI.

  async function callMultimodalVision(endpoint, headers, body, label, timeoutMs) {
    const bodyJson = JSON.stringify(Object.assign({}, body, { stream: true }));
    console.log("[sx] callMultimodalVision endpoint:", endpoint, "body大小:", bodyJson.length, "bytes");
    // 恢复流式: 本地模型返回 ReadableStream (SSE), 边收边显示
    // 之前 signal is aborted 是因为 fetch+signal 在 WebView 里挂,现在不用 signal
    const timeoutMsFinal = timeoutMs || 60000;
    const startTime = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort('sx-timeout'); } catch (_) {} }, timeoutMsFinal);
    Core.Stream.showStreamIndicator();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: bodyJson,
      });
      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const j = await res.json(); errMsg = j.error?.message || errMsg; } catch (jsonErr) { console.warn('[sx] parse api error body fail:', jsonErr.message); }
        throw new Error(`${label} HTTP ${res.status}: ${errMsg}`);
      }
      // 流式解析: res.body 是 ReadableStream (SSE), 用 Core.AI.readSSE 读
      if (res.body && typeof res.body.getReader === 'function' && res.headers.get('content-type')?.includes('text/event-stream')) {
        const fullText = await Core.AI.readSSE(res.body, function (_delta, content) {
          var el = document.getElementById('sxResult');
          if (el) {
            if (!el._sxResultInited) {
              el.innerHTML = '';
              el._sxResultInited = true;
            }
            el.textContent = '[' + label + ' · 1 张图 · 流式]\n\n' + content;
          }
        });
        return fullText;
      } else {
        // 兼容非流式(如果服务器不支持 SSE)
        const data = await res.json();
        return (data.choices?.[0]?.message?.content?.trim() || '');
      }
    } catch (e) {
      clearTimeout(timer);
      throw e;
    } finally {
      clearTimeout(timer);
      Core.Stream.hideStreamIndicator();
    }
  }
  // 检测本地模型 (Core.AI.pingLocalModel 已在 core/ai-service.js export)
  async function checkLocalModel(port) { return await Core.AI.pingLocalModel(port); }

  // messages 构造:system → role=system message;user → 文本 + image_url 内容块列表
  // (修复 finding P1-5:OpenAI/DashScope 不认顶层 system 字段,会被静默丢弃)
  // (修复 finding P1-7:visionPrompt 只发 user 一份,不再双发)
  const messages = [
    { role: 'system', content: system || '' },
    { role: 'user', content: [{ type: 'text', text: visionPrompt }].concat(imageUrls) }
  ];

  const localPort = getLocalServerPort();
  let fullText = '';
  let usedSource = '';

  // ========== 本地 VL 一把搞定 ==========
  // getLocalServerUrl = http://{local_server_ip}:{local_server_port}
  // 手机上 IP 默认是 127.0.0.1 → 手机自己的 IP,不是电脑!

  // ping: 探测 /v1/models
  const localAlive = await checkLocalModel(localPort);
  // (诊断):把 endpoint 显示给用户,看实际发了哪
  resultEl.innerHTML = `<div class="loading">ping ${getLocalServerUrl()}/v1/models ...</div>`;
  if (localAlive) {
    usedSource = `本地 VL (${localPort})`;
    try {
      const localModelName = (typeof Core.AI === 'object' && typeof Core.AI.getLocalModelName === 'function'
        ? await Core.AI.getLocalModelName()
        : (localStorage.getItem('local_model_name') || 'local'));

      // 一次发4张图 + 流式: 正确的手相解读方式
      // 之前拆4张独立请求导致每张只能看1张图,模型没全局观
      // 改回4张一起发,但用 SSE 流式输出逐步显示
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在分析${imageUrls.length}张图片...<br><small>当前模型: ${localModelName} | endpoint: ${getLocalServerUrl()}</small></div>`;
      fullText = await callMultimodalVision(
        `${getLocalServerUrl()}/v1/chat/completions`,
        { 'Content-Type': 'application/json' },
        { model: localModelName, messages, temperature: 0.15, max_tokens: 4096, stream: true },
        usedSource,
        600000
      );
    } catch (e) {
      const isTimeoutAbort = e?.name === 'AbortError' && (
        e.message?.includes('timeout') ||
        e.message?.includes('exceeded') ||
        String(e?.cause || '').includes('sx-timeout')
      );
      if (e?.name === 'AbortError' && !isTimeoutAbort) {
        resultEl.innerHTML = '<div class="info">已停止生成。</div>';
        return;
      }
      const reasonLabel = isTimeoutAbort ? '本地模型超时' : '本地模型失败';
      console.warn(`[sx] ${reasonLabel},降级云端:`, e.message);
      resultEl.innerHTML = `<div class="loading">${reasonLabel}: ${escapeHtml(e.message)} — 切云端...</div>`;
      fullText = '';
    }
  } else {
    // 模型不可达 → 直接进入云端 fallback (页面保持 loading)
    console.warn('[sx] 本地模型 ' + getLocalServerUrl() + ' 不可达');
  }

  // ========== 云端 VL fallback (DeepSeek,任务 #42 统一 DeepSeek) ==========
  if (!fullText) {
    const vKey = localStorage.getItem('ds_api_key') || '';
    if (!vKey) {
      resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置 DeepSeek API Key。<br>请在设置页填写 DeepSeek API Key，或启动本地 VL 模型。</div>`;
      return;
    }
    usedSource = '云端 DeepSeek (VL)';
    resultEl.innerHTML = '<div class="loading">调用云端识图(' + imageUrls.length + ' 张图分析)...</div>';
    try {
      // 与其他域统一:deepseek-v4-flash 走 DeepSeek, 与其他域一致(不再用 DashScope)
      const model = localStorage.getItem('vision_model') || 'deepseek-v4-flash';
      fullText = await callMultimodalVision(
        (localStorage.getItem('ds_base_url') || 'https://api.deepseek.com/v1').replace(/\/v1\/?$/, '') + '/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
        { model, messages, temperature: 0.6, max_tokens: 4096, stream: true },
        usedSource,
        120000
      );
    } catch (e) {
      if (e?.name === 'AbortError') {
        resultEl.innerHTML = '<div class="info">已停止生成。</div>';
        return;
      }
      resultEl.innerHTML = `<div class="error"><strong>分析失败</strong><br>本地模型无法连接，云端模型也未配置或不可用。<br><br><strong>解决步骤：</strong><br>1. 确认手机和电脑在同一WiFi下<br>2. 检查本地模型是否已启动（${localPort}端口）<br>3. 或在设置页配置 DeepSeek API Key<br><br>错误详情: ` + escapeHtml(e.message) + '</div>';
      return;
    }
  }

  fullText = Core.AI.stripThinking(fullText || '');
  if (!fullText) {
    resultEl.innerHTML = '<div class="error">模型返回空内容,请重试</div>';
    return;
  }

  renderSx(usedSource, fullText);

  // 写缓存
  if (sxCacheKey && fullText) {
    try { Cache.set('shouxiang', cacheParams, fullText); }
    catch (e) { console.warn('[sx] cache set fail:', e); }
  }

  // v3.0.6 v3.0.5 收尾:历史 + 反馈 + 工具栏 + 事件派发
  finalizeShouxiang(resultEl, fullText);
}

// 把手相解读结果"完整收尾"——保存历史、加反馈 UI、显示工具栏、派发 AI_COMPLETE 事件
// 抽出来让 cache-hit 与正常完成路径共用
function finalizeShouxiang(resultEl, fullText) {
  try { window.saveHistory?.('shouxiang', 'shouxiang-' + Date.now(), '手相解读', fullText); } catch (e) { console.warn('[sx] saveHistory:', e); }
  try { window.addFeedbackUI?.('shouxiang', resultEl, fullText, '', ''); } catch (e) { console.warn('[sx] addFeedbackUI:', e); }
  try { window.showResultActions?.('sxResult', 'sxResultActions'); } catch (e) { console.warn('[sx] showResultActions:', e); }
  try {
    const bus = window.EventBus; const evName = window.CoreEvents?.AI_COMPLETE;
    if (bus && evName) bus.dispatchEvent(new CustomEvent(evName, { detail: { domain: 'shouxiang', outputText: fullText, contentEl: resultEl } }));
  } catch (e) { console.warn('[sx] AI_COMPLETE dispatch:', e); }
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