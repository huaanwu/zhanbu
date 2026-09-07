/**
 * 设置 + 本地模型自动发现 + 测试 — 从 app.js 拆出
 *
 * 依赖:
 *   - Core.Toast.showToast
 *   - window.Core.AI.getLocalServerIp / Port / Url
 *   - APP_VERSION / APP_BUILD_DATE (顶层全局, app.js)
 *   - Core.Util.selCal / selLeap / selGender (顶层已挂 window)
 */
(function () {
  if (typeof window === 'undefined') return;

  const showToast = (msg, type) => window.Core && window.Core.Toast && window.Core.Toast.showToast(msg, type);
  const getLocalServerIp = () => window.Core && window.Core.AI && window.Core.AI.getLocalServerIp;
  const getLocalServerPort = () => window.Core && window.Core.AI && window.Core.AI.getLocalServerPort;

  function loadSettings() {
    const key = localStorage.getItem('ds_api_key') || '';
    const model = localStorage.getItem('ds_model') || 'deepseek-chat';
    const useLocal = localStorage.getItem('use_local_model') === '1';
    const vModel = localStorage.getItem('vision_model') || 'deepseek-v4-flash-vision-exp';
    const savedIp = localStorage.getItem('local_server_ip');
    const savedPort = localStorage.getItem('local_server_port');
    const defaultIp = savedIp || '192.168.1.12';
    document.getElementById('apiKeyInput').value = key;
    document.getElementById('modelSelect').value = model;
    document.getElementById('localModelCheck').checked = useLocal;
    document.getElementById('visionModelSelect').value = vModel;
    document.getElementById('localServerIpInput').value = defaultIp;
    document.getElementById('localServerPortInput').value = savedPort || '8082';
    const savedModelName = localStorage.getItem('local_model_name');
    document.getElementById('localModelNameInput').value = savedModelName || 'default';
    updateApiStatus(key);
    // 版本号显示
    const verEl = document.getElementById('versionInfo');
    if (verEl) verEl.textContent = `版本: ${window.APP_VERSION} (${window.APP_BUILD_DATE})`;

    if (!savedIp) {
      fetch('http://localhost:11434/').then(() => {
        document.getElementById('localServerIpInput').value = 'localhost';
        document.getElementById('localServerPortInput').value = '8082';
      }).catch(() => {
        try {
          const pc = new RTCPeerConnection({ iceServers: [] });
          pc.createDataChannel('');
          pc.createOffer().then(o => pc.setLocalDescription(o));
          pc.onicecandidate = e => {
            if (!e.candidate) return;
            const m = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (m && !m[0].startsWith('127.') && !m[0].startsWith('0.')) {
              document.getElementById('localServerIpInput').value = m[0];
              pc.close();
            }
          };
          setTimeout(() => pc.close(), 2000);
        } catch (e) { console.warn('[settings] ICE candidate 监听失败:', e); }
      }).catch(() => {});
    }
  }

  function saveSettings() {
    const key = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    const useLocal = document.getElementById('localModelCheck').checked;
    const vModel = document.getElementById('visionModelSelect').value;
    const localIp = document.getElementById('localServerIpInput').value.trim() || '192.168.1.12';
    const localPort = document.getElementById('localServerPortInput').value.trim() || '8082';
    const localModelName = document.getElementById('localModelNameInput').value.trim() || 'default';
    localStorage.setItem('ds_api_key', key);
    localStorage.setItem('ds_model', model);
    localStorage.setItem('use_local_model', useLocal ? '1' : '0');
    localStorage.setItem('vision_model', vModel);
    localStorage.setItem('local_server_ip', localIp);
    localStorage.setItem('local_server_port', localPort);
    localStorage.setItem('local_model_name', localModelName);
    updateApiStatus(key);
    const msg = document.getElementById('saveMsg');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 2000);
  }

  function updateApiStatus(key) {
    const dot = document.getElementById('apiStatusDot');
    dot.className = 'status-dot ' + (key && key.length > 20 ? 'status-ok' : 'status-fail');
  }

  // 自动扫描局域网找本地模型服务器
  async function autoDiscoverServer() {
    const statusEl = document.getElementById('discoverStatus');
    statusEl.textContent = '正在获取本机IP...';
    statusEl.style.color = 'var(--text-muted)';

    let myIp = null;
    let webrtcFailed = false;
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise(resolve => {
        pc.onicecandidate = e => {
          if (e.candidate) {
            const m = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (m && !m[0].startsWith('127.') && !m[0].startsWith('0.')) {
              myIp = m[0];
              pc.close();
              resolve();
            }
          } else if (e.candidate === null) {
            pc.close();
            resolve();
          }
        };
        setTimeout(() => { pc.close(); resolve(); }, 2000);
      });
      if (!myIp) webrtcFailed = true;
    } catch (e) {
      webrtcFailed = true;
      console.warn('[settings] WebRTC 不可用:', e.message);
    }

    let base = '192.168.1';
    if (myIp) {
      const parts = myIp.split('.');
      base = `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    const scanPort = getLocalServerPort()();
    statusEl.textContent = `扫描 ${base}.1~50:${scanPort}...`;

    async function scanBatch(start, end, onError) {
      const promises = [];
      for (let i = start; i <= end; i++) {
        const ip = `${base}.${i}`;
        promises.push(new Promise(resolve => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `http://${ip}:${scanPort}/v1/models`, true);
          xhr.timeout = 1500;
          xhr.onload = () => resolve(xhr.status === 200 || xhr.status === 502 || xhr.status === 503 ? ip : null);
          xhr.onerror = () => { onError && onError(ip, 'network'); resolve(null); };
          xhr.ontimeout = () => { onError && onError(ip, 'timeout'); resolve(null); };
          xhr.send();
        }));
      }
      const results = await Promise.all(promises);
      return results.find(ip => ip !== null) || null;
    }

    let foundIp = null;
    let errorCount = 0, timeoutCount = 0;

    if (!foundIp) {
      statusEl.textContent = `扫描 ${base}.1~50:${scanPort}...`;
      foundIp = await scanBatch(1, 50, (ip, err) => { if (err === 'timeout') timeoutCount++; else errorCount++; });
    }
    if (foundIp) { done(foundIp); return; }

    statusEl.textContent = `扫描 ${base}.51~100:${scanPort}...`;
    if (!foundIp) {
      foundIp = await scanBatch(51, 100, (ip, err) => { if (err === 'timeout') timeoutCount++; else errorCount++; });
    }
    if (foundIp) { done(foundIp); return; }

    statusEl.textContent = `扫描 ${base}.101~254:${scanPort}...`;
    if (!foundIp) {
      foundIp = await scanBatch(101, 254, (ip, err) => { if (err === 'timeout') timeoutCount++; else errorCount++; });
    }
    if (foundIp) { done(foundIp); return; }

    const fallbackBases = myIp ? [] : ['192.168.0', '192.168.1', '192.168.31', '10.0.0'];
    for (const fb of fallbackBases) {
      statusEl.textContent = `扫描 ${fb}.1~50:${scanPort}...`;
      foundIp = await scanBatch(1, 50, (ip, err) => { if (err === 'timeout') timeoutCount++; else errorCount++; });
      if (foundIp) { done(foundIp); return; }
    }

    let hint = '';
    if (webrtcFailed) {
      hint = '(WebRTC 取本机IP失败,可能未授权;已尝试常见网段)';
    } else if (timeoutCount > errorCount) {
      hint = `(大量超时,可能不在同WiFi;已扫 ${timeoutCount} 个IP)`;
    } else if (errorCount > 0) {
      hint = `(网络错误,防火墙或路由阻断;已扫 ${errorCount} 个IP)`;
    } else {
      hint = `(已扫所有网段均无响应)`;
    }
    statusEl.innerHTML = `❌ 未找到 ${hint}。<br>💡 建议：在电脑上打开浏览器访问 <a href="http://localhost:${scanPort}/v1/models" target="_blank" style="color:var(--accent-gold);">http://localhost:${scanPort}/v1/models</a> 确认模型已启动，然后在上方输入框手动输入电脑IP（如 192.168.1.7）`;
    statusEl.style.color = 'var(--accent-red)';

    async function done(ip) {
      document.getElementById('localServerIpInput').value = ip;
      localStorage.setItem('local_server_ip', ip);
      document.getElementById('localModelCheck').checked = true;
      localStorage.setItem('use_local_model', '1');

      try {
        const res = await fetch('http://' + ip + ':' + scanPort + '/v1/models', { method: 'GET', mode: 'cors' });
        if (res.ok) {
          const data = await res.json();
          const models = data.data?.map(m => m.id) || [];
          if (models.length > 0) {
            document.getElementById('localModelNameInput').value = models[0];
            localStorage.setItem('local_model_name', models[0]);
            statusEl.textContent = '✅ 发现服务器: ' + ip + ':' + scanPort + '，模型: ' + models[0];
          } else {
            statusEl.textContent = '✅ 发现服务器: ' + ip + ':' + scanPort + ' (未获取到模型名)';
          }
        } else {
          statusEl.textContent = '✅ 发现服务器: ' + ip + ':' + scanPort;
        }
      } catch (e) {
        statusEl.textContent = '✅ 发现服务器: ' + ip + ':' + scanPort;
      }
      statusEl.style.color = 'var(--accent-green)';
      saveSettings();
    }
  }

  // 一键测试本地模型连接
  async function testLocalModel() {
    const statusEl = document.getElementById('discoverStatus');
    const ip = (document.getElementById('localServerIpInput')?.value || getLocalServerIp()()).replace(/\/$/, '');
    const port = document.getElementById('localServerPortInput')?.value || getLocalServerPort()();
    statusEl.textContent = `正在测试 ${ip}:${port} ...`;
    statusEl.style.color = 'var(--text-muted)';

    try {
      const res = await fetch(`http://${ip}:${port}/v1/models`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const models = data.data?.map(m => m.id).join(', ') || '未知模型';
        statusEl.textContent = `✅ 连接成功！模型列表: ${models}`;
        statusEl.style.color = 'var(--accent-green)';
        document.getElementById('localModelCheck').checked = true;
        saveSettings();
        return;
      }
    } catch (e) { console.warn('[settings] /v1/models 测试失败:', e); }

    try {
      const res = await fetch(`http://${ip}:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: (document.getElementById('localModelNameInput')?.value || 'default'), messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
      });
      if (res.ok) {
        statusEl.textContent = `✅ 连接成功！chat/completions 接口可用`;
        statusEl.style.color = 'var(--accent-green)';
        document.getElementById('localModelCheck').checked = true;
        saveSettings();
        return;
      }
      const err = await res.text().catch(() => '');
      statusEl.textContent = `⚠️ 服务器响应 ${res.status}，请检查模型是否加载: ${err.slice(0, 100)}`;
      statusEl.style.color = 'var(--accent-gold)';
    } catch (e) {
      if (e.name === 'TypeError') {
        statusEl.textContent = `❌ 连接失败。常见原因：① 模型未启动 ② IP/端口不对 ③ CORS未开启（浏览器F12看详细错误）`;
      } else {
        statusEl.textContent = `❌ 连接失败: ${e.message}`;
      }
      statusEl.style.color = 'var(--accent-red)';
    }
  }

  window.Core = window.Core || {};
  window.Core.Settings = { loadSettings, saveSettings, updateApiStatus, autoDiscoverServer, testLocalModel };
  // HTML onclick 兼容
  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;
  window.autoDiscoverServer = autoDiscoverServer;
  window.testLocalModel = testLocalModel;
})();