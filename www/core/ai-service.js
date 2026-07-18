/**
 * AI 服务层 — 从 app.js 拆出
 * 封装 callDeepSeek / readSSE / stripThinking,提供 interpret() 统一入口
 * 阶段 2: 只搬代码;阶段 5: 加 interpret() 统一封装 + 缓存
 */
(function () {
  if (typeof window === 'undefined') return;

  // 过滤模型输出的英文 thinking / 分析过程,只保留中文正文
  // 比 core 早期版多了对 "Thinking Process:" / "Step by step analysis:" 等的清洗
  function stripThinking(text) {
    if (!text) return '';
    let t = text;
    t = t.replace(/Here's\s+a\s+thinking\s*process:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
    t = t.replace(/Thinking\s*[Pp]rocess:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
    t = t.replace(/Step\s*by\s*step\s+analysis:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
    t = t.replace(/Let\s+me\s+analyze\s+this:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
    t = t.replace(/\n?Output\s*Generation.*$/is, '');
    t = t.replace(/\n?\*\(Self-Correction[\s\S]*?\)\*\s*$/is, '');
    t = t.replace(/\n?\*\*?Self-Correction[\s\S]*?\*\*?\s*$/is, '');
    // 过滤 "Thinking Process:" 开头的整段英文内容
    t = t.replace(/Thinking\s*Process:[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/1\.\s*Analyze[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/\*\*Key\s*Facts:\*\*[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    // 过滤英文分析过程(Qwen3.x 等模型常见) — 正则源码(单反斜杠,不是字符串)
    t = t.replace(/\*\*Key\s*Facts[^\n]*\n[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/\d+\)\s*\*\*Analyze[^\n]*\n[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/\*\*Output\s*Format:[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/Let\s+me\s+work[^\n]*[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    t = t.replace(/I\s+will\s+now[^\n]*[\s\S]*?(?=【|## |\n## |^## |$)/i, '');
    // 过滤纯英文段落（超过100字符的连续英文）
    t = t.replace(/^[\\s\\S]{0,500}?(?=【)/, function(m) {
      if (/^[\\s\\S]*[a-zA-Z]{10,}[\\s\\S]*$/.test(m) && !/[\\u4e00-\\u9fa5]/.test(m)) return '';
      return m;
    });
    // 兜底:剥 <think> / <thinking> / <reflection> 标签
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
    t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    t = t.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');
    return t.trim();
  }

  // SSE 流式读取器(OpenAI 兼容格式),实时过滤 thinking
  async function readSSE(body, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let rawFull = '';
    let filteredFull = '';
    let chunkCount = 0;
    const startTime = Date.now();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            // 防御:处理 reasoning_content(Qwen3.x 等模型)
            const delta = obj.choices?.[0]?.delta?.content || '';
            const reasoning = obj.choices?.[0]?.delta?.reasoning_content || '';
            const text = delta || reasoning;
            if (text) {
              rawFull += text;
              chunkCount++;
              const newFiltered = stripThinking(rawFull);
              if (newFiltered.length > filteredFull.length) {
                const passThrough = newFiltered.slice(filteredFull.length);
                filteredFull = newFiltered;
                onChunk(passThrough, filteredFull);
              }
            }
          } catch (e) { /* 忽略单行解析错误,继续 */ }
        }
      }
    } catch (e) {
      console.error('SSE 读取中断:', e.message);
    }
    const elapsed = Date.now() - startTime;
    console.log(`SSE 完成: ${chunkCount} 块, 原始${rawFull.length}字 → 过滤后${filteredFull.length}字, ${elapsed}ms`);
    return filteredFull;
  }

  function getLocalServerUrl() {
    const ip = (localStorage.getItem('local_server_ip') || '127.0.0.1').replace(/\/$/, '');
    const port = localStorage.getItem('local_server_port') || '8082';
    return `http://${ip}:${port}`;
  }
  function getLocalServerIp() {
    return (localStorage.getItem('local_server_ip') || '127.0.0.1').replace(/\/$/, '');
  }
  function getLocalServerPort() {
    return localStorage.getItem('local_server_port') || '8082';
  }

  // ===== 多模型路由表(任务 #23,默认 DeepSeek-V4) =====
  // 按 domain 自动选模型,用户可在设置页用 ai_model_override 覆盖
  // DeepSeek V4 官方 API 仅支持 deepseek-v4-pro / deepseek-v4-flash(无 deepseek-v4)
  const MODEL_ROUTER = {
    liuyao:   'deepseek-v4-pro',     // 六爻逻辑推理强,优先 Pro(强推理)
    bazi:     'deepseek-v4-flash',   // 八字 V4 旗舰日常够用,Flash 更快更便宜
    ziwei:    'deepseek-v4-flash',
    qimen:    'deepseek-v4-pro',     // 奇门星门组合复杂,Pro 推理更强
    cross:    'deepseek-v4-pro',     // 三术同参需深度推理
    fengshui: 'deepseek-v4-pro',     // 风水 2000+ 字长文,Pro 更稳
    xingshi:  'deepseek-v4-flash',
    shouxiang:'deepseek-v4-pro',     // 手相图片解读复杂
    mianxiang:'deepseek-v4-pro',
    daofo:    'deepseek-v4-flash',
    chat:     'deepseek-v4-flash'
  };
  // 用户覆盖:localStorage.ai_model_override = JSON.stringify({liuyao: '...', ...})

  function getModelForDomain(domain) {
    const overrides = JSON.parse(localStorage.getItem('ai_model_override') || '{}');
    if (overrides[domain]) return overrides[domain];
    return MODEL_ROUTER[domain] || 'deepseek-v4-flash';
  }

  // ===== 用量统计(任务 #29) =====
  // 按月分桶,记录每次调用的 model/tokens/cost
  const USAGE_KEY = 'ai_usage_log_v1';
  // 模型单价(每 1M tokens,CNY,2026年7月最新定价)
  const MODEL_PRICING = {
    'deepseek-v4':        { input: 1, output: 2, label: 'DeepSeek-V4' },
    'deepseek-v4-flash':  { input: 1, output: 2, label: 'DeepSeek-V4-Flash(快)' },
    'deepseek-v4-pro':    { input: 3, output: 6, label: 'DeepSeek-V4-Pro(强推理)' },
    'deepseek-chat':      { input: 1, output: 2, label: 'DeepSeek-V3(旧)' },
    'deepseek-reasoner':  { input: 4, output: 16, label: 'DeepSeek-R1' },
    'gpt-4o':            { input: 18, output: 72, label: 'GPT-4o' },
    'qwen-turbo':        { input: 0.3, output: 0.6, label: '通义千问 Turbo' }
  };

  function recordUsage(model, inputTokens, outputTokens, domain) {
    try {
      const log = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM
      log[month] = log[month] || { totalCalls: 0, totalCost: 0, byModel: {}, byDomain: {} };
      const price = MODEL_PRICING[model] || MODEL_PRICING['deepseek-chat'];
      const cost = (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
      log[month].totalCalls++;
      log[month].totalCost += cost;
      log[month].byModel[model] = log[month].byModel[model] || { calls: 0, cost: 0, in: 0, out: 0 };
      log[month].byModel[model].calls++;
      log[month].byModel[model].cost += cost;
      log[month].byModel[model].in += inputTokens;
      log[month].byModel[model].out += outputTokens;
      log[month].byDomain[domain] = (log[month].byDomain[domain] || 0) + 1;
      // 只保留最近 6 个月
      const months = Object.keys(log).sort().slice(-6);
      const trimmed = {};
      months.forEach(m => trimmed[m] = log[m]);
      localStorage.setItem(USAGE_KEY, JSON.stringify(trimmed));
    } catch (e) { console.warn('[Usage] 记录失败:', e); }
  }

  function getUsage(month) {
    try {
      const log = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      if (month) return log[month] || null;
      // 默认本月
      const m = new Date().toISOString().slice(0, 7);
      return log[m] || { totalCalls: 0, totalCost: 0, byModel: {}, byDomain: {} };
    } catch (e) { return null; }
  }

  // 自动发现本地模型名：用户未填写时，从 /v1/models 取第一个模型
  async function getLocalModelName() {
    const saved = localStorage.getItem('local_model_name');
    if (saved && saved !== 'default') return saved;
    try {
      const res = await fetch(`${getLocalServerUrl()}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return 'default';
      const data = await res.json();
      const first = data.data?.[0]?.id || data.models?.[0]?.id || data.data?.[0]?.model || data.models?.[0]?.model;
      if (first) {
        localStorage.setItem('local_model_name', first);
        return first;
      }
    } catch (e) { console.warn('[AI] 自动获取本地模型名失败:', e.message); }
    return 'default';
  }

  let _currentStreamAbort = null;

  async function callDeepSeek(prompt, system, onChunk, opts = {}) {
    const { temperature = 0.15, model: optModel, signal: externalSignal, domain: optDomain } = opts;
    const useLocal = localStorage.getItem('use_local_model') === '1';
    const externalAbort = externalSignal || new AbortController().signal;
    _currentStreamAbort = externalSignal ? null : new AbortController();
    const messages = [];
    const chineseConstraint = '【铁律·语言约束】你的所有输出必须使用纯中文。严禁输出任何英文单词、英文句子、中英文混合内容。严禁输出思考过程、分析步骤、"thinking process"、"step by step"、"let me think"等元内容。如果你需要推理，请在心中完成，只向用户展示最终的中文解读结果。\n\n';

    // 本地模型上下文保护: system 按中文字符粗略估算 1 token ≈ 1 中文字,limit 6000
    const LOCAL_CTX_LIMIT = 10000;
    const estimatedTokens = (chineseConstraint.length + (system?.length || 0) + prompt.length);
    let finalSystem = system;
    if (useLocal && estimatedTokens > LOCAL_CTX_LIMIT) {
      const allowedSystemLen = Math.max(0, LOCAL_CTX_LIMIT - chineseConstraint.length - prompt.length - 200);
      console.warn(`[AI] 本地模型上下文保护: system 过长(${system.length}字),截断到${allowedSystemLen}字`);
      finalSystem = system.slice(0, allowedSystemLen) + '\n...[上下文已截断以保持本地模型可运行]';
    }

    if (finalSystem) {
      messages.push({ role: 'system', content: chineseConstraint + finalSystem });
    } else {
      messages.push({ role: 'system', content: chineseConstraint });
    }
    messages.push({ role: 'user', content: prompt + '\n\n【再次强调】请用纯中文回答，不要出现任何英文。' });

    const LOCAL_TIMEOUT = 360000; // 6 分钟
    const CLOUD_TIMEOUT = 120000; // 2 分钟
    const MAX_TOKENS_CLOUD = 4096;
    const MAX_TOKENS_LOCAL = 8192; // 本地模型输出可以更长
    const MAX_TOKENS = useLocal ? MAX_TOKENS_LOCAL : MAX_TOKENS_CLOUD;
    const showToast = window.Core?.Toast?.showToast || function () {};

    if (useLocal) {
      showToast('本地模型正在深度思考（最长6分钟），请耐心等待...', 'success');
      const localUrl = `${getLocalServerUrl()}/v1/chat/completions`;
      let localTimer, localP1, localP2;
      try {
        const ctrl = new AbortController();
        localTimer = setTimeout(() => ctrl.abort(), LOCAL_TIMEOUT);
        if (externalAbort) externalAbort.addEventListener('abort', () => ctrl.abort());
        localP1 = setTimeout(() => showToast('AI 仍在思考，已等待 2 分钟...', 'success'), 120000);
        localP2 = setTimeout(() => showToast('AI 仍在思考，已等待 4 分钟...', 'success'), 240000);

        const localModelName = await getLocalModelName();
        const res = await fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: localModelName, messages, temperature, max_tokens: MAX_TOKENS, stream: !!onChunk }),
          signal: ctrl.signal
        });
        clearTimeout(localTimer);
        clearTimeout(localP1);
        clearTimeout(localP2);

        if (res.ok) {
          if (onChunk && res.body) return await readSSE(res.body, onChunk);
          const data = await res.json();
          const msg = data.choices?.[0]?.message || {};
          // Qwen3.5 等思考模型: 正文可能在 content 或 reasoning_content
          const rawText = msg.content || msg.reasoning_content || '';
          if (rawText) {
            const full = stripThinking(rawText);
            if (full) return full;
            // strip 后为空说明全是 thinking,提示用户
            if (msg.content && msg.reasoning_content) {
              return '[模型返回内容全是思考过程,无正式解读。请重试或在 llama-server 启动时加 --reasoning off]';
            }
          }
          throw new Error('本地模型返回格式异常: content 和 reasoning_content 都为空');
        }
        const errText = await res.text().catch(() => '');
        console.error('本地模型 HTTP 错误:', res.status, errText);
        showToast(`本地模型错误 ${res.status}，自动切换云端...`, 'warning');
      } catch (e) {
        if (localTimer) clearTimeout(localTimer);
        if (localP1) clearTimeout(localP1);
        if (localP2) clearTimeout(localP2);
        console.error('本地模型不可用:', e.message);
        if (e.name === 'AbortError') {
          showToast('本地模型超时(6分钟)，自动切换云端...', 'warning');
        } else {
          showToast('本地模型不可用，自动切换云端...', 'warning');
        }
        // 继续执行云端fallback
      }
    }

    // 云端 DeepSeek fallback
    const key = localStorage.getItem('ds_api_key') || '';
    const isFallback = useLocal;
    if (!key) {
      if (isFallback) {
        // 本地模型尝试失败 + 没有 API Key
        throw new Error('本地模型连接失败(请检查模型是否启动、CORS是否开启)，且未配置云端 API Key。建议：1.确认本地模型已启动 2.运行 cors_proxy.py 3.或在设置页配置 DeepSeek API Key');
      }
      throw new Error('请先在设置页配置 DeepSeek API Key，或启用本地模型');
    }
    // 按 domain 自动路由模型,优先用 optModel(显式覆盖) > getModelForDomain > 设置默认值
    const model = optModel
      || (optDomain ? getModelForDomain(optDomain) : null)
      || localStorage.getItem('ds_model')
      || 'deepseek-v4-flash';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CLOUD_TIMEOUT);
    if (externalAbort) externalAbort.addEventListener('abort', () => ctrl.abort());
    const useStream = !!onChunk;
    const baseUrl = (localStorage.getItem('ds_base_url') || 'https://api.deepseek.com/v1').replace(/\/v1\/?$/, '');

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: MAX_TOKENS, stream: useStream }),
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) throw new Error('API Key 无效,请在设置中检查');
        if (res.status === 429) throw new Error('API 调用频率超限,请稍后再试');
        throw new Error('云端 API 错误: ' + msg);
      }

      if (useStream && res.body) {
        const full = await readSSE(res.body, onChunk);
        // 记录用量(若响应含 usage 字段)
        try {
          const usage = res.headers?.get?.('x-usage') ? JSON.parse(res.headers.get('x-usage')) : null;
          if (usage && optDomain) recordUsage(model, usage.prompt_tokens || 0, usage.completion_tokens || full.length, optDomain);
        } catch (e) { /* noop */ }
        return isFallback ? '[已自动切换至云端模型]\n\n' + full : full;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      // 记录用量
      try {
        if (data.usage && optDomain) recordUsage(model, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, optDomain);
      } catch (e) { /* noop */ }
      if (!text || text.trim().length === 0) {
        const reasoning = data.choices?.[0]?.message?.reasoning_content;
        if (reasoning && reasoning.trim().length > 0) {
          return '[模型返回思维链内容，无正式解读]\n\n' + reasoning;
        }
        throw new Error('模型返回空内容，请检查模型参数（如Qwen需加 --reasoning off）');
      }
      const cleanText = stripThinking(text);
      return isFallback ? '[已自动切换至云端模型]\n\n' + cleanText : cleanText;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  function getCurrentStreamAbort() { return _currentStreamAbort; }
  function setCurrentStreamAbort(c) { _currentStreamAbort = c; }
  function clearCurrentStreamAbort() { _currentStreamAbort = null; }

  /**
   * 统一 AI 解读入口(任务 #19)
   *
   * 封装:缓存查询 + 流式输出 + 事件派发 + Stream indicator 控制 + abort 管理
   * 调用方只需传入 domain/prompt/system/pan,负责 saveHistory/addFeedbackUI 等 UI 收尾
   *
   * @param {object} opts
   * @param {string} opts.domain              - 领域标识:'bazi'/'ziwei'/'liuyao'/... (用于事件 + 缓存)
   * @param {string} opts.prompt             - 用户问题提示
   * @param {string} [opts.system]           - 系统提示
   * @param {object} [opts.pan]              - 命盘快照(用于缓存 key)
   * @param {string} [opts.question]         - 提问文本(用于缓存 key + 历史)
   * @param {HTMLElement} [opts.contentEl]   - 流式输出目标元素(更新 textContent)
   * @param {string} [opts.prefix]           - 追问前缀(前缀内容,如上次解读)
   * @param {string} [opts.separator]        - 追问分隔符(默认 '\n\n')
   * @param {object} [opts.callOpts]         - 透传给 callDeepSeek
   * @returns {Promise<{ finalText: string, fromCache: boolean, fullText: string }>}
   */
  async function interpret(opts) {
    const {
      domain, prompt, system, pan, question,
      contentEl, prefix = '', separator = '',
      callOpts = {},
    } = opts || {};
    if (!domain || !prompt) throw new Error('interpret: domain + prompt 必填');

    const bus = window.EventBus;
    const events = window.CoreEvents || {};
    const dispatch = (name, detail) => {
      if (bus && events[name]) {
        try { bus.dispatchEvent(new CustomEvent(events[name], { detail })); }
        catch (e) { console.warn(`[EventBus] ${name} dispatch failed:`, e); }
      }
    };
    const showIndicator = window.Core?.Stream?.showStreamIndicator || function () {};
    const hideIndicator = window.Core?.Stream?.hideStreamIndicator || function () {};
    const Cache = window.Cache;
    const cacheKey = Cache && pan ? Cache.makeKey(domain, { ...pan, question }) : null;

    dispatch('AI_START', { domain });

    // 1) 缓存命中直接返回
    if (cacheKey) {
      const cached = Cache.get(domain, { ...pan, question });
      if (cached) {
        const finalText = prefix + separator + cached;
        if (contentEl) contentEl.textContent = finalText;
        dispatch('AI_COMPLETE', { domain, outputText: cached, prompt, system, contentEl, fromCache: true });
        return { finalText, fromCache: true, fullText: cached };
      }
    }

    // 2) 实时流式
    showIndicator();
    let fullText = '';
    try {
      const text = await callDeepSeek(prompt, system, (delta, full) => {
        fullText = full;
        if (contentEl) contentEl.textContent = prefix + separator + full;
        dispatch('AI_CHUNK', { domain, text: delta, full });
      }, { ...callOpts, domain });
      if (!fullText) fullText = text || '';
    } catch (e) {
      hideIndicator();
      dispatch('AI_ERROR', { domain, error: e });
      throw e;
    }
    hideIndicator();

    // 3) 写缓存
    if (cacheKey && fullText) {
      try { Cache.set(domain, { ...pan, question }, fullText); }
      catch (e) { console.warn('[Cache] set failed:', e); }
    }

    const finalText = prefix + separator + fullText;
    if (contentEl) contentEl.textContent = finalText;
    dispatch('AI_COMPLETE', { domain, outputText: fullText, prompt, system, contentEl, fromCache: false });
    return { finalText, fromCache: false, fullText };
  }

  /**
   * 统一 system prompt 构建(任务 #23)
   *
   * 自动组装 Expert 事实 + RAG + 历史 + 反馈校准 + KB + chainOfThought/fewshot
   * 消除 8 个 doAIXxx 中重复的 ~20 行 system 构建样板
   *
   * @param {object} opts
   * @param {string} opts.domain       - 'bazi'|'ziwei'|'liuyao'|'qimen'|'cross'|'fengshui'|'xingshi'|'daofobuddhism'
   * @param {object} opts.pan          - 命盘对象
   * @param {string} [opts.question]   - 用户问题
   * @param {string} [opts.extraSystem] - 自定义 system 前缀(用于 xingshi/fengshui/daofobuddhism 等非标准模块)
   * @returns {string} 组装好的 system prompt
   */
  function buildSystemPrompt(opts) {
    // 异步路径(getSimilarHistoryPrompt/getRiskPrompt 现在是 async)
    return _buildSystemPromptAsync(opts);
  }

  async function _buildSystemPromptAsync(opts) {
    const { domain, pan, question, extraSystem = '' } = opts || {};
    if (!domain) return extraSystem || '';

    // 领域配置:expert 方法名 + 中文标签 + RAG source + signal 提取函数
    // kbFlags 控制是否加载 kbPrimary/kbExtended/kbDaoismBuddhismOnDemand(默认全部 true)
    // isCross:三术同参用多 Expert + 交叉验证;isCustom:自定义模块只加 kbPrimary+kbExtended
    // ragBudget: 该域 system 预算较紧,限制 RAG 返回长度,避免本地模型爆上下文
    var CFG = {
      bazi:   { expert: 'bazi',   label: '八字',     source: '八字',     signalFn: function(p) { return p.gz?.day; } },
      ziwei:  { expert: 'ziwei',  label: '紫微',     source: '紫微',     signalFn: function(p) { return p.mingGong?.ganzhi; }, ragBudget: 1200 },
      liuyao: { expert: 'liuyao', label: '六爻',     source: '六爻',     signalFn: function(p) { return p.gua?.name; } },
      qimen:  { expert: 'qimen',  label: '奇门',     source: '奇门',     signalFn: function(p) { return p.jushu_text; }, ragBudget: 1200 },
      cross:  { label: '三术同参', source: '三术同参', signalFn: function(p) { return p.bazi?.gz?.day; }, isCross: true, kbFlags: { primary: false, extended: false, daoism: true } },
      fengshui:  { label: '风水',     isCustom: true, kbFlags: { daoism: false, chainOfThought: false }, ragBudget: 1200 },
      xingshi:   { label: '姓名学',   isCustom: true, kbFlags: { daoism: false, chainOfThought: false } },
      daofobuddhism: { label: '道佛化解', isCustom: true, kbFlags: { primary: false, extended: false, daoism: false, chainOfThought: false } },
    };
    var cfg = CFG[domain];
    if (!cfg) return extraSystem || '';

    // ABTest 配置(全局函数,跨 IIFE 可见)
    var abCfg = { topK: 10, maxChars: 2500, useFewshot: true, useChainOfThought: true };
    if (typeof getActiveABConfig === 'function') {
      try { abCfg = getActiveABConfig(); } catch (e) { /* fallback */ }
    }

    var Expert = window.Expert;
    var RAG = window.RAG;
    var FeedbackLoop = window.FeedbackLoop;
    var q = question || '';

    // 1) Expert 事实
    var facts = '';
    if (cfg.isCross) {
      try {
        if (pan && pan.bazi && Expert?.bazi) facts += '【八字事实·100%准确】\n' + Expert.bazi(pan.bazi) + '\n';
        if (pan && pan.ziwei && Expert?.ziwei) facts += '【紫微事实·100%准确】\n' + Expert.ziwei(pan.ziwei) + '\n';
        if (pan && pan.liuyao && Expert?.liuyao) facts += '【六爻事实·100%准确】\n' + Expert.liuyao(pan.liuyao) + '\n';
        if (pan && pan.qimen && Expert?.qimen) facts += '【奇门事实·100%准确】\n' + Expert.qimen(pan.qimen) + '\n';
        if (Expert?.crossValidate) facts += '【交叉验证】\n' + Expert.crossValidate(pan) + '\n';
      } catch (e) { console.warn('[AI] Expert 调用失败:', e); }
    } else if (!cfg.isCustom && cfg.expert && Expert?.[cfg.expert] && pan) {
      try {
        facts = Expert[cfg.expert](pan);
      } catch (e) { console.warn('[AI] Expert 调用失败:', e); }
    }

    // 2) RAG
    var ragContent = '';
    if (!cfg.isCustom && RAG && cfg.source && pan) {
      try {
        var searchPan = cfg.isCross ? (pan.bazi || pan.qimen || pan) : pan;
        var crossMax = cfg.isCross ? Math.min(abCfg.maxChars, 2000) : abCfg.maxChars;
        var crossTopK = cfg.isCross ? Math.min(abCfg.topK, 8) : abCfg.topK;
        // 对 system 预算紧张的域单独限制 RAG 长度
        if (cfg.ragBudget && crossMax > cfg.ragBudget) crossMax = cfg.ragBudget;
        ragContent = RAG.search(searchPan, q, {
          topK: crossTopK,
          maxChars: crossMax,
          source: cfg.source
        });
      } catch (e) { console.warn('[buildSystemPrompt] RAG fail:', e); }
    }

    // 3) 历史
    var historyPrompt = '';
    if (cfg.signalFn && typeof getSimilarHistoryPrompt === 'function') {
      try {
        var signal = pan ? cfg.signalFn(pan) : '';
        historyPrompt = await getSimilarHistoryPrompt(domain, signal, q);
      } catch (e) { console.warn('[buildSystemPrompt] 历史相似匹配失败:', e); }
    }

    // 4) 反馈校准
    var feedbackCalib = FeedbackLoop?.getCalibrationPrompt?.(domain) || '';
    var riskPrompt = '';
    try { riskPrompt = (await FeedbackLoop?.getRiskPrompt?.(domain, q)) || ''; } catch (e) { /* noop */ }

    // 5) KB(全局函数,跨 IIFE 可见)
    var kf = cfg.kbFlags || {};
    var kbP = (kf.primary !== false && typeof kbPrimary === 'function') ? kbPrimary(domain) : '';
    var kbE = (kf.extended !== false && typeof kbExtended === 'function') ? kbExtended(domain, q) : '';
    var kbDao = (kf.daoism !== false && typeof kbDaoismBuddhismOnDemand === 'function') ? kbDaoismBuddhismOnDemand(q) : '';

    // 对 system 预算紧张的域截断 KB 输出(保留开头,长尾截断)
    if (cfg.ragBudget) {
      var kbBudget = cfg.ragBudget; // 复用同一预算概念
      if (kbP.length > kbBudget) kbP = kbP.slice(0, kbBudget) + '\n...[知识库primary已截断]';
      if (kbE.length > kbBudget) kbE = kbE.slice(0, kbBudget) + '\n...[知识库extended已截断]';
      if (kbDao.length > kbBudget) kbDao = kbDao.slice(0, kbBudget) + '\n...[知识库道佛已截断]';
    }

    // 6) Cross 特殊前缀
    var crossPrefix = '';
    if (cfg.isCross) {
      crossPrefix = '【三术同参原则】\n'
        + '1. 三术皆属同一人生轨迹的"不同投影"，不应有本质矛盾\n'
        + '2. 一致结论置信度高，可作主要建议\n'
        + '3. 矛盾时需分析是排盘差异还是时点差异，不轻易否定\n'
        + '4. 给每条结论标注：八字+紫微+六爻 三/二/一 术支持\n'
        + '5. 优先采信交叉验证中"高置信度"结论\n'
        + '6. 用神一致时结论更可靠，用神不一致时需分别说明各术视角\n\n';
    }

    // 7) 组装 — 简洁版(任务 #33:删除分层/Few-shot/CoT/JSON 强制)
    // 保留:Expert 事实 + RAG + 历史校准 + 反馈校准 + KB
    // 删除:CorePrompts 分层/动态 Few-shot/Chain-of-Thought/JSON 结构化约束
    var system = extraSystem || crossPrefix;
    if (!cfg.isCross && facts) system += '【确定事实】\n' + facts + '\n';
    if (cfg.isCross) system += facts;
    system += (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbP + kbE + kbDao;

    return system;
  }

  window.Core = window.Core || {};
  window.Core.AI = {
    callDeepSeek,
    interpret,
    buildSystemPrompt,
    readSSE,
    stripThinking,
    getLocalServerUrl,
    getLocalServerIp,
    getLocalServerPort,
    getCurrentStreamAbort,
    setCurrentStreamAbort,
    clearCurrentStreamAbort,
    // 多模型路由 + 用量统计(任务 #23/#29)
    getModelForDomain,
    recordUsage,
    getUsage,
    MODEL_ROUTER,
    MODEL_PRICING,
    // 结构化输出解析(任务 #27)
    parseConfidence
  };

  // 从 AI 输出末尾提取"## 置信度: XX/100"
  function parseConfidence(text) {
    if (!text) return { confidence: null, cleanText: text || '' };
    const m = text.match(/##\s*置信度\s*[::]\s*(\d{1,3})\s*\/\s*100/i);
    if (!m) return { confidence: null, cleanText: text };
    const conf = Math.max(0, Math.min(100, parseInt(m[1], 10)));
    // 移除置信度行
    const cleanText = text.replace(/\n?\s*##\s*置信度\s*[::]\s*\d{1,3}\s*\/\s*100\s*/i, '').trim();
    return { confidence: conf, cleanText };
  }
})();
