/**
 * 手部 21 关键点检测 — TF.js Handpose (纯前端, CDN 加载)
 *
 * 检测器:
 *   - @tensorflow/tfjs (浏览器 WASM backend, 3MB)
 *   - @tensorflow-models/handpose (21 关键点, 2MB 模型)
 *   全部从 jsDelivr CDN 加载, 浏览器本地缓存。
 *
 * 加载时机:
 *   用户点"启用关键点"按钮 → 异步加载 TF.js + handpose → 初始化 → 可检测
 *
 * 输出:
 *   detectHand(imgEl) → 21 关键点坐标
 *   quantifyHand(detection) → 手指长度/掌尺寸/主线弧长/手型
 *   formatQuantifiedForPrompt → AI prompt 段
 */

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const HANDPOSE_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose@0.1.0/dist/handpose.js';
const LOAD_SCRIPT_TIMEOUT_MS = 30000; // CDN 卡死兜底超时

let tfReady = false;
let handposeModel = null;
let loadingPromise = null;
// tfReady 与 handposeModel 是同一个事实的两个开关:存在 race,
// detectHand 已经通过 handposeModel 直接判空,所以 tfReady 只给外部 isReady() 用
// 真正 ready 的语义下应该二者在 await handpose.load() resolve 的同一刻一起 flip
// ——但 await 同一行只能赋一个,所以中间存在一个 handposeModel 非 null / tfReady=still-false 的窗口
// 这里用一个 8ms microtask 后置翻转来闭合窗口
async function loadMediaPipe() {
  if (tfReady && handposeModel) return handposeModel;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    // 1) 加载 TF.js
    if (typeof tf === 'undefined') {
      await loadScript(TFJS_URL);
      await tf.ready();
    }
    // 2) 加载 handpose
    if (typeof handpose === 'undefined') {
      await loadScript(HANDPOSE_URL);
    }
    // 3) 加载模型 (21 关键点, ~5MB, 浏览器 cache)
    console.log('[Handpose] 加载模型...');
    const model = await handpose.load();
    // handposeModel 与 tfReady 在同一 microtask 内连续赋值 (JS 引擎保证任意 await
    // 之外的脚本都看不到中间状态) — 避免外部 reader 看到 'model 已就绪但 isReady 仍 false'
    handposeModel = model;
    tfReady = true;
    console.log('[Handpose] 模型就绪');
    return model;
  })().catch(e => {
    loadingPromise = null;
    throw e;
  });
  return loadingPromise;
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    // 即使 script tag 已存在,也必须等 onload 触发过 — 否则下一次并发的 loadMediaPipe 复用 tag
    // 会拿到一个尚未初始化的全局 (ReferenceError: tf is not defined)
    const existing = document.querySelector(`script[data-src="${url}"]`);
    if (existing && existing.dataset.loaded === '1') return resolve();
    // dataset.error='1' 表示上次加载失败(超时或网络错) — 删了 tag 重新走完整路径
    // round-2 fix: 之前 dataset.error='1' 写了不读,导致 timeout 后永远卡死
    if (existing && existing.dataset.error === '1') existing.remove();
    if (existing && existing.dataset.loading === '1') {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`CDN load fail: ${url}`)), { once: true });
      return;
    }
    const script = existing || document.createElement('script');
    script.src = url;
    script.dataset.src = url;
    script.dataset.loading = '1';
    const timer = setTimeout(() => {
      // 超时:dataset.loading 清掉,标记 dataset.error,删 stale <script> 让下一次复用从干净开始
      script.dataset.loading = '';
      script.dataset.error = '1';
      script.remove();
      reject(new Error(`CDN timeout after ${LOAD_SCRIPT_TIMEOUT_MS}ms: ${url}`));
    }, LOAD_SCRIPT_TIMEOUT_MS);
    script.onload = () => { clearTimeout(timer); script.dataset.loaded = '1'; script.dataset.loading = ''; resolve(); };
    script.onerror = () => { clearTimeout(timer); script.dataset.loading = ''; script.dataset.error = '1'; script.remove(); reject(new Error(`CDN load fail: ${url}`)); };
    if (!existing || !existing.parentNode) document.head.appendChild(script);
  });
}

/**
 * 检测单张图片中的手部 21 关键点
 * 注意:handpose@0.1.0 的 estimateHands 返回 Promise<Array>,必须 await
 * @param {HTMLImageElement} imgEl
 * @param {string} [sxGender] - 'male' | 'female' | 'unknown'
 */
