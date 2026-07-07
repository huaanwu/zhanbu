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

  window.Core = window.Core || {};
  window.Core.AI = {
    callDeepSeek,
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