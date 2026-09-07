// ========== 看面相 (Tier 1: 正面 + 左45° + 右45° 3 张图 + 性别 + 年龄段) ==========
// v3.0.8 接入:
//   - 算盘层:KB mianxiang_ext/twelve_palaces/五官/气色(无确定性算法,纯 KB)
//   - AI 视觉:Core.AI.callMultimodalVision(从 shouxiang.js 提到 core,共享)
//   - 联动:八字/紫微(linkPan)交叉印证

const mxImages = { front: '', left45: '', right45: '' };
let mxGender = 'male';
let mxAgeBucket = '30-45';  // 默认 30-45 岁
// v3.0.8:index.html onchange="mxAgeBucket=this.value" 需要访问 window.mxAgeBucket
Object.defineProperty(window, 'mxAgeBucket', {
  get() { return mxAgeBucket; },
  set(v) { mxAgeBucket = v; }
});

function mxGet(view) { return mxImages[view] || ''; }
function mxHasAny() { return mxImages.front || mxImages.left45 || mxImages.right45; }

// 复用 shouxiang 的压缩函数(全局 window.compressImage)
// 上传时由 app.js 加载顺序保证 shouxiang.js 先于 mianxiang.js,compressImage 已挂到 window
function compressImageAvailable() { return typeof window.compressImage === 'function'; }

function setMxGender(gender) {
  mxGender = gender;
  const maleBtn = document.getElementById('mxGenderMale');
  const femaleBtn = document.getElementById('mxGenderFemale');
  if (!maleBtn || !femaleBtn) return;
  if (gender === 'male') {
    maleBtn.style.borderColor = 'var(--accent-gold)'; maleBtn.style.color = 'var(--accent-gold)';
    femaleBtn.style.borderColor = 'var(--border)';     femaleBtn.style.color = 'var(--text-secondary)';
  } else {
    femaleBtn.style.borderColor = 'var(--border)';     maleBtn.style.color = 'var(--text-secondary)';
    femaleBtn.style.borderColor = 'var(--accent-gold)'; femaleBtn.style.color = 'var(--accent-gold)';
  }
}
window.setMxGender = setMxGender;

async function onMxFileSelect(e, view) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!compressImageAvailable()) {
    console.warn('[mx] compressImage 不可用,跳过压缩直接读 base64');
  }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const raw = ev.target.result;
    const compressed = compressImageAvailable() ? await window.compressImage(raw) : raw;
    mxImages[view] = compressed;
    const capView = view === 'left45' ? 'Left45' : view === 'right45' ? 'Right45' : 'Front';
    const previewId = `mxPreview${capView}`;
    const wrapId = `mxPreviewWrap${capView}`;
    const uploadId = `mxUploadArea${capView}`;
    document.getElementById(previewId).src = compressed;
    document.getElementById(wrapId).style.display = 'block';
    document.getElementById(uploadId).style.display = 'none';
    document.getElementById('mxResult').style.display = 'none';
    // v3.0.8:任一张图上传就显示 AI 解读按钮(单张也能解读,3 张精度更高)
    if (mxHasAny()) {
      var act = document.getElementById('mxActionArea');
      if (act) act.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}
window.onMxFileSelect = onMxFileSelect;

// 清空(给"重新上传"按钮用,目前 UI 没暴露,先留作 API)
function clearMianxiang() {
  mxImages.front = ''; mxImages.left45 = ''; mxImages.right45 = '';
  ['Front', 'Left45', 'Right45'].forEach(function (cap) {
    var wrap = document.getElementById('mxPreviewWrap' + cap);
    var upload = document.getElementById('mxUploadArea' + cap);
    var input = document.getElementById('mxFileInput' + cap);
    if (wrap) wrap.style.display = 'none';
    if (upload) upload.style.display = 'block';
    if (input) input.value = '';
  });
  var act = document.getElementById('mxActionArea');
  if (act) act.style.display = 'none';
  var result = document.getElementById('mxResult');
  if (result) result.style.display = 'none';
}
window.clearMianxiang = clearMianxiang;

