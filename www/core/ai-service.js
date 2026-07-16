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
    const ip = (localStorage.getItem('local_server_ip') || '192.168.1.3').replace(/\/$/, '');
    const port = localStorage.getItem('local_server_port') || '8082';
    return `http://${ip}:${port}`;
  }
  function getLocalServerIp() {
    return (localStorage.getItem('local_server_ip') || '192.168.1.3').replace(/\/$/, '');
  }
  function getLocalServerPort() {
    return localStorage.getItem('local_server_port') || '8082';
  }

  let _currentStreamAbort = null;

  async function callDeepSeek(prompt, system, onChunk, opts = {}) {
    const { temperature = 0.15, model: optModel, signal: externalSignal } = opts;
    const useLocal = localStorage.getItem('use_local_model') === '1';
    const externalAbort = externalSignal || new AbortController().signal;
    _currentStreamAbort = externalSignal ? null : new AbortController();
    const messages = [];
    const chineseConstraint = '【铁律·语言约束】你的所有输出必须使用纯中文。严禁输出任何英文单词、英文句子、中英文混合内容。严禁输出思考过程、分析步骤、"thinking process"、"step by step"、"let me think"等元内容。如果你需要推理，请在心中完成，只向用户展示最终的中文解读结果。\n\n';
    if (system) {
      messages.push({ role: 'system', content: chineseConstraint + system });
    } else {
      messages.push({ role: 'system', content: chineseConstraint });
    }
    messages.push({ role: 'user', content: prompt + '\n\n【再次强调】请用纯中文回答，不要出现任何英文。' });

    const LOCAL_TIMEOUT = 360000; // 6 分钟
    const CLOUD_TIMEOUT = 120000; // 2 分钟
    const MAX_TOKENS = 4096;
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

        const res = await fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'local', messages, temperature, max_tokens: MAX_TOKENS, stream: !!onChunk }),
          signal: ctrl.signal
        });
        clearTimeout(localTimer);
        clearTimeout(localP1);
        clearTimeout(localP2);

        if (res.ok) {
          if (onChunk && res.body) return await readSSE(res.body, onChunk);
          const data = await res.json();
          if (data.choices?.[0]?.message?.content) {
            const full = data.choices[0].message.content;
            return stripThinking(full);
          }
          throw new Error('本地模型返回格式异常');
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

    // 云端 DeepSeek
    const key = localStorage.getItem('ds_api_key') || '';
    const isFallback = useLocal;
    if (!key) throw new Error('请先在设置页配置 DeepSeek API Key,或启动本地模型 (LM Studio / Ollama)');
    const model = optModel || localStorage.getItem('ds_model') || 'deepseek-chat';

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
        return isFallback ? '[已自动切换至云端模型]\n\n' + full : full;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
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
      }, callOpts);
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
    const { domain, pan, question, extraSystem = '' } = opts || {};
    if (!domain) return extraSystem || '';

    // 领域配置:expert 方法名 + 中文标签 + RAG source + signal 提取函数
    // kbFlags 控制是否加载 kbPrimary/kbExtended/kbDaoismBuddhismOnDemand(默认全部 true)
    // isCross:三术同参用多 Expert + 交叉验证;isCustom:自定义模块只加 kbPrimary+kbExtended
    var CFG = {
      bazi:   { expert: 'bazi',   label: '八字',     source: '八字',     signalFn: function(p) { return p.gz?.day; } },
      ziwei:  { expert: 'ziwei',  label: '紫微',     source: '紫微',     signalFn: function(p) { return p.mingGong?.ganzhi; } },
      liuyao: { expert: 'liuyao', label: '六爻',     source: '六爻',     signalFn: function(p) { return p.gua?.name; } },
      qimen:  { expert: 'qimen',  label: '奇门',     source: '奇门',     signalFn: function(p) { return p.jushu_text; } },
      cross:  { label: '三术同参', source: '三术同参', signalFn: function(p) { return p.bazi?.gz?.day; }, isCross: true, kbFlags: { primary: false, extended: false, daoism: true } },
      fengshui:  { label: '风水',     isCustom: true, kbFlags: { daoism: false, chainOfThought: false } },
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
        var searchPan = cfg.isCross ? (pan.bazi || pan) : pan;
        var crossMax = cfg.isCross ? Math.min(abCfg.maxChars, 2000) : abCfg.maxChars;
        var crossTopK = cfg.isCross ? Math.min(abCfg.topK, 8) : abCfg.topK;
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
        historyPrompt = getSimilarHistoryPrompt(domain, signal, q);
      } catch (e) { /* noop */ }
    }

    // 4) 反馈校准
    var feedbackCalib = FeedbackLoop?.getCalibrationPrompt?.(domain) || '';
    var riskPrompt = FeedbackLoop?.getRiskPrompt?.(domain, q) || '';

    // 5) KB(全局函数,跨 IIFE 可见)
    var kf = cfg.kbFlags || {};
    var kbP = (kf.primary !== false && typeof kbPrimary === 'function') ? kbPrimary(domain) : '';
    var kbE = (kf.extended !== false && typeof kbExtended === 'function') ? kbExtended(domain, q) : '';
    var kbDao = (kf.daoism !== false && typeof kbDaoismBuddhismOnDemand === 'function') ? kbDaoismBuddhismOnDemand(q) : '';

    // 6) Instruction
    var instruction = '';
    if (kf.chainOfThought !== false && !cfg.isCustom && Expert && cfg.label) {
      if (abCfg.useChainOfThought) instruction += Expert.chainOfThought(cfg.label);
      if (abCfg.useFewshot) instruction += (instruction ? '\n\n' : '') + Expert.fewshot(cfg.label);
    }

    // 7) Cross 特殊前缀
    var crossPrefix = '';
    if (cfg.isCross) {
      crossPrefix = '【三术同参原则】\n'
        + '1. 三术皆属同一人生轨迹的"不同投影"，不应有本质矛盾\n'
        + '2. 一致结论置信度高，可作主要建议\n'
        + '3. 矛盾时需分析是排盘差异还是时点差异，不轻易否定\n'
        + '4. 给每条结论标注：八字+紫微+六爻 三/二/一 术支持\n'
        + '5. 优先采信交叉验证中"高置信度"结论\n'
        + '6. 用神一致时结论更可靠，用神不一致时需分别说明各术视角\n\n';
      // crossCheck formatted 已包含在 facts 的 crossValidate 部分
    }

    // 8) 组装
    var system = extraSystem || crossPrefix;
    if (!cfg.isCross && facts) system += '【确定事实·100%准确】\n' + facts + '\n';
    if (cfg.isCross) system += facts;  // facts already has headers
    system += (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbP + kbE + kbDao;
    if (instruction) system += '\n\n' + instruction;

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
  };
})();