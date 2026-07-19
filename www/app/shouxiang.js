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

  // Tier 3 关键点:等图加载完成,同时挂 onerror 处理,防止 corrupt 图让 await 永远 hang
  // (finding C6: img.onerror 永远不 reject)
  // 注意:detectHand 现在是 async,必须 await;并发的同元素 onload 不要互相覆盖
  const imgEl = document.getElementById(previewId);
  if (sxMPEnabled && window.ShouXiangMP?.isReady?.()) {
    try {
      if (!imgEl.complete || imgEl.naturalWidth === 0) {
        await new Promise((resolve, reject) => {
          const onDone = () => { imgEl.onload = null; imgEl.onerror = null; resolve(); };
          imgEl.onload = onDone;
          imgEl.onerror = () => { imgEl.onload = null; imgEl.onerror = null; reject(new Error('image decode fail')); };
          // 30s 兜底超时,避免 corrupt 大图占住 UI
          setTimeout(() => { if (imgEl.onload) onDone(); }, 30000);
        });
      }
      const detection = await window.ShouXiangMP.detectHand(imgEl, sxGender);
      if (detection) {
        const quant = window.ShouXiangMP.quantifyHand(detection);
        sxKeypoints[hand][side] = quant;
        // 在原图上叠加关键点骨架
        drawKeypointsOverlay(imgEl, detection);
        updateSxMPStatus();
        showToast(`✓ ${hand === 'left' ? '左' : '右'}手·${side === 'palm' ? '掌心' : '手背'} 21 关键点检测完成`, 'success');
      } else {
        sxKeypoints[hand][side] = null;
        updateSxMPStatus();
        showToast('⚠️ ' + (hand === 'left' ? '左' : '右') + '手·' + side + ' 未检测到手,请重新拍照(手指展开、掌心清晰)', 'warning');
      }
    } catch (err) {
      console.warn('[sx] keypoint detect fail:', err.message);
      sxKeypoints[hand][side] = null;
    }
  }
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
      const isLeft = sideKey === 'left';
      const cacheKey4 = isLeft ? (side === 'palm' ? 'leftPalm' : 'leftBack')
                                : (side === 'palm' ? 'rightPalm' : 'rightBack');
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

  // Tier 2 联动: 把八字/紫微/三术同参最近一次排盘注入 system prompt
  // 修复 crossLink chain: 三术同参时如果有 liuyao/qimen 也纳入 linkPan,不再只接受 bazi/ziwei 字段
  var linkPan = null;
  var linkSrc = '';
  if (window.currentCross && (window.currentCross.bazi || window.currentCross.ziwei || window.currentCross.liuyao || window.currentCross.qimen)) {
    linkPan = window.currentCross;
    linkSrc = '三术同参';
  } else if (window.currentBazi) {
    linkPan = { bazi: window.currentBazi };
    linkSrc = '八字';
  } else if (window.currentZw) {
    linkPan = { ziwei: window.currentZw };
    linkSrc = '紫微';
  } else if (window.currentLy) {
    linkPan = { liuyao: window.currentLy };
    linkSrc = '六爻';
  } else if (window.currentQm) {
    linkPan = { qimen: window.currentQm };
    linkSrc = '奇门';
  }
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
      resultEl.innerHTML = '<div style="white-space:pre-wrap;">[缓存命中 · ' + imageUrls.length + ' 张图]\n\n' + escapeHtml(cached) + '</div>';
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
    let fullText = '';
    const ctrl = new AbortController();
    Core.AI.setCurrentStreamAbort(ctrl);
    // 计时器只能在 finally 清,不能在 fetch resolve 后清:
    // fetch resolve 只代表 headers 返回,SSE body 可能再 hang 远超 timeoutMs
    // 用 timer 标志区分 user-stop 与 timeout:ctrl.signal.reason = 'sx-timeout' vs default 'user-stop'
    const timer = setTimeout(() => {
      try { ctrl.abort('sx-timeout'); } catch (_) {}
    }, timeoutMs);
    Core.Stream.showStreamIndicator();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let errMsg = 'HTTP ' + res.status;
        try { const j = await res.json(); errMsg = j.error?.message || errMsg; } catch (jsonErr) { console.warn('[sx] parse api error body fail:', jsonErr.message); }
        throw new Error(`${label} HTTP ${res.status}: ${errMsg}`);
      }
      // 支持 SSE 流式
      if (res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8'); // 显式 utf-8,某些 Windows LM 可能兜底是 GBK;TODO: 探测 content-type/encoding
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t || !t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              // 只用 delta.content,避免服务端回 cumulative message.content 导致指数放大
              const delta = j.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                resultEl.innerHTML = '<div style="white-space:pre-wrap;">[' + label + ' · ' + imageUrls.length + ' 张图 · 流式]\n\n' + escapeHtml(fullText) + '</div>';
              }
            } catch (jsonErr) { /* skip non-JSON keepalive */ }
          }
        }
      } else {
        const data = await res.json();
        fullText = data.choices?.[0]?.message?.content?.trim() || '';
      }
      return fullText;
    } finally {
      clearTimeout(timer);
      Core.AI.clearCurrentStreamAbort();
      Core.Stream.hideStreamIndicator();
    }
  }

  // 检测本地模型
  async function checkLocalModel(port) {
    // 用共享 helper,与 ai-service.js 内 callDeepSeek 的 health-check 路径共用
    return typeof Core.AI.pingLocalModel === 'function'
      ? await Core.AI.pingLocalModel(port)
      : await (async () => {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 15000);
            const res = await fetch(`http://${getLocalServerIp()}:${port}/v1/models`, { method: 'GET', signal: ctrl.signal });
            clearTimeout(t);
            return res.ok;
          } catch (e) {
            // CLAUDE.md:catch 内必须有日志 (finding #12:port 探测失败被静默)
            console.warn('[sx] local LLM probe fail on', port + ':', e.message);
            return false;
          }
        })();
  }

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
  if (await checkLocalModel(localPort)) {
    usedSource = `本地 VL (${localPort})`;
    resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在深度思考(最长8分钟)...</div>`;
    try {
      // Core.AI.getLocalModelName() 通过 /v1/models 自动发现 Ollama/llama-server 实际 model 名
      // (round-2 fix:去掉 typeof guard —— getLocalModelName 现已在 Core.AI export 列表里;
      // 旧 fallback `|| 'local'` 会让 Ollama 报 404 'model "local" not found')
      const localModelName = await Core.AI.getLocalModelName();
      fullText = await callMultimodalVision(
        `${getLocalServerUrl()}/v1/chat/completions`,
        { 'Content-Type': 'application/json' },
        { model: localModelName, messages, temperature: 0.15, max_tokens: 4096, stream: true },
        usedSource,
        600000
      );
    } catch (e) {
      // 用户手动停 (⏹) → 不降级云端,直接结束
      // 区分 timeout (10 分钟到) vs user-stop:
      //   timeout: e.name === 'AbortError' 且 ctrl.signal.reason === 'sx-timeout' 或 e.message 含 'timeout'
      //   user-stop: AbortError 但 reason 不含 timeout
      const isTimeoutAbort = e?.name === 'AbortError' && (
        e.message?.includes('timeout') ||
        e.message?.includes('exceeded') ||
        String(e?.cause || '').includes('sx-timeout')
      );
      if (e?.name === 'AbortError' && !isTimeoutAbort) {
        resultEl.innerHTML = '<div class="info">已停止生成。</div>';
        return;
      }
      // timeout / 真错误 → 继续尝试云端 fallback
      const reasonLabel = isTimeoutAbort ? '本地模型超时' : '本地模型失败';
      console.warn(`[sx] ${reasonLabel},降级云端:`, e.message);
      resultEl.innerHTML = `<div class="loading">${reasonLabel}: ${escapeHtml(e.message)} — 切云端...</div>`;
      fullText = '';
    }
  }

  // ========== 云端 VL fallback ==========
  if (!fullText) {
    const vKey = localStorage.getItem('vision_api_key') || '';
    if (!vKey) {
      resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置识图 API Key。<br>请在设置页填写阿里云百炼 API Key，或启动本地 VL 模型。</div>`;
      return;
    }
    usedSource = '云端 VL (DashScope)';
    resultEl.innerHTML = '<div class="loading">调用云端识图(' + imageUrls.length + ' 张图分析)...</div>';
    try {
      const model = localStorage.getItem('vision_model') || 'qwen-vl-plus';
      fullText = await callMultimodalVision(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
        { model, messages, temperature: 0.6, max_tokens: 4096, stream: true },
        usedSource,
        120000
      );
    } catch (e) {
      // (round-2 fix) 用户主动 ⏹ 云端 → 显示'已停止',不显示误导的"本地模型无法连接"
      if (e?.name === 'AbortError') {
        resultEl.innerHTML = '<div class="info">已停止生成。</div>';
        return;
      }
      resultEl.innerHTML = `<div class="error"><strong>分析失败</strong><br>本地模型无法连接，云端模型也未配置或不可用。<br><br><strong>解决步骤：</strong><br>1. 确认手机和电脑在同一WiFi下<br>2. 检查本地模型是否已启动（${localPort}端口）<br>3. 或在设置页配置阿里云百炼API Key<br><br>错误详情: ` + escapeHtml(e.message) + '</div>';
      return;
    }
  }

  fullText = Core.AI.stripThinking(fullText || '');
  if (!fullText) {
    resultEl.innerHTML = '<div class="error">模型返回空内容,请重试</div>';
    return;
  }

  resultEl.innerHTML = '<div style="white-space:pre-wrap;">[' + usedSource + ' · ' + imageUrls.length + ' 张图]\n\n' + escapeHtml(fullText) + '</div>';

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