// ===== prompt 构造 =====
function buildMianxiangPrompt(isMale, ageBucket) {
  const ageMap = { '<18':'未成年','18-30':'青年','30-45':'壮年','45-60':'中年','60+':'中老年' };
  const ageLabel = ageMap[ageBucket] || '壮年';
  return `你是一位精通面相学的命理大师。用户性别:${isMale ? '男' : '女'},年龄段:${ageLabel}。

【三张图片对应关系】
1️⃣ = 正面照 · 用于判断十二宫分布、五官比例、面部轮廓、对称性
2️⃣ = 左侧面 45° · 用于判断额头/山根/鼻梁/颧骨/下颌立体度
3️⃣ = 右侧面 45° · 与左侧面交叉验证,排除光线/角度误差

【关键观察要求 (先观察再推理)】
- 正面照优先看三庭(发际→眉=上庭;眉→鼻底=中庭;鼻底→下巴=下庭)比例是否 1:1:1
- 看五官(眉/眼/鼻/口/耳)大小、形状、相对位置、是否有痣/疤/纹
- 看十二宫位:命宫(眉间山根)、财帛宫(鼻)、夫妻宫(眼角)、官禄宫(额头正中)、迁移宫(额角)等
- 看气色:明润为吉,暗滞/青黑/赤红为忧;面部不同区域对应不同脏腑与运势
- 侧照补充:山根挺拔(健康)、鼻梁有节(事业)、颧骨饱满(权力)、下颌有肉(晚年)

【分析维度 · 按以下 10 项输出】
1. 三庭比例与对应运势(少年/壮年/晚年)
2. 五官详解:眉(兄弟宫/性格)、眼(夫妻宫/慧黠)、鼻(财帛宫/健康)、口(出纳/福德)、耳(肾气/早年)
3. 十二宫吉凶:命宫/财帛/兄弟/夫妻/子女/疾厄/迁移/奴仆/官禄/田宅/福德/父母
4. 气色流年:印堂/鼻头/两颊/口唇的气色对应近期运势
5. 痣相:位置+吉凶(眉里藏珠/鼻头主财/法令痣主贵)
6. 面部轮廓:由字/田字/申字/甲字脸型与命运关联
7. 男女有别:${isMale ? '男看官禄(额头)+财帛(鼻)+子女(眼下);以事业/财富为重' : '女看夫妻(眼角)+子女(泪堂)+财帛;以婚姻/子女为重'}

【输出格式】
=== 十二宫总断 ===
按十二宫顺序逐项给吉凶判断
=== 五官详批 ===
眉/眼/鼻/口/耳 五官逐个点评
=== 三庭气色 ===
上/中/下三庭气色流年解读
=== 面型与格局 ===
... (略)

=== 综合解读 ===
近期(3-6 个月)/中期(1-3 年)/长期(5-10 年)运势节奏 + 具体建议(事业/财运/感情/健康)

【语言约束】纯中文输出,禁止英文/思考过程/分析步骤。`;
}

// ===== 渲染 + 收尾 =====
function renderMx(label, text, imageCount) {
  const el = document.getElementById('mxResult');
  if (!el) return;
  el.innerHTML = '<div style="white-space:pre-wrap;">[' + label + ' · ' + imageCount + ' 张图]\n\n' + escapeHtml(text) + '</div>';
}

