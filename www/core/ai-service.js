/**
 * AI 服务层 — 从 app.js 拆出
 * 封装 callDeepSeek / readSSE / stripThinking,提供 interpret() 统一入口
 * 阶段 2: 只搬代码;阶段 5: 加 interpret() 统一封装 + 缓存
 */
(function () {
  if (typeof window === 'undefined') return;

  function stripThinking(text) {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
      .trim();
  }

  async function readSSE(body, onChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
          if (delta) {
            full += delta;
            onChunk && onChunk(delta, full);
          }
        } catch (e) {
          // 非 JSON 行跳过(部分兼容实现)
        }
      }
    }
    return full;
  }

  function getLocalServerUrl() {
    const ip = localStorage.getItem('local_server_ip') || '127.0.0.1';
    const port = localStorage.getItem('local_server_port') || '1234';
    return `http://${ip}:${port}`;
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

    const LOCAL_TIMEOUT = 360000;
    const CLOUD_TIMEOUT = 120000;
    const MAX_TOKENS = 4096;
    const showToast = window.Core?.Toast?.showToast || function () {};

    if (useLocal) {
      showToast('本地模型正在深度思考（最长6分钟），请耐心等待...', 'success');
      const localUrl = `${getLocalServerUrl()}/v1/chat/completions`;
      try {
        const ctrl = new AbortController();
        const localTimer = setTimeout(() => ctrl.abort(), LOCAL_TIMEOUT);
        if (externalAbort) externalAbort.addEventListener('abort', () => ctrl.abort());
        const res = await fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'local', messages, temperature, max_tokens: MAX_TOKENS, stream: !!onChunk }),
          signal: ctrl.signal
        });
        clearTimeout(localTimer);
        if (res.ok) {
          if (onChunk && res.body) return await readSSE(res.body, onChunk);
          const data = await res.json();
          if (data.choices?.[0]?.message?.content) {
            const full = data.choices[0].message.content;
            onChunk && onChunk(full, full);
            return full;
          }
        }
        showToast('本地模型不可用,已切换到云端', 'error');
      } catch (e) {
        showToast('本地模型连接失败,已切换到云端', 'error');
      }
    }

    // 云端 DeepSeek
    const apiKey = localStorage.getItem('ds_api_key') || '';
    const baseUrl = (localStorage.getItem('ds_base_url') || 'https://api.deepseek.com/v1').replace(/\/v1\/?$/, '');
    const ctrl2 = new AbortController();
    const cloudTimer = setTimeout(() => ctrl2.abort(), CLOUD_TIMEOUT);
    if (externalAbort) externalAbort.addEventListener('abort', () => ctrl2.abort());
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: optModel || localStorage.getItem('ds_model') || 'deepseek-chat', messages, temperature, max_tokens: MAX_TOKENS, stream: !!onChunk }),
        signal: ctrl2.signal
      });
      clearTimeout(cloudTimer);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status === 401) throw new Error('API Key 无效,请在设置中检查');
        if (res.status === 429) throw new Error('API 调用频率超限,请稍后再试');
        throw new Error(`云端 API 错误 ${res.status}: ${errText.slice(0, 200)}`);
      }
      if (onChunk && res.body) return await readSSE(res.body, onChunk);
      const data = await res.json();
      const full = data.choices?.[0]?.message?.content || '';
      onChunk && onChunk(full, full);
      return full;
    } finally {
      clearTimeout(cloudTimer);
    }
  }

  function getCurrentStreamAbort() { return _currentStreamAbort; }
  function setCurrentStreamAbort(c) { _currentStreamAbort = c; }
  function clearCurrentStreamAbort() { _currentStreamAbort = null; }

  window.Core = window.Core || {};
  window.Core.AI = {
    callDeepSeek,
    readSSE,
    stripThinking,
    getLocalServerUrl,
    getCurrentStreamAbort,
    setCurrentStreamAbort,
    clearCurrentStreamAbort,
  };
})();