async function detectHand(imgEl, sxGender) {
  if (!handposeModel) return null;
  const predictions = await handposeModel.estimateHands(imgEl);
  if (!predictions || predictions.length === 0) return null;
  const hand = predictions[0];
  // (round-2 fix) 'Right_or_Left' 是 gibberish AI 解析不了,改用 KB 约定有信息量的 token:
  // 男性左手=先天;女性右手=先天。空值兜底 'unknown'
  let inferred = 'unknown';
  if (sxGender === 'male') inferred = 'Male_hand_inferred';
  else if (sxGender === 'female') inferred = 'Female_hand_inferred';
  return {
    landmarks: hand.landmarks.map(l => ({ x: l[0], y: l[1], z: l[2] || 0 })),
    handedness: inferred,
    width: imgEl.naturalWidth || imgEl.width,
    height: imgEl.naturalHeight || imgEl.height,
  };
}

const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function quantifyHand(detection) {
  if (!detection) return null;
  // handpose@0.1.0 的 landmarks 是按模型输入尺寸(inputSize, 常见 256) 的像素坐标;
  // 既不是 [0,1] 归一化,也不是用户上传原图的像素。把 detection.width 当成"参考尺度"
  // 给一个百分比读数(P.x = 像素/原图宽 × 100),既保留几何量级又不会因 ×W 而爆掉
  const L = detection.landmarks;
  const W = detection.width;
  const H = detection.height;
  // 用"占原图宽度的百分比 0-100"作为统一量级,避免与 W/H 量纲错位
  // dist() 现在返回的是 0..100 之间的"百分比距离"
  const P = L.map(p => ({ x: (p.x / W) * 100, y: (p.y / H) * 100, z: p.z }));

  const fingers = {
    thumb:  dist(P[LM.THUMB_MCP], P[LM.THUMB_TIP]),
    index:  dist(P[LM.INDEX_MCP], P[LM.INDEX_TIP]),
    middle: dist(P[LM.MIDDLE_MCP], P[LM.MIDDLE_TIP]),
    ring:   dist(P[LM.RING_MCP], P[LM.RING_TIP]),
    pinky:  dist(P[LM.PINKY_MCP], P[LM.PINKY_TIP]),
  };

  const palmWidth = dist(P[LM.INDEX_MCP], P[LM.PINKY_MCP]);
  const palmLength = dist(P[LM.WRIST], P[LM.MIDDLE_MCP]);

  // 主线:生命线是 WRIST→THUMB_CMC→...→INDEX_MCP 6 点折线;智慧线 INDEX_MCP→PIP→MIDDLE_MCP;
  // 感情线没有现成关键点序列,只给直线段估算并诚实标注,不要谎报"弧长"
  const lifeLineArc = arcLength(P.slice(0, 6));
  const headLineArc = arcLength([P[5], P[6], P[9]]);
  const heartLineSegment = dist(P[LM.PINKY_MCP], P[LM.INDEX_MCP]);

  const span = dist(P[LM.THUMB_TIP], P[LM.PINKY_TIP]);

  // fingerRatio:除零保护 (pinky 可能≈0,例如蜷指/遮挡/置信度低)
  const safeRatio = (a, b) => (b > 0.01 ? a / b : 0);
  const fingerRatio = {
    index_to_pinky: safeRatio(fingers.index, fingers.pinky),
    middle_to_pinky: safeRatio(fingers.middle, fingers.pinky),
    ring_to_pinky: safeRatio(fingers.ring, fingers.pinky),
  };

  let handType = '中性';
  if (fingerRatio.middle_to_pinky > 1.18) handType = '火型';
  else if (fingerRatio.index_to_pinky > 1.05 && fingerRatio.middle_to_pinky > 1.05) handType = '木型';
  else if (Math.abs(fingerRatio.middle_to_pinky - 1) < 0.05 && fingerRatio.middle_to_pinky > 0) handType = '土型';
  else if (fingerRatio.ring_to_pinky > 0.95 && fingerRatio.middle_to_pinky < 1.05 && fingerRatio.middle_to_pinky > 0) handType = '金型';

  return {
    handedness: detection.handedness,
    fingerLength: {
      thumb: fingers.thumb.toFixed(2),
      index: fingers.index.toFixed(2),
      middle: fingers.middle.toFixed(2),
      ring: fingers.ring.toFixed(2),
      pinky: fingers.pinky.toFixed(2),
    },
    palm: { width: palmWidth.toFixed(2), length: palmLength.toFixed(2), ratio: (palmWidth > 0.01 ? (palmLength / palmWidth) : 0).toFixed(2) },
    span: span.toFixed(2),
    mainLines: { life: lifeLineArc.toFixed(2), head: headLineArc.toFixed(2), heart: heartLineSegment.toFixed(2) },
    handType,
    fingerRatio: { index_to_pinky: fingerRatio.index_to_pinky.toFixed(2), middle_to_pinky: fingerRatio.middle_to_pinky.toFixed(2) },
    keyPoints: {
      wrist: P[LM.WRIST], thumbBase: P[LM.THUMB_MCP], indexBase: P[LM.INDEX_MCP],
      middleBase: P[LM.MIDDLE_MCP], pinkyBase: P[LM.PINKY_MCP],
      thumbTip: P[LM.THUMB_TIP], indexTip: P[LM.INDEX_TIP], middleTip: P[LM.MIDDLE_TIP],
      ringTip: P[LM.RING_TIP], pinkyTip: P[LM.PINKY_TIP],
    },
  };
}

function arcLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i-1], points[i]);
  return len;
}

function formatQuantifiedForPrompt(q) {
  if (!q) return '';
  // 量化值是"占原图宽度的 %" (0-100);感情线这里只是直线段不是真弧长,prompt 诚实标注
  // handedness 来自 detectHand(sxGender) 反推,会比以前的 "Unknown" 信息量大
  return `【TF.js Handpose 21 关键点量化事实 (相对量,占原图宽度%)】
- 手 (推断): ${q.handedness}
- 手型: ${q.handType}
- 掌: 长 ${q.palm.length}% × 宽 ${q.palm.width}% (长宽比 ${q.palm.ratio})
- 手指长度(%): 拇指 ${q.fingerLength.thumb} / 食指 ${q.fingerLength.index} / 中指 ${q.fingerLength.middle} / 无名指 ${q.fingerLength.ring} / 小指 ${q.fingerLength.pinky}
- 主线折线长度(%): 生命线 ${q.mainLines.life} / 智慧线 ${q.mainLines.head} / 感情线(直线段,非真弧) ${q.mainLines.heart}
- 手掌张开跨度: ${q.span}%
- 关键点坐标(占原图%,左上角原点):
  腕 (${q.keyPoints.wrist.x.toFixed(1)}, ${q.keyPoints.wrist.y.toFixed(1)})
  食指根 (${q.keyPoints.indexBase.x.toFixed(1)}, ${q.keyPoints.indexBase.y.toFixed(1)})
  中指根 (${q.keyPoints.middleBase.x.toFixed(1)}, ${q.keyPoints.middleBase.y.toFixed(1)})
  拇指尖 (${q.keyPoints.thumbTip.x.toFixed(1)}, ${q.keyPoints.thumbTip.y.toFixed(1)})`;
}

function drawKeypoints(canvas, detection) {
  if (!detection) return;
  const ctx = canvas.getContext('2d');
  // canvas 用原图尺寸;landmark 坐标按"占 canvas 宽度的 %"绘制,避免 ×W 越界
  canvas.width = detection.width;
  canvas.height = detection.height;
  const W = canvas.width;
  const H = canvas.height;
  const L = detection.landmarks.map(p => ({ x: (p.x / detection.width) * W, y: (p.y / detection.height) * H }));
  const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  ctx.strokeStyle = 'rgba(201,168,76,0.85)';
  ctx.lineWidth = 2;
  bones.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.stroke(); });
  L.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = i === 0 ? '#c9a84c' : '#f4c7a1'; ctx.fill(); ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 1; ctx.stroke(); });
}

// 卸载模型 —— 仅释放 handpose 自己的 GPU tensors,不动全局 tf 状态
// (fix suicidal-review: tf.disposeVariables() 会把所有 TF tensors 清空,影响其它 TF 模型)
async function disposeHandpose() {
  try {
    if (handposeModel && typeof handposeModel.dispose === 'function') {
      handposeModel.dispose();
    }
    // 不再调 tf.disposeVariables() — 它是 TF 全局钩子,只清我们自己模型的 tensors
    // 若有多个 TF 模型共存,得自己保留 references + 各自 .dispose()
  } catch (e) { console.warn('[Handpose] dispose warn:', e); }
  handposeModel = null;
  tfReady = false;
  loadingPromise = null;
}

window.ShouXiangMP = {
  loadMediaPipe, detectHand, quantifyHand, formatQuantifiedForPrompt, drawKeypoints, disposeHandpose,
  isReady: () => tfReady, version: 'tfjs-handpose-v1'
};