function finalizeMianxiang(resultEl, fullText) {
  try { window.saveHistory?.('mianxiang', 'mianxiang-' + Date.now(), '面相解读', fullText); } catch (e) { console.warn('[mx] saveHistory:', e); }
  try { window.addFeedbackUI?.('mianxiang', resultEl, fullText, '', ''); } catch (e) { console.warn('[mx] addFeedbackUI:', e); }
  try { window.showResultActions?.('mxResult', 'mxResultActions'); } catch (e) { console.warn('[mx] showResultActions:', e); }
  try {
    const bus = window.EventBus; const evName = window.CoreEvents?.AI_COMPLETE;
    if (bus && evName) bus.dispatchEvent(new CustomEvent(evName, { detail: { domain: 'mianxiang', outputText: fullText, contentEl: resultEl } }));
  } catch (e) { console.warn('[mx] AI_COMPLETE dispatch:', e); }
}

// ===== 联动:复用 pickLinkPan 模式 =====
function pickMxLinkPan() {
  if (window.currentCross && (window.currentCross.bazi || window.currentCross.ziwei)) {
    return { pan: window.currentCross, src: '三术同参' };
  }
  if (window.currentBazi) return { pan: { bazi: window.currentBazi }, src: '八字' };
  if (window.currentZw)   return { pan: { ziwei: window.currentZw },   src: '紫微' };
  return null;
}

async function doMianxiang() {
  if (!mxHasAny()) {
    showToast('请至少上传一张面部照片(正面/左45°/右45°)', 'error');
    return;
  }
  const resultEl = document.getElementById('mxResult');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">AI 正在分析面相...</div>';
  try {
    await ensureKB();
    await loadKBGroup('mianxiang');
  } catch (e) { console.warn('[mx] KB 加载失败,继续走核心 KB:', e); }

  const isMale = mxGender === 'male';
  const ageBucket = mxAgeBucket;
  const visionPrompt = buildMianxiangPrompt(isMale, ageBucket);

  // 构造 imageUrls(按 front / left45 / right45 顺序) + imagesForCache
  const imageUrls = [];
  const imagesForCache = {};
  const missingSlots = [];
  ['front', 'left45', 'right45'].forEach(function(view) {
    const data = mxGet(view);
    if (data) {
      imagesForCache[view] = data;
      imageUrls.push({ type: 'image_url', image_url: { url: data } });
    } else {
      missingSlots.push(view === 'front' ? '正面' : view === 'left45' ? '左 45°' : '右 45°');
    }
  });
  if (missingSlots.length) {
    visionPrompt += `\n\n【缺失照片】以下角度未上传,解读时不要瞎编:${missingSlots.join('、')}`;
  }

  // 联动命盘(八字/紫微)
  const link = pickMxLinkPan();
  const linkPan = link ? link.pan : null;
  const linkSrc = link ? link.src : '';
  let linkHint = '';
  if (linkPan) {
    const Expert = window.Expert;
    let linkFacts = '';
    if (Expert) {
      try {
        if (linkPan.bazi && typeof Expert.bazi === 'function') linkFacts += '【八字事实·100%准确】\n' + Expert.bazi(linkPan.bazi) + '\n';
        if (linkPan.ziwei && typeof Expert.ziwei === 'function') linkFacts += '【紫微事实·100%准确】\n' + Expert.ziwei(linkPan.ziwei) + '\n';
      } catch (e) { console.warn('[mx] Expert 联动事实生成失败:', e); }
    }
    linkHint = '\n\n【已联动】本次面相解读结合用户最新一次' + linkSrc + '排盘做交叉印证。\n' + linkFacts;
  }

  const system = await Core.AI.buildSystemPrompt({
    domain: 'mianxiang',
    pan: linkPan,
    question: '',
    extraSystem: linkHint
  });

  // Cache 命中先返回
  const Cache = window.Cache;
  const cacheParams = {
    linkPan: linkPan || null,
    images: imagesForCache,
    mxGender: mxGender,
    ageBucket: ageBucket,
    question: ''
  };
  if (Cache) {
    const cached = Cache.get('mianxiang', cacheParams);
    if (cached) {
      renderMx('缓存命中', cached, imageUrls.length);
      finalizeMianxiang(resultEl, cached);
      return;
    }
  }

  // messages 构造(OpenAI/DashScope 不认顶层 system,放 role=system)
  const messages = [
    { role: 'system', content: system || '' },
    { role: 'user', content: [{ type: 'text', text: visionPrompt }].concat(imageUrls) }
  ];

  const localPort = getLocalServerPort();
  let fullText = '';
  let usedSource = '';

  // 本地 VL 优先
  const localAlive = await Core.AI.pingLocalModel(localPort);
  resultEl.innerHTML = `<div class="loading">ping ${getLocalServerUrl()}/v1/models ...</div>`;
  if (localAlive) {
    usedSource = `本地 VL (${localPort})`;
    try {
      const localModelName = await Core.AI.getLocalModelName();
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在分析${imageUrls.length}张面部图片...<br><small>当前模型: ${localModelName} | endpoint: ${getLocalServerUrl()}</small></div>`;
      fullText = await Core.AI.callMultimodalVision(
        `${getLocalServerUrl()}/v1/chat/completions`,
        { 'Content-Type': 'application/json' },
        { model: localModelName, messages, temperature: 0.15, max_tokens: 4096, stream: true },
        usedSource,
        600000,
        { targetEl: resultEl }
      );
    } catch (e) {
      const isTimeoutAbort = e?.name === 'AbortError' && (
        e.message?.includes('timeout') ||
        e.message?.includes('exceeded') ||
        String(e?.cause || '').includes('mx-timeout')
      );
      if (e?.name === 'AbortError' && !isTimeoutAbort) {
        resultEl.innerHTML = '<div class="info">已停止生成。</div>';
        return;
      }
      const reasonLabel = isTimeoutAbort ? '本地模型超时' : '本地模型失败';
      console.warn(`[mx] ${reasonLabel},降级云端:`, e.message);
      resultEl.innerHTML = `<div class="loading">${reasonLabel}: ${escapeHtml(e.message)} — 切云端...</div>`;
      fullText = '';
    }
  } else {
    console.warn('[mx] 本地模型 ' + getLocalServerUrl() + ' 不可达');
  }

  // 云端 fallback (DeepSeek)
  if (!fullText) {
    const vKey = localStorage.getItem('ds_api_key') || '';
    if (!vKey) {
      resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置 DeepSeek API Key。<br>请在设置页填写 DeepSeek API Key，或启动本地 VL 模型。</div>`;
      return;
    }
    usedSource = '云端 DeepSeek (VL)';
    resultEl.innerHTML = '<div class="loading">调用云端识图(' + imageUrls.length + ' 张图分析)...</div>';
    try {
      // v3.1.2: 统一云端走 DeepSeek 视觉模型
      // 强制使用 deepseek-v4-flash-vision-exp;清理 qwen-vl 残留值
      const savedVisionModel = localStorage.getItem('vision_model') || '';
      const model = (savedVisionModel.startsWith('deepseek')) ? savedVisionModel : 'deepseek-v4-flash-vision-exp';
      fullText = await Core.AI.callMultimodalVision(
        (localStorage.getItem('ds_base_url') || 'https://api.deepseek.com/v1').replace(/\/v1\/?$/, '') + '/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
        { model, messages, temperature: 0.6, max_tokens: 4096, stream: true },
        usedSource,
        120000,
        { targetEl: resultEl }
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

  renderMx(usedSource, fullText, imageUrls.length);

  // 写缓存
  if (Cache && fullText) {
    try { Cache.set('mianxiang', cacheParams, fullText); }
    catch (e) { console.warn('[mx] cache set fail:', e); }
  }

  finalizeMianxiang(resultEl, fullText);
}
window.doMianxiang = doMianxiang;

// 拖拽上传(参考 shouxiang setupSxDragDrop,适配 3 张图)
function setupMxDragDrop(areaId, inputId, view) {
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
      onMxFileSelect({ target: { files: [file] } }, view);
    }
  });
}
window.setupMxDragDrop = setupMxDragDrop;