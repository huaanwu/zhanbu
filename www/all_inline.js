
  // lunar.bundle.js 暴露 LunarLib 全局
  if (window.LunarLib) {
    window.Solar = window.LunarLib.Solar;
    window.Lunar = window.LunarLib.Lunar;
  }
  // iztro.bundle.js 暴露 IztroLib 全局
  if (window.IztroLib) {
    window.iztroAstro = window.IztroLib.astro;
  }
  if (!window.Solar || !window.iztroAstro) {
    console.error('本地依赖加载失败，请检查 lib/lunar.bundle.js 和 lib/iztro.bundle.js');
  }


// 启动时强制加载 Expert/RAG（解决大文件脚本加载不稳定问题）
// 注意：file:// 协议下 fetch 被 CORS 阻止，依赖 script src 标签加载
(async function loadExpertRAG() {
  if (location.protocol === 'file:') {
    // file:// 协议：fetch 不可用，完全依赖 script 标签加载
    if (typeof window.Expert === 'undefined') console.error('expert.js 未加载，请检查 script 标签');
    if (typeof window.RAG === 'undefined') console.error('rag.js 未加载，请检查 script 标签');
    return;
  }
  try {
    // 使用动态 import() 替代 eval()，更安全且符合 ES Module 规范
    if (typeof window.Expert === 'undefined') {
      const module = await import('./expert.js');
      // 如果是默认导出，需要从 module.default 获取
      if (module.default) Object.assign(window, module.default);
    }
    if (typeof window.RAG === 'undefined') {
      const module = await import('./rag.js');
      if (module.default) Object.assign(window, module.default);
    }
  } catch(e) {
    // 降级：尝试使用 script 标签加载
    console.warn('ES Module 加载失败，尝试 script 标签:', e);
    if (typeof window.Expert === 'undefined') {
      const script = document.createElement('script');
      script.src = 'expert.js';
      document.head.appendChild(script);
    }
    if (typeof window.RAG === 'undefined') {
      const script = document.createElement('script');
      script.src = 'rag.js';
      document.head.appendChild(script);
    }
  }
})();

var APP_VERSION = 'v1.2.9';
var APP_BUILD_DATE = '2026-06-03';

// ========== 版本升级清理旧配置 ==========
(function() {
  const savedVer = localStorage.getItem('app_version');
  if (savedVer !== APP_VERSION) {
    console.log('版本升级:', savedVer, '->', APP_VERSION, '清除旧配置');
    localStorage.removeItem('local_server_ip');
    localStorage.setItem('app_version', APP_VERSION);
  }
})();



// ========== 全局状态 ==========
let state = {
  bazi: { cal:'solar', leap:false, gender:'male' },
  zw:   { cal:'solar', leap:false, gender:'male' },
  liuyao: { method:'time', mode:'normal' },
};
let currentBazi = null, currentBaziPrompt = '';
let currentZw = null, currentZwPrompt = '';
let currentLy = null, currentLyPrompt = '';
let currentQm = null, currentQmPrompt = '';
let currentXs = null, currentXsPrompt = '';
let currentCross = null, currentCrossPrompt = '';
let currentFs = null, currentFsPrompt = '';

// 追问模式：保存之前的内容前缀
let _followUpPrefix = '';

var DEFAULT_API_KEY = ''; // 不再硬编码，请通过设置页面配置
var DEFAULT_VISION_KEY = '';

// ========== 页面切换 ==========
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
  document.getElementById('nav' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
  if (name === 'settings') renderHistory();
}
window.switchPage = switchPage;

// ========== 通用 UI 函数 ==========
function showToast(msg, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);color:#fff;padding:10px 20px;border-radius:8px;font-size:0.9rem;z-index:9999;opacity:0;transition:opacity 0.3s;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#c94c4c' : type === 'success' ? '#5a9a5a' : '#c9a84c';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}
window.showToast = showToast;

// ========== 结果导出 ==========
function copyResult(contentId) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const text = el.textContent || '';
  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success')).catch(() => showToast('复制失败', 'error'));
}

function saveResult(contentId, filename) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const text = el.textContent || '';
  if (!text.trim()) { showToast('没有内容可保存', 'warning'); return; }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  a.download = `${filename}_${dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('已保存为文本文件', 'success');
}

function showResultActions(contentId, actionsId) {
  const content = document.getElementById(contentId);
  const actions = document.getElementById(actionsId);
  if (content && actions) {
    const hasText = (content.textContent || '').trim().length > 0;
    actions.classList.toggle('visible', hasText);
  }
}

// ========== 历史记录 + 用户反馈 ==========
function saveHistory(domain, signal, question, output) {
  if (!window.History) return;
  try {
    window.History.add(domain, signal, question, output);
  } catch (e) { console.warn('saveHistory fail:', e); }
}
window.saveHistory = saveHistory;

function addFeedbackUI(domain, contentEl, outputText, prompt, system) {
  // 先确保 contentEl 可见（如果 addFeedbackUI 在 show 之前被调）
  if (contentEl) contentEl.style.display = 'block';
  if (!outputText || outputText.length < 5) {
    if (contentEl) contentEl.textContent = '⚠️ AI 未返回内容（可能被超时/中断）。请检查网络后重试。';
  }

  // 在 AI 解读下方追加"准确度反馈"按钮
  const div = document.createElement('div');
  div.className = 'feedback-bar';
  div.style.cssText = 'margin-top:0.8rem;padding:0.6rem;background:var(--bg-inner);border-radius:6px;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;flex-wrap:wrap;';
  div.innerHTML = `
    <span style="color:var(--text-muted);">这次解读：</span>
    <button class="fb-btn" data-fb="good" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-green);padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;">✓ 准</button>
    <button class="fb-btn" data-fb="partial" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-gold);padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;">≈ 部分准</button>
    <button class="fb-btn" data-fb="bad" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-red);padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;">✗ 不准</button>
    <button class="fb-btn" data-fb="recheck" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent);padding:0.3rem 0.7rem;border-radius:4px;cursor:pointer;">🔍 二次校验</button>
    <span class="fb-status" style="color:var(--text-muted);margin-left:auto;font-size:0.75rem;">反馈将用于校准后续解读</span>
  `;
  // 移除同 container 旧 feedback-bar
  if (!contentEl || !contentEl.parentNode) return;
  contentEl.parentNode.querySelectorAll('.feedback-bar').forEach(el => el.remove());
  // 追加到 contentEl 之后
  if (contentEl.nextSibling) {
    contentEl.parentNode.insertBefore(div, contentEl.nextSibling);
  } else {
    contentEl.parentNode.appendChild(div);
  }
  setTimeout(() => div.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);

  // 找刚加的历史记录
  const items = window.History.load();
  const latest = items[items.length - 1];

  div.querySelectorAll('.fb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fb = btn.dataset.fb;
      if (fb === 'recheck') {
        doRecheck(domain, contentEl, prompt, system);
        return;
      }
      if (latest) {
        window.History.setFeedback(latest.id, fb);
        div.querySelector('.fb-status').textContent = '✓ 反馈已记录，AI 后续会参考校准';
        showToast(fb === 'good' ? '感谢反馈！' : fb === 'partial' ? '已记录，会继续改进' : '抱歉，AI 会学习改进', 'success');
      }
    });
  });

  // 追加追问区域
  addFollowUpUI(domain, contentEl);
}
window.addFeedbackUI = addFeedbackUI;

// ========== 历史记录页面 ==========
var DOMAIN_LABELS = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门', xingshi: '姓名学', cross: '三术同参', fengshui: '风水' };

function formatHistoryDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderHistory() {
  if (!window.History) return;
  const domain = document.getElementById('historyFilterDomain')?.value || 'all';
  const days = document.getElementById('historyFilterDays')?.value || 'all';
  const keyword = document.getElementById('historyFilterKeyword')?.value?.trim() || '';

  const items = window.History.search({ domain, days: days === 'all' ? 'all' : +days, keyword });
  const list = document.getElementById('historyList');
  const stats = document.getElementById('historyStats');

  // 统计
  const s = window.History.stats();
  stats.textContent = `共 ${s.total} 条记录` + (items.length !== s.total ? `（筛选后 ${items.length} 条）` : '');

  if (items.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><div style="font-size:3rem;margin-bottom:1rem;">📜</div><p style="font-size:1rem;">暂无占卜记录</p><p style="font-size:0.8rem;">开始你的第一次占卜吧</p></div>';
    return;
  }

  let html = '';
  for (const item of items.slice(0, 50)) {
    const label = DOMAIN_LABELS[item.domain] || item.domain;
    const fbIcon = item.feedback === 'good' ? '✓' : item.feedback === 'partial' ? '≈' : item.feedback === 'bad' ? '✗' : '○';
    const fbColor = item.feedback === 'good' ? 'var(--accent-green)' : item.feedback === 'partial' ? 'var(--accent-gold)' : item.feedback === 'bad' ? 'var(--accent-red)' : 'var(--text-muted)';
    const summary = (item.output || '').slice(0, 80).replace(/\n/g, ' ');
    html += `
      <div class="history-item" style="border-bottom:1px solid var(--border);padding:0.6rem 0;"
          data-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;"
             onclick="toggleHistoryDetail('${item.id}')"
             style="cursor:pointer;">
          <div style="flex:1;min-width:0;">
            <span style="display:inline-block;background:var(--bg-inner);color:var(--accent-gold);font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:4px;margin-right:0.3rem;">${label}</span>
            <span style="font-size:0.8rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70vw;display:inline-block;vertical-align:middle;">${item.question || '无问题'}</span>
            <span style="font-size:0.75rem;color:${fbColor};margin-left:0.3rem;">${fbIcon}</span>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;">${formatHistoryDate(item.ts)}</span>
        </div>
        <div class="history-summary" style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;"
             onclick="toggleHistoryDetail('${item.id}')">
          ${summary}${(item.output||'').length > 80 ? '...' : ''}
        </div>
        <div class="history-detail" id="hd-${item.id}" style="display:none;margin-top:0.5rem;padding:0.5rem;background:var(--bg-inner);border-radius:6px;font-size:0.8rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.6;max-height:40vh;overflow-y:auto;">
          ${(item.output || '').replace(/</g, '&lt;')}
        </div>
        <div class="history-actions" style="display:none;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;" id="ha-${item.id}">
          <button onclick="copyHistoryText('${item.id}')" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">📋 复制</button>
          <button onclick="deleteHistoryItem('${item.id}')" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-red);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">🗑️ 删除</button>
        </div>
      </div>
    `;
  }
  list.innerHTML = html;
}

function toggleHistoryDetail(id) {
  const detail = document.getElementById('hd-' + id);
  const actions = document.getElementById('ha-' + id);
  if (!detail) return;
  const show = detail.style.display === 'none';
  detail.style.display = show ? 'block' : 'none';
  if (actions) actions.style.display = show ? 'flex' : 'none';
}

function copyHistoryText(id) {
  if (!window.History) return;
  const items = window.History.load();
  const item = items.find(i => i.id === id);
  if (!item) return;
  const text = `[${DOMAIN_LABELS[item.domain] || item.domain}] ${item.question || ''}\n\n${item.output || ''}`;
  navigator.clipboard.writeText(text).then(() => showToast('已复制', 'success')).catch(() => showToast('复制失败', 'error'));
}

function deleteHistoryItem(id) {
  if (!confirm('确定删除这条记录？')) return;
  if (!window.History) return;
  window.History.delete(id);
  renderHistory();
  showToast('已删除', 'success');
}

function clearAllHistory() {
  if (!window.History || window.History.load().length === 0) { showToast('没有记录可清空', 'warning'); return; }
  if (!confirm('确定清空全部历史记录？此操作不可恢复。')) return;
  window.History.clear();
  renderHistory();
  showToast('历史记录已清空', 'success');
}

// 追问UI：在feedback-bar后追加追问输入框
function addFollowUpUI(domain, contentEl) {
  // 移除旧的追问栏
  if (!contentEl || !contentEl.parentNode) return;
  contentEl.parentNode.querySelectorAll('.follow-up-bar').forEach(el => el.remove());

  const fu = document.createElement('div');
  fu.className = 'follow-up-bar';
  fu.style.cssText = 'margin-top:0.6rem;padding:0.5rem;background:var(--bg-inner);border-radius:6px;';
  fu.innerHTML = `
    <div style="display:flex;gap:0.4rem;">
      <input type="text" class="fu-input" placeholder="💬 追问新问题..." style="flex:1;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem 0.5rem;border-radius:6px;font-size:0.85rem;">
      <button class="fu-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-gold);padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">追问</button>
    </div>
  `;

  const input = fu.querySelector('.fu-input');
  const btn = fu.querySelector('.fu-btn');

  btn.addEventListener('click', () => {
    const q = input.value.trim();
    if (!q) { showToast('请输入追问内容', 'warning'); return; }

    const saved = contentEl.textContent || '';
    const updaters = {
      bazi: () => { currentBazi.question = q; currentBaziPrompt = buildBaziPrompt(currentBazi); _followUpPrefix = saved; doAIBazi(); },
      ziwei: () => { currentZw.question = q; currentZwPrompt = buildZiweiPrompt(currentZw, q); _followUpPrefix = saved; doAIZiwei(); },
      liuyao: () => { currentLy.question = q; currentLyPrompt = buildLiuyaoPrompt(currentLy, q); _followUpPrefix = saved; doAILiuyao(); },
      qimen: () => { currentQm.question = q; currentQmPrompt = buildQimenPrompt(currentQm, q); _followUpPrefix = saved; doAIQimen(); },
      cross: () => { currentCross.question = q; currentCrossPrompt = buildCrossPrompt(currentCross); _followUpPrefix = saved; doAICross(); },
      fengshui: () => { currentFs.question = q; currentFsPrompt = buildFengshuiPrompt(currentFs, q); _followUpPrefix = saved; doAIFengshui(); },
    };

    if (updaters[domain]) updaters[domain]();
    else showToast('该模块暂不支持追问', 'warning');
  });

  const fb = contentEl.parentNode.querySelector('.feedback-bar');
  if (fb && fb.nextSibling) {
    contentEl.parentNode.insertBefore(fu, fb.nextSibling);
  } else if (fb) {
    contentEl.parentNode.appendChild(fu);
  }
}

// 二次校验：用不同模型参数重新解读，对比结果
async function doRecheck(domain, contentEl, prompt, system) {
  const statusEl = contentEl.parentNode.querySelector('.fb-status');
  if (statusEl) statusEl.textContent = '二次校验中（切换推理策略）...';
  
  let fullText = '';
  try {
    // 使用更高temperature（0.7）和不同模型（如果可用）进行交叉验证
    const text = await callDeepSeek(prompt, system, (delta, full) => {
      fullText = full;
      contentEl.textContent = '\n【二次校验结果】\n\n' + full;
    }, { temperature: 0.7 });
    
    // 保存二次校验结果到历史
    saveHistory(domain + '_recheck', 'recheck', '二次校验', fullText || text);
    
    if (statusEl) statusEl.textContent = '✓ 二次校验完成，请对比两次结果';
    showToast('二次校验完成，请对比两次结果差异', 'success');
  } catch (e) {
    if (statusEl) statusEl.textContent = '✗ 二次校验失败: ' + e.message;
    showToast('二次校验失败: ' + e.message, 'error');
  }
}
window.doRecheck = doRecheck;

// 找相似历史并格式化
function getSimilarHistoryPrompt(domain, signal, question) {
  if (!window.History) return '';
  const similar = window.History.findSimilar(domain, signal, question, 3);
  return window.History.formatForPrompt(similar);
}
window.getSimilarHistoryPrompt = getSimilarHistoryPrompt;

function initDateInputs() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const h = now.getHours();
  const zhiIdx = Math.floor((h + 1) / 2) % 12;

  const baziY = document.getElementById('baziYear');
  const baziM = document.getElementById('baziMonth');
  const baziD = document.getElementById('baziDay');
  const baziH = document.getElementById('baziHour');
  if (baziY) { baziY.value = y; baziM.value = m; baziD.value = d; baziH.value = h; }

  const zwY = document.getElementById('zwYear');
  const zwM = document.getElementById('zwMonth');
  const zwD = document.getElementById('zwDay');
  const zwH = document.getElementById('zwHour');
  if (zwY) { zwY.value = y; zwM.value = m; zwD.value = d; }
  if (zwH) zwH.value = zhiIdx;

  const qmY = document.getElementById('qmYear');
  const qmM = document.getElementById('qmMonth');
  const qmD = document.getElementById('qmDay');
  const qmH = document.getElementById('qmHour');
  if (qmY) { qmY.value = y; qmM.value = m; qmD.value = d; qmH.value = h; }

  // 三术同参
  const cxY = document.getElementById('cxYear');
  const cxM = document.getElementById('cxMonth');
  const cxD = document.getElementById('cxDay');
  const cxH = document.getElementById('cxHour');
  if (cxY) { cxY.value = y; cxM.value = m; cxD.value = d; cxH.value = h; }
}
window.initDateInputs = initDateInputs;

function selCal(btn, prefix) {
  document.querySelectorAll(`[data-cal]`).forEach(b => {
    if(b.closest('#page' + (prefix==='bazi'?'Bazi':'Ziwei'))) b.classList.remove('active');
  });
  btn.classList.add('active');
  state[prefix].cal = btn.dataset.cal;
  document.getElementById(prefix + 'LeapWrap').style.display = btn.dataset.cal === 'lunar' ? 'block' : 'none';
}
function selLeap(btn, prefix) {
  document.querySelectorAll(`[data-leap]`).forEach(b => {
    if(b.closest('#page' + (prefix==='bazi'?'Bazi':'Ziwei'))) b.classList.remove('active');
  });
  btn.classList.add('active');
  state[prefix].leap = btn.dataset.leap === 'true';
}
function selGender(btn, prefix) {
  document.querySelectorAll(`[data-gender]`).forEach(b => {
    if(b.closest('#page' + (prefix==='bazi'?'Bazi':'Ziwei'))) b.classList.remove('active');
  });
  btn.classList.add('active');
  state[prefix].gender = btn.dataset.gender;
}
window.selCal = selCal; window.selLeap = selLeap; window.selGender = selGender;

// ========== 设置 ==========
function loadSettings() {
  const key = localStorage.getItem('ds_api_key') || '';
  const model = localStorage.getItem('ds_model') || 'deepseek-chat';
  const useLocal = localStorage.getItem('use_local_model') === '1';
  const vKey = localStorage.getItem('vision_api_key') || DEFAULT_VISION_KEY;
  const vModel = localStorage.getItem('vision_model') || 'qwen-vl-plus';
  const savedIp = localStorage.getItem('local_server_ip');
  const savedPort = localStorage.getItem('local_server_port');
  const defaultIp = savedIp || '192.168.1.12';
  document.getElementById('apiKeyInput').value = key;
  document.getElementById('modelSelect').value = model;
  document.getElementById('localModelCheck').checked = useLocal;
  document.getElementById('visionKeyInput').value = vKey;
  document.getElementById('visionModelSelect').value = vModel;
  document.getElementById('localServerIpInput').value = defaultIp;
  document.getElementById('localServerPortInput').value = savedPort || '8082';
  updateApiStatus(key);
  // 版本号显示
  const verEl = document.getElementById('versionInfo');
  if (verEl) verEl.textContent = `版本: ${APP_VERSION} (${APP_BUILD_DATE})`;
  
  // 尝试用WebRTC获取本机IP，如果还没保存过则更新显示
  if (!savedIp) {
    try {
      const pc = new RTCPeerConnection({iceServers: []});
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
    } catch(e) {}
  }
}
function saveSettings() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;
  const useLocal = document.getElementById('localModelCheck').checked;
  const vKey = document.getElementById('visionKeyInput').value.trim();
  const vModel = document.getElementById('visionModelSelect').value;
  const localIp = document.getElementById('localServerIpInput').value.trim() || '192.168.1.12';
  const localPort = document.getElementById('localServerPortInput').value.trim() || '8082';
  localStorage.setItem('ds_api_key', key);
  localStorage.setItem('ds_model', model);
  localStorage.setItem('use_local_model', useLocal ? '1' : '0');
  localStorage.setItem('vision_api_key', vKey);
  localStorage.setItem('vision_model', vModel);
  localStorage.setItem('local_server_ip', localIp);
  localStorage.setItem('local_server_port', localPort);
  updateApiStatus(key);
  const msg = document.getElementById('saveMsg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2000);
}
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;

function updateApiStatus(key) {
  const dot = document.getElementById('apiStatusDot');
  dot.className = 'status-dot ' + (key && key.length > 20 ? 'status-ok' : 'status-fail');
}

// 获取本地服务器IP和端口
function getLocalServerIp() {
  return (localStorage.getItem('local_server_ip') || '192.168.1.3').replace(/\/$/, '');
}
function getLocalServerPort() {
  return localStorage.getItem('local_server_port') || '8082';
}
function getLocalServerUrl() {
  return `http://${getLocalServerIp()}:${getLocalServerPort()}`;
}

// 过滤模型输出的英文 thinking / 分析过程，只保留中文正文
function stripThinking(text) {
  if (!text) return '';
  // 匹配常见的英文 thinking 开头，一直到中文内容开始（## 标题 或 【 或 结论性内容）
  let t = text;
  // 模式1: Here's a thinking process: ... 到中文标题前
  t = t.replace(/Here's\s+a\s+thinking\s*process:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
  // 模式2: Thinking Process: ...
  t = t.replace(/Thinking\s*[Pp]rocess:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
  // 模式3: Step by step analysis: ...
  t = t.replace(/Step\s*by\s*step\s*analysis:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
  // 模式4: Let me analyze this: ...
  t = t.replace(/Let\s+me\s+analyze\s+this:.*?(?=## |\n## |^## |【|Output\s*Generation|Generating)/is, '');
  // 模式5: 单独的 "Output Generation" / "Generating..." / "Self-Correction" 等元标记
  t = t.replace(/\n?Output\s*Generation.*$/is, '');
  t = t.replace(/\n?\*\(Self-Correction[\s\S]*?\)\*\s*$/is, '');
  t = t.replace(/\n?\*\*?Self-Correction[\s\S]*?\*\*?\s*$/is, '');
  return t;
}

// SSE 流式读取器（OpenAI 兼容格式）
async function readSSE(body, onChunk) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let rawFull = '';      // 原始累积（含 thinking）
  let filteredFull = ''; // 过滤后累积（用户看到的内容）
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
          // 防御：处理 reasoning_content（Qwen3.x 等模型）
          const delta = obj.choices?.[0]?.delta?.content || '';
          const reasoning = obj.choices?.[0]?.delta?.reasoning_content || '';
          const text = delta || reasoning;
          if (text) {
            rawFull += text;
            chunkCount++;
            // 实时过滤 thinking，只传递新增的过滤后内容
            const newFiltered = stripThinking(rawFull);
            if (newFiltered.length > filteredFull.length) {
              const passThrough = newFiltered.slice(filteredFull.length);
              filteredFull = newFiltered;
              onChunk(passThrough, filteredFull);
            }
            // 如果过滤后没有新增内容，不调用 onChunk（用户看不到 thinking）
          }
        } catch (e) { /* 忽略单行解析错误，继续 */ }
      }
    }
  } catch (e) {
    console.error('SSE 读取中断:', e.message);
    // 返回已接收的部分内容，不抛错
  }
  const elapsed = Date.now() - startTime;
  console.log(`SSE 完成: ${chunkCount} 块, 原始${rawFull.length}字 → 过滤后${filteredFull.length}字, ${elapsed}ms`);
  return filteredFull;
}

// 自动扫描局域网找本地模型服务器
async function autoDiscoverServer() {
  const statusEl = document.getElementById('discoverStatus');

  // Helper: set status with spinner
  function setStatusWithSpinner(text) {
    statusEl.innerHTML = `<div class="spinner" style="display:inline-block;width:14px;height:14px;border-width:2px;margin-right:8px;vertical-align:middle;flex-shrink:0;"></div><span>${text}</span>`;
    statusEl.style.color = 'var(--text-muted)';
  }

  setStatusWithSpinner('正在获取本机IP...');

  // 步骤1: 用WebRTC获取本机局域网IP
  let myIp = null;
  try {
    const pc = new RTCPeerConnection({iceServers: []});
    pc.createDataChannel('');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(resolve => {
      pc.onicecandidate = e => {
        if (e.candidate) {
          const m = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (m && !m[0].startsWith('127.')) {
            myIp = m[0];
            pc.close();
            resolve();
          }
        }
      };
      setTimeout(() => { pc.close(); resolve(); }, 2000);
    });
  } catch(e) {}

  // 步骤2: 推断网段
  let base = '192.168.1';
  if (myIp) {
    const parts = myIp.split('.');
    base = `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  const scanPort = getLocalServerPort();
  setStatusWithSpinner(`扫描中 (0/50)...`);

  // 步骤3: 并发扫描（每组20个，避免浏览器限制）
  async function scanBatch(start, end, onProgress) {
    const promises = [];
    for (let i = start; i <= end; i++) {
      const ip = `${base}.${i}`;
      promises.push(new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `http://${ip}:${scanPort}/v1/models`, true);
        xhr.timeout = 1500;
        xhr.onload = () => {
          if (xhr.status === 200) resolve(ip);
          else resolve(null);
        };
        xhr.onerror = () => resolve(null);
        xhr.ontimeout = () => resolve(null);
        xhr.send();
      }));
    }
    // Report progress as each promise settles
    let completed = start - 1;
    for (const p of promises) {
      p.then(() => {
        completed++;
        onProgress(completed);
      });
    }
    const results = await Promise.all(promises);
    return results.find(ip => ip !== null) || null;
  }

  let foundIp = null;
  // 先扫 .1~20
  if (!foundIp) foundIp = await scanBatch(1, 20, cur => {
    if (cur <= 20) setStatusWithSpinner(`扫描中 (${cur}/20)...`);
  });
  if (foundIp) { done(foundIp); return; }
  setStatusWithSpinner(`扫描中 (20/50)...`);

  // 再扫 .21~50
  if (!foundIp) foundIp = await scanBatch(21, 50, cur => {
    setStatusWithSpinner(`扫描中 (${cur}/50)...`);
  });
  if (foundIp) { done(foundIp); return; }

  // 最后扫常见fallback网段
  const fallbackBases = myIp ? [] : ['192.168.0'];
  for (const fb of fallbackBases) {
    setStatusWithSpinner(`扫描 ${fb}.1~30 中...`);
    const promises = [];
    for (let i = 1; i <= 30; i++) {
      const ip = `${fb}.${i}`;
      promises.push(new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `http://${ip}:${scanPort}/v1/models`, true);
        xhr.timeout = 1500;
        xhr.onload = () => resolve(xhr.status === 200 ? ip : null);
        xhr.onerror = () => resolve(null);
        xhr.ontimeout = () => resolve(null);
        xhr.send();
      }));
    }
    const results = await Promise.all(promises);
    foundIp = results.find(ip => ip !== null);
    if (foundIp) { done(foundIp); return; }
  }

  // 未找到
  statusEl.innerHTML = `❌ 未找到。请手动输入IP或检查：1.同WiFi 2.模型已启动(${scanPort}端口) 3.防火墙开放${scanPort}`;
  statusEl.style.color = 'var(--accent-red)';

  function done(ip) {
    document.getElementById('localServerIpInput').value = ip;
    localStorage.setItem('local_server_ip', ip);
    document.getElementById('localModelCheck').checked = true;
    localStorage.setItem('use_local_model', '1');
    statusEl.innerHTML = `✅ 发现服务器: ${ip}:${scanPort}`;
    statusEl.style.color = 'var(--accent-green)';
  }
}
window.autoDiscoverServer = autoDiscoverServer;

// 一键测试本地模型连接
async function testLocalModel() {
  const statusEl = document.getElementById('discoverStatus');
  const ip = getLocalServerIp();
  const port = getLocalServerPort();
  statusEl.textContent = `正在测试 ${ip}:${port} ...`;
  statusEl.style.color = 'var(--text-muted)';

  // 测试1: /v1/models 列表接口
  try {
    const res = await fetch(`http://${ip}:${port}/v1/models`, { method: 'GET', mode: 'cors' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const models = data.data?.map(m => m.id).join(', ') || '未知模型';
      statusEl.textContent = `✅ 连接成功！模型列表: ${models}`;
      statusEl.style.color = 'var(--accent-green)';
      return;
    }
  } catch (e) {}

  // 测试2: /v1/chat/completions 直接发一条测试消息
  try {
    const res = await fetch(`http://${ip}:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'local', messages: [{role:'user',content:'hi'}], max_tokens: 1 })
    });
    if (res.ok) {
      statusEl.textContent = `✅ 连接成功！chat/completions 接口可用`;
      statusEl.style.color = 'var(--accent-green)';
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
window.testLocalModel = testLocalModel;

// ========== 知识库 ==========
let _kb = null;
let _kbProgressEl = null;
async function ensureKB() {
  if (_kb) return _kb;
  // 显示加载进度
  _kbProgressEl = document.createElement('div');
  _kbProgressEl.id = 'kb-loading';
  _kbProgressEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;padding:16px 28px;border-radius:10px;font-size:0.9rem;z-index:99999;text-align:center;';
  _kbProgressEl.textContent = '正在加载知识库...';
  document.body.appendChild(_kbProgressEl);

  // 直接fetch JSON文件，不再依赖KB_EMBEDDED
  const fileMap = {
    // 已有知识库
    bazi: 'kb_data/bazi_kb.json',
    bazi_ext: 'kb_data/bazi_ext_kb.json',
    gua: 'kb_data/gua_kb.json',
    liuyao_ext: 'kb_data/liuyao_ext_kb.json',
    qimen: 'kb_data/qimen_kb.json',
    qimen_ext: 'kb_data/qimen_ext_kb.json',
    ziwei: 'kb_data/ziwei_kb.json',
    ziwei_ext: 'kb_data/ziwei_ext_kb.json',
    nihai_xia: 'kb_data/nihai_xia_kb.json',
    shouxiang: 'kb_data/shouxiang_kb.json',
    xingshi: 'kb_data/xingshi_kb.json',
    ziwei_fuxing: 'kb_data/ziwei_fuxing_kb.json',
    ziwei_daxian: 'kb_data/ziwei_daxian_kb.json',
    ziwei_geju: 'kb_data/ziwei_geju_kb.json',
    qimen_xingmen: 'kb_data/qimen_xingmen_kb.json',
    qimen_geju: 'kb_data/qimen_geju_kb.json',
    qimen_zhanji: 'kb_data/qimen_zhanji_kb.json',
    // 新接入知识库
    bazi_dayun: 'kb_data/bazi_dayun_kb.json',
    bazi_geju: 'kb_data/bazi_geju_kb.json',
    bazi_hehun: 'kb_data/bazi_hehun_kb.json',
    bazi_shensha: 'kb_data/bazi_shensha_kb.json',
    bazi_shensha2: 'kb_data/bazi_shensha2_kb.json',
    bazi_shishen: 'kb_data/bazi_shishen_kb.json',
    bazi_tiaohou: 'kb_data/bazi_tiaohou_kb.json',
    bazi_ziwei_hecan: 'kb_data/bazi_ziwei_hecan_kb.json',
    daoism_fuzhou: 'kb_data/daoism_fuzhou_kb.json',
    daoism_jiuhuo: 'kb_data/daoism_jiuhuo_kb.json',
    daoism_shoujue: 'kb_data/daoism_shoujue_kb.json',
    daoism_zhaijiao: 'kb_data/daoism_zhaijiao_kb.json',
    daoism_zhoushu: 'kb_data/daoism_zhoushu_kb.json',
    fengshui_base: 'kb_data/fengshui_base_kb.json',
    fengshui_ext: 'kb_data/fengshui_ext_kb.json',
    fengshui_luopan: 'kb_data/fengshui_luopan_kb.json',
    meihua_ext: 'kb_data/meihua_ext_kb.json',
    meihua_lei_xiang: 'kb_data/meihua_lei_xiang_kb.json',
    mianxiang_qise: 'kb_data/mianxiang_qise_kb.json',
    mianxiang_qise2: 'kb_data/mianxiang_qise2_kb.json',
    qimen_paipan: 'kb_data/qimen_paipan_kb.json',
    qimen_yongshen: 'kb_data/qimen_yongshen_kb.json',
    qimen_fengshui: 'kb_data/qimen_fengshui_jiehe_kb.json',
    qise: 'kb_data/qise_kb.json',
    xingshi_cases: 'kb_data/xingshi_cases_kb.json',
    ziwei_ext2: 'kb_data/ziwei_ext2_kb.json',
    ziwei_daxian2: 'kb_data/ziwei_daxian2_kb.json',
    ziwei_gongwei: 'kb_data/ziwei_gongwei_kb.json',
    ziwei_sihua: 'kb_data/ziwei_sihua_kb.json',
    ziwei_zuhe: 'kb_data/ziwei_zuhe_kb.json',
    liuyao_najia: 'kb_data/liuyao_najia_kb.json',
    liuyao_liuqin: 'kb_data/liuyao_liuqin_kb.json',
    liuyao_liushen: 'kb_data/liuyao_liushen_kb.json',
    liuyao_xunkong: 'kb_data/liuyao_xunkong_kb.json',
    liuyao_cases: 'kb_data/liuyao_cases_kb.json',
    liuyao_jintui: 'kb_data/liuyao_jintui_kb.json',
    liuyao_meihua_hucan: 'kb_data/liuyao_meihua_hucan_kb.json',
    shouxiang_wenli: 'kb_data/shouxiang_wenli_kb.json',
    shengxiang: 'kb_data/shengxiang_kb.json',
    guxiang: 'kb_data/guxiang_kb.json',
    wannianli: 'kb_data/wannianli_kb.json',
    zeri_ext: 'kb_data/zeri_ext_kb.json',
    zeri_jixiong: 'kb_data/zeri_jixiong_kb.json',
    buddhism_divine: 'kb_data/buddhism_divine_kb.json',
    buddhism_mantra: 'kb_data/buddhism_mantra_kb.json',
  };
  try {
    const total = Object.keys(fileMap).length;
    let loaded = 0;
    const entries = await Promise.all(
      Object.entries(fileMap).map(async ([key, path]) => {
        try {
          const r = await fetch(path);
          if (!r.ok) return [key, {}];
          const data = await r.json();
          loaded++;
          if (_kbProgressEl) _kbProgressEl.textContent = `正在加载知识库... ${loaded}/${total}`;
          return [key, data];
        } catch { loaded++; if (_kbProgressEl) _kbProgressEl.textContent = `正在加载知识库... ${loaded}/${total}`; return [key, {}]; }
      })
    );
    _kb = Object.fromEntries(entries);
  } catch(e) {
    console.warn('ensureKB load fail:', e);
    _kb = Object.fromEntries(Object.keys(fileMap).map(k => [k, {}]));
  } finally {
    if (_kbProgressEl) { _kbProgressEl.remove(); _kbProgressEl = null; }
  }
  return _kb;
}

function judgeWangShuai(dayGan, gz) {
  const wuXing = WX[dayGan];
  const monthZhi = gz.month[1];
  const lingWang = {
    '木': ['寅','卯'], '火': ['巳','午'], '土': ['辰','戌','丑','未'],
    '金': ['申','酉'], '水': ['亥','子']
  };
  const lingXiang = {
    '木': ['亥','子'], '火': ['寅','卯'], '土': ['巳','午'],
    '金': ['辰','戌','丑','未'], '水': ['申','酉']
  };
  const lingXiu = {
    '木': ['巳','午'], '火': ['辰','戌','丑','未'], '土': ['申','酉'],
    '金': ['亥','子'], '水': ['寅','卯']
  };
  const lingJue = {
    '木': ['申','酉'], '火': ['亥','子'], '土': ['寅','卯'],
    '金': ['巳','午'], '水': ['辰','戌','丑','未']
  };
  let score = 0;
  if (lingWang[wuXing].includes(monthZhi)) score += 3;
  else if (lingXiang[wuXing].includes(monthZhi)) score += 2;
  else if (lingXiu[wuXing].includes(monthZhi)) score += 0;
  else if (lingJue[wuXing].includes(monthZhi)) score -= 2;
  else score -= 1;
  const roots = {
    '木': ['寅','卯'], '火': ['巳','午'], '土': ['辰','戌','丑','未'],
    '金': ['申','酉'], '水': ['亥','子']
  };
  for (const k of ['year','month','hour']) {
    if (roots[wuXing].includes(gz[k][1])) score += 1;
  }
  const biJie = {
    '甲': ['甲','乙'], '乙': ['甲','乙'], '丙': ['丙','丁'], '丁': ['丙','丁'],
    '戊': ['戊','己'], '己': ['戊','己'], '庚': ['庚','辛'], '辛': ['庚','辛'],
    '壬': ['壬','癸'], '癸': ['壬','癸']
  };
  for (const k of ['year','month','hour']) {
    if (biJie[dayGan].includes(gz[k][0])) score += 1;
  }
  return score >= 3 ? '身强' : '身弱';
}

function kbBazi(pan) {
  const k = _kb?.bazi || {};
  const dayGan = pan.gz?.day?.[0];
  if (!dayGan) return '';
  const wxMap = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const dmKey = dayGan + wxMap[dayGan];
  let s = '\n\n【知识库参考】';
  if (k.day_master?.[dmKey]) s += `\n· 日主${dmKey}：${k.day_master[dmKey]}`;
  const tenGodNames = ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'];
  const godSet = new Set();
  for (const [, v] of Object.entries(pan.tenGods || {})) {
    if (!v) continue;
    for (const god of tenGodNames) { if (v.includes(god)) godSet.add(god); }
  }
  for (const god of godSet) { if (k.ten_gods?.[god]) s += `\n· ${god}：${k.ten_gods[god]}`; }
  const wangShuai = judgeWangShuai(dayGan, pan.gz);
  const wsKey = wangShuai + wxMap[dayGan];
  if (k.useful_god?.[wsKey]) s += `\n· ${wsKey}用神喜忌：${k.useful_god[wsKey]}`;
  return s;
}

var GUA_NAME_MAP = {
  '乾为天':'乾','坤为地':'坤','水雷屯':'屯','山水蒙':'蒙','水天需':'需','天水讼':'讼',
  '地水师':'师','水地比':'比','风天小畜':'小畜','天泽履':'履','地天泰':'泰','天地否':'否',
  '天火同人':'同人','火天大有':'大有','地山谦':'谦','雷地豫':'豫','泽雷随':'随','山风蛊':'蛊',
  '地泽临':'临','风地观':'观','火雷噬嗑':'噬嗑','山火贲':'贲','山地剥':'剥','地雷复':'复',
  '天雷无妄':'无妄','山天大畜':'大畜','山雷颐':'颐','泽风大过':'大过','坎为水':'坎','离为火':'离',
  '泽山咸':'咸','雷风恒':'恒','天山遁':'遁','雷天大壮':'大壮','火地晋':'晋','地火明夷':'明夷',
  '风火家人':'家人','火泽睽':'睽','水山蹇':'蹇','雷水解':'解','山泽损':'损','风雷益':'益',
  '泽天夬':'夬','天风姤':'姤','泽地萃':'萃','地风升':'升','泽水困':'困','水风井':'井',
  '泽火革':'革','火风鼎':'鼎','震为雷':'震','艮为山':'艮','风山渐':'渐','雷泽归妹':'归妹',
  '雷火丰':'丰','火山旅':'旅','巽为风':'巽','兑为泽':'兑','风水涣':'涣','水泽节':'节',
  '风泽中孚':'中孚','雷山小过':'小过','水火既济':'既济','火水未济':'未济'
};

function kbLiuyao(pan) {
  const k = _kb?.gua || {};
  const fullName = pan.gua?.name;
  const guaName = GUA_NAME_MAP[fullName] || fullName?.[0];
  if (!guaName || !k.gua?.[guaName]) return '';
  const g = k.gua[guaName];
  let s = `\n\n【知识库参考】\n· 卦辞：${g.gua_ci}\n· 象义：${g.xiang}\n· 求财：${g.qiu_cai}\n· 事业：${g.shi_ye}\n· 感情：${g.gan_qing}`;
  const dongYao = pan.gua?.dongYao;
  if (dongYao && k.yao_ci?.[guaName]?.[dongYao]) {
    s += `\n· 动爻（第${dongYao}爻）爻辞：${k.yao_ci[guaName][dongYao]}`;
  }
  return s;
}

function kbQimen(pan) {
  const k = _kb?.qimen || {};
  const stars = new Set(), doors = new Set(), gods = new Set();
  for (const g of pan.gong9 || []) {
    if (g.jiuxing) stars.add(g.jiuxing);
    if (g.renpan) doors.add(g.renpan);
    if (g.shenpan) gods.add(g.shenpan);
  }
  let s = '\n\n【知识库参考】';
  for (const star of stars) { if (k.jiuxing?.[star]) s += `\n· 九星·${star}：${k.jiuxing[star]}`; }
  for (const door of doors) { if (k.bamen?.[door]) s += `\n· 八门·${door}：${k.bamen[door]}`; }
  for (const god of gods) { if (k.bashen?.[god]) s += `\n· 八神·${god}：${k.bashen[god]}`; }
  return s;
}

function kbShouxiang() {
  const k = _kb?.shouxiang || {};
  let s = '\n\n【知识库参考】';
  // 掌型
  if (k.palm_types) {
    s += '\n\n· 掌型分类：';
    for (const [name, desc] of Object.entries(k.palm_types)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 手指特征
  if (k.fingers) {
    s += '\n\n· 手指特征：';
    for (const [name, info] of Object.entries(k.fingers)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 主线
  if (k.main_lines) {
    s += '\n\n· 主线详解：';
    for (const [name, info] of Object.entries(k.main_lines)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 辅线
  if (k.secondary_lines) {
    s += '\n\n· 辅线详解：';
    for (const [name, info] of Object.entries(k.secondary_lines)) {
      if (typeof info === 'string') {
        s += `\n  ${name}：${info}`;
      } else if (typeof info === 'object') {
        s += `\n  ${name}：`;
        for (const [sub, desc] of Object.entries(info)) {
          s += `\n    - ${sub}：${desc}`;
        }
      }
    }
  }
  // 掌丘
  if (k.palm_mounds) {
    s += '\n\n· 掌丘释义：';
    for (const [name, desc] of Object.entries(k.palm_mounds)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 特殊纹
  if (k.special_marks) {
    s += '\n\n· 特殊纹路：';
    for (const [name, desc] of Object.entries(k.special_marks)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 手色手温
  if (k.hand_color_temp) {
    s += '\n\n· 手色与温度：';
    for (const [name, desc] of Object.entries(k.hand_color_temp)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 指甲
  if (k.nails) {
    s += '\n\n· 指甲解读：';
    for (const [name, desc] of Object.entries(k.nails)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 性别规则
  if (k.gender_rules) {
    s += '\n\n· 性别与左右手规则：';
    for (const [name, desc] of Object.entries(k.gender_rules)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbZiwei(chart) {
  const k = _kb?.ziwei || {};
  const mainStars = chart.mingGong?.stars?.filter(s => s.type === 'main').map(s => s.name) || [];
  let s = '\n\n【知识库参考】';
  for (const star of mainStars) { if (k.main_stars?.[star]) s += `\n· ${star}：${k.main_stars[star]}`; }
  for (const [, v] of Object.entries(chart.siHua || {})) { if (k.si_hua?.[v]) s += `\n· ${v}：${k.si_hua[v]}`; }
  if (k.palaces?.[chart.mingGong?.name]) s += `\n· ${chart.mingGong.name}：${k.palaces[chart.mingGong.name]}`;
  return s;
}

function kbZiweiExt() {
  const k = _kb?.ziwei_ext || {};
  let s = '\n\n【扩展知识库·紫微】';
  // 星曜组合
  if (k.star_combo) {
    s += '\n· 星曜组合：';
    for (const [combo, desc] of Object.entries(k.star_combo)) {
      s += `\n  ${combo}：${desc}`;
    }
  }
  // 四化
  if (k.si_hua) {
    s += '\n· 四化释义：';
    for (const [name, desc] of Object.entries(k.si_hua)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 大限信息
  if (k.da_xian) {
    s += '\n· 大限运势：';
    for (const [name, desc] of Object.entries(k.da_xian)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 流年信息
  if (k.liu_nian) {
    s += '\n· 流年运势：';
    for (const [name, desc] of Object.entries(k.liu_nian)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 身宫
  if (k.shen_gong) {
    s += '\n· 身宫释义：';
    for (const [name, desc] of Object.entries(k.shen_gong)) {
      s += `\n  身宫在${name}：${desc}`;
    }
  }
  // 庙旺利陷
  if (k.miao_wang) {
    s += '\n· 主星庙旺利陷：';
    for (const [star, desc] of Object.entries(k.miao_wang)) {
      s += `\n  ${star}：${desc}`;
    }
  }
  // 辅星
  if (k.fu_xing) {
    s += '\n· 辅星释义：';
    for (const [star, desc] of Object.entries(k.fu_xing)) {
      s += `\n  ${star}：${desc}`;
    }
  }
  return s;
}

function kbZiweiFuxing() {
  const k = _kb?.ziwei_fuxing || {};
  let s = '\n\n【扩展知识库·紫微辅星】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.palace_effect) s += ` 入宫：${item.palace_effect}`;
      if (item.combo) s += ` 组合：${item.combo}`;
    }
  }
  return s;
}

function kbZiweiDaxian() {
  const k = _kb?.ziwei_daxian || {};
  let s = '\n\n【扩展知识库·紫微大限流年】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.example) s += ` 示例：${item.example}`;
      if (item.method) s += ` 方法：${item.method}`;
    }
  }
  return s;
}

function kbZiweiGeju() {
  const k = _kb?.ziwei_geju || {};
  let s = '\n\n【扩展知识库·紫微格局】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.condition) s += ` 条件：${item.condition}`;
      if (item.effect) s += ` 作用：${item.effect}`;
      if (item.taboo) s += ` 忌讳：${item.taboo}`;
      if (item.remedy) s += ` 化解：${item.remedy}`;
    }
  }
  return s;
}

function kbQimenXingmen() {
  const k = _kb?.qimen_xingmen || {};
  let s = '\n\n【扩展知识库·奇门八门九星八神】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.wangshuai) s += ` 旺衰：${item.wangshuai}`;
      if (item.usage) s += ` 用途：${item.usage}`;
      if (item.combo) s += ` 组合：${item.combo}`;
    }
  }
  return s;
}

function kbQimenGeju() {
  const k = _kb?.qimen_geju || {};
  let s = '\n\n【扩展知识库·奇门格局】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.condition) s += ` 条件：${item.condition}`;
      if (item.effect) s += ` 作用：${item.effect}`;
      if (item.usage) s += ` 用途：${item.usage}`;
    }
  }
  return s;
}

function kbQimenZhanji() {
  const k = _kb?.qimen_zhanji || {};
  let s = '\n\n【扩展知识库·奇门实战占断】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.method) s += ` 方法：${item.method}`;
    }
  }
  return s;
}

function kbBaziExt(pan) {
  const k = _kb?.bazi_ext || {};
  let s = '\n\n【扩展知识库·八字】';
  // 神煞
  if (k.shen_sha) {
    s += '\n· 神煞释义：';
    for (const [name, desc] of Object.entries(k.shen_sha)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 格局
  if (k.ge_ju) {
    s += '\n· 格局释义：';
    for (const [name, desc] of Object.entries(k.ge_ju)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 刑冲合会
  if (k.xing_chong_he) {
    s += '\n· 刑冲合会：';
    for (const [name, desc] of Object.entries(k.xing_chong_he)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 空亡
  if (k.kong_wang) {
    s += '\n· 空亡释义：';
    for (const [name, desc] of Object.entries(k.kong_wang)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbLiuyaoExt() {
  const k = _kb?.liuyao_ext || {};
  let s = '\n\n【扩展知识库·六爻】';
  // 用神取法
  if (k.yong_shen) {
    s += '\n· 用神取法：';
    for (const [type, desc] of Object.entries(k.yong_shen)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  // 六神
  if (k.liu_shen) {
    s += '\n· 六神释义：';
    for (const [name, desc] of Object.entries(k.liu_shen)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 动爻
  if (k.dong_yao) {
    s += '\n· 动爻变化：';
    for (const [type, desc] of Object.entries(k.dong_yao)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  // 旬空
  if (k.kong_wang) {
    s += '\n· 旬空释义：';
    for (const [name, desc] of Object.entries(k.kong_wang)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 月破
  if (k.yue_po) {
    s += '\n· 月破释义：';
    for (const [name, desc] of Object.entries(k.yue_po)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 反吟伏吟
  if (k.fan_yin_fu_yin) {
    s += '\n· 反吟伏吟：';
    for (const [name, desc] of Object.entries(k.fan_yin_fu_yin)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 游魂归魂
  if (k.you_hun_gui_hun) {
    s += '\n· 游魂归魂：';
    for (const [name, desc] of Object.entries(k.you_hun_gui_hun)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 世应
  if (k.shi_ying) {
    s += '\n· 世应关系：';
    for (const [name, desc] of Object.entries(k.shi_ying)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbQimenExt() {
  const k = _kb?.qimen_ext || {};
  let s = '\n\n【扩展知识库·奇门】';
  // 吉凶格局
  if (k.ji_xiong_ge) {
    s += '\n· 吉凶格局：';
    for (const [name, desc] of Object.entries(k.ji_xiong_ge)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 九星
  if (k.jiu_xing) {
    s += '\n· 九星释义：';
    for (const [name, desc] of Object.entries(k.jiu_xing)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 八神
  if (k.ba_shen) {
    s += '\n· 八神释义：';
    for (const [name, desc] of Object.entries(k.ba_shen)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 八门
  if (k.men_pan) {
    s += '\n· 八门释义：';
    for (const [name, desc] of Object.entries(k.men_pan)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 日时关系
  if (k.ri_shi) {
    s += '\n· 日时关系：';
    for (const [name, desc] of Object.entries(k.ri_shi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 三奇六仪
  if (k.san_qi) {
    s += '\n· 三奇释义：';
    for (const [name, desc] of Object.entries(k.san_qi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  // 断事方法
  if (k.duan_shi) {
    s += '\n· 断事方法：';
    for (const [name, desc] of Object.entries(k.duan_shi)) {
      s += `\n  ${name}：${desc}`;
    }
  }
  return s;
}

function kbNihaiXia() {
  const k = _kb?.nihai_xia || {};
  let s = '\n\n【倪海厦命理精华】';
  // 八字
  if (k.bazi) {
    s += '\n· 八字诀窍：';
    for (const [tip, desc] of Object.entries(k.bazi)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 六爻
  if (k.liuyao) {
    s += '\n· 六爻诀窍：';
    for (const [tip, desc] of Object.entries(k.liuyao)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 奇门
  if (k.qimen) {
    s += '\n· 奇门诀窍：';
    for (const [tip, desc] of Object.entries(k.qimen)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 紫微
  if (k.ziwei) {
    s += '\n· 紫微诀窍：';
    for (const [tip, desc] of Object.entries(k.ziwei)) {
      s += `\n  ${tip}：${desc}`;
    }
  }
  // 常见误区
  if (k.common_pitfalls) {
    s += '\n· 常见误区纠正：';
    for (const [type, desc] of Object.entries(k.common_pitfalls)) {
      s += `\n  ${type}：${desc}`;
    }
  }
  return s;
}

// ========== 新知识库接入函数 ==========

// 八字大运流年
function kbBaziDayun(pan) {
  const k = _kb?.bazi_dayun || {};
  if (!k.entries) return '';
  let s = '\n\n【大运流年知识库】';
  // 找相关内容（根据问事关键词匹配）
  const q = (pan.question || '').toLowerCase();
  const matched = k.entries.filter(e => {
    const kw = (e.keywords || '').toLowerCase();
    return kw.includes(q) || q.includes(kw);
  }).slice(0, 5);
  if (matched.length > 0) {
    for (const item of matched) {
      s += `\n· ${item.title}：${item.content}`;
      if (item.method) s += ` 方法：${item.method}`;
    }
  } else {
    // 默认展示前3条通用知识
    for (const item of k.entries.slice(0, 3)) {
      s += `\n· ${item.title}：${item.content}`;
    }
  }
  return s;
}

// 八字格局
function kbBaziGeju(pan) {
  const k = _kb?.bazi_geju || {};
  if (!k.entries) return '';
  let s = '\n\n【八字格局知识库】';
  // 根据十神匹配格局
  const tenGods = pan.tenGods ? Object.values(pan.tenGods).flat() : [];
  const tenGodSet = new Set(tenGods);
  const matched = k.entries.filter(e => {
    if (!e.category) return false;
    return tenGodSet.has(e.category) || tenGodSet.has(e.category.replace('格', ''));
  }).slice(0, 5);
  if (matched.length > 0) {
    for (const item of matched) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.condition) s += ` 条件：${item.condition}`;
    }
  } else {
    for (const item of k.entries.slice(0, 3)) {
      s += `\n· ${item.title}：${item.content}`;
    }
  }
  return s;
}

// 八字合婚（仅当问婚恋时使用）
function kbBaziHehun(pan) {
  const k = _kb?.bazi_hehun || {};
  if (!k.entries) return '';
  const q = (pan.question || '').toLowerCase();
  // 只有问婚姻感情时才加入合婚知识
  if (!q.includes('婚') && !q.includes('恋') && !q.includes('配') && !q.includes('偶')) return '';
  let s = '\n\n【合婚知识库】';
  const matched = k.entries.filter(e => {
    const kw = (e.keywords || '').toLowerCase();
    return kw.some(k => q.includes(k));
  }).slice(0, 4);
  if (matched.length > 0) {
    for (const item of matched) {
      s += `\n· ${item.title}：${item.content}`;
    }
  } else {
    for (const item of k.entries.slice(0, 2)) {
      s += `\n· ${item.title}：${item.content}`;
    }
  }
  return s;
}

// 八字神煞（扩展）
function kbBaziShensha(pan) {
  const k = _kb?.bazi_shensha || {};
  if (!k.entries) return '';
  let s = '\n\n【神煞知识库】';
  // 根据命盘中的神煞关键词匹配
  const tenGods = pan.tenGods ? Object.values(pan.tenGods).flat() : [];
  const matched = k.entries.filter(e => {
    if (!e.keywords) return false;
    return e.keywords.some(kw => tenGods.includes(kw) || tenGods.some(t => t.includes(kw)));
  }).slice(0, 6);
  if (matched.length > 0) {
    for (const item of matched) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.check) s += ` 查法：${item.check}`;
      if (item.effect) s += ` 作用：${item.effect}`;
    }
  } else {
    // 默认展示吉神
    const jishen = k.entries.filter(e => e.category === '吉神').slice(0, 3);
    for (const item of jishen) {
      s += `\n· ${item.title}：${item.content}`;
    }
  }
  return s;
}

// 面相气色
function kbMianxiangQise() {
  const k = _kb?.mianxiang_qise || {};
  if (!k.entries) return '';
  let s = '\n\n【面相气色知识库】';
  for (const item of k.entries.slice(0, 5)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 风水基础
function kbFengshui() {
  const k = _kb?.fengshui_base || {};
  if (!k.entries) return '';
  let s = '\n\n【风水知识库】';
  for (const item of k.entries.slice(0, 4)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 梅花易数扩展
function kbMeihua(pan) {
  const k = _kb?.meihua_ext || {};
  if (!k.entries) return '';
  const q = (pan.question || '').toLowerCase();
  // 只有问特定事项时使用
  if (!q.includes('梅') && !q.includes('象') && !q.includes('数')) return '';
  let s = '\n\n【梅花易数知识库】';
  const matched = k.entries.filter(e => {
    const kw = (e.keywords || '').toLowerCase();
    return kw.some(k => q.includes(k));
  }).slice(0, 4);
  if (matched.length > 0) {
    for (const item of matched) {
      s += `\n· ${item.title}：${item.content}`;
    }
  }
  return s;
}

// 奇门排盘详解
function kbQimenPaipan() {
  const k = _kb?.qimen_paipan || {};
  if (!k.entries) return '';
  let s = '\n\n【奇门排盘知识库】';
  for (const item of k.entries.slice(0, 3)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 姓名学案例
function kbXingshiCases() {
  const k = _kb?.xingshi_cases || {};
  if (!k.entries) return '';
  let s = '\n\n【姓名学案例参考】';
  for (const item of k.entries.slice(0, 3)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 紫微斗数扩展v2
function kbZiweiExt2(chart) {
  const k = _kb?.ziwei_ext2 || {};
  let s = '';
  // 星曜入十二宫
  if (k.star_in_palace) {
    s += '\n\n【星曜入宫详解】';
    const mainStars = chart.mingGong?.stars?.filter(s => s.type === 'main').map(s => s.name) || [];
    for (const star of mainStars.slice(0, 3)) {
      const key = star + '入命宫';
      if (k.star_in_palace[key]) s += `\n· ${key}：${k.star_in_palace[key]}`;
    }
  }
  // 流年小限
  if (k.liunian) {
    s += '\n\n【流年小限分析】';
    s += ` ${k.liunian.description || ''}`;
  }
  return s;
}

// ========== 更多知识库接入函数 ==========

// 八字十神
function kbBaziShishen(pan) {
  const k = _kb?.bazi_shishen || {};
  if (!k.entries) return '';
  let s = '\n\n【十神知识库】';
  const tenGods = pan.tenGods ? Object.values(pan.tenGods).flat() : [];
  const matched = k.entries.filter(e => tenGods.some(t => e.title.includes(t) || e.content.includes(t))).slice(0, 4);
  if (matched.length > 0) {
    for (const item of matched) s += `\n· ${item.title}：${item.content}`;
  } else {
    for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 八字调候
function kbBaziTiaohou(pan) {
  const k = _kb?.bazi_tiaohou || {};
  if (!k.entries) return '';
  let s = '\n\n【调候用神知识库】';
  const wx = pan.gz ? [pan.gz.month?.[0], pan.gz.hour?.[0]].filter(Boolean) : [];
  const matched = k.entries.filter(e => wx.some(w => e.content.includes(w) || e.title.includes(w))).slice(0, 3);
  if (matched.length > 0) {
    for (const item of matched) s += `\n· ${item.title}：${item.content}`;
  } else {
    for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 八字神煞2
function kbBaziShensha2(pan) {
  const k = _kb?.bazi_shensha2 || {};
  if (!k.entries) return '';
  let s = '\n\n【神煞扩展知识库】';
  for (const item of k.entries.slice(0, 3)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 紫微合参
function kbBaziZiweiHecan(pan) {
  const k = _kb?.bazi_ziwei_hecan || {};
  if (!k.entries) return '';
  let s = '\n\n【八字紫微合参知识库】';
  for (const item of k.entries.slice(0, 3)) {
    s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 六爻纳甲
function kbLiuyaoNajia() {
  const k = _kb?.liuyao_najia || {};
  if (!k.entries) return '';
  let s = '\n\n【纳甲知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻六亲
function kbLiuyaoLiuqin() {
  const k = _kb?.liuyao_liuqin || {};
  if (!k.entries) return '';
  let s = '\n\n【六亲知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻六神
function kbLiuyaoLiushen() {
  const k = _kb?.liuyao_liushen || {};
  if (!k.entries) return '';
  let s = '\n\n【六神知识库】';
  for (const item of k.entries.slice(0, 4)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻旬空
function kbLiuyaoXunkong() {
  const k = _kb?.liuyao_xunkong || {};
  if (!k.entries) return '';
  let s = '\n\n【旬空知识库】';
  for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻进退
function kbLiuyaoJintui() {
  const k = _kb?.liuyao_jintui || {};
  if (!k.entries) return '';
  let s = '\n\n【进退知识库】';
  for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻梅花互参
function kbLiuyaoMeihuaHucan(pan) {
  const k = _kb?.liuyao_meihua_hucan || {};
  if (!k.entries) return '';
  const q = (pan.question || '').toLowerCase();
  if (!q.includes('梅') && !q.includes('象')) return '';
  let s = '\n\n【六爻梅花互参知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 六爻案例
function kbLiuyaoCases() {
  const k = _kb?.liuyao_cases || {};
  if (!k.entries) return '';
  let s = '\n\n【六爻实战案例】';
  for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 奇门用神
function kbQimenYongshen() {
  const k = _kb?.qimen_yongshen || {};
  if (!k.entries) return '';
  let s = '\n\n【奇门用神知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 奇门风水结合
function kbQimenFengshui() {
  const k = _kb?.qimen_fengshui || {};
  if (!k.entries) return '';
  let s = '\n\n【奇门风水结合知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 气色知识库
function kbQise() {
  const k = _kb?.qise || {};
  if (!k.entries) return '';
  let s = '\n\n【气色知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 风水扩展
function kbFengshuiExt() {
  const k = _kb?.fengshui_ext || {};
  if (!k.entries) return '';
  let s = '\n\n【风水扩展知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 罗盘知识库
function kbFengshuiLuopan() {
  const k = _kb?.fengshui_luopan || {};
  if (!k.entries) return '';
  let s = '\n\n【罗盘知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 梅花万物类象
function kbMeihuaLeixiang() {
  const k = _kb?.meihua_lei_xiang || {};
  if (!k.entries) return '';
  let s = '\n\n【万物类象知识库】';
  for (const item of k.entries.slice(0, 4)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 面相气色扩展
function kbMianxiangQise2() {
  const k = _kb?.mianxiang_qise2 || {};
  if (!k.entries) return '';
  let s = '\n\n【面相气色扩展知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 紫微大限v2
function kbZiweiDaxian2(chart) {
  const k = _kb?.ziwei_daxian2 || {};
  if (!k.entries) return '';
  let s = '\n\n【紫微大限扩展知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 紫微宫位
function kbZiweiGongwei() {
  const k = _kb?.ziwei_gongwei || {};
  if (!k.entries) return '';
  let s = '\n\n【紫微宫位知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 紫微四化
function kbZiweiSihua(chart) {
  const k = _kb?.ziwei_sihua || {};
  if (!k.entries) return '';
  let s = '\n\n【四化知识库】';
  const siHua = chart.siHua ? Object.values(chart.siHua) : [];
  const matched = k.entries.filter(e => siHua.some(s => e.title.includes(s))).slice(0, 3);
  if (matched.length > 0) {
    for (const item of matched) s += `\n· ${item.title}：${item.content}`;
  } else {
    for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  }
  return s;
}

// 紫微组合
function kbZiweiZuhe() {
  const k = _kb?.ziwei_zuhe || {};
  if (!k.entries) return '';
  let s = '\n\n【双星组合知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 手相纹理
function kbShouxiangWenli() {
  const k = _kb?.shouxiang_wenli || {};
  if (!k.entries) return '';
  let s = '\n\n【手相纹理知识库】';
  for (const item of k.entries.slice(0, 4)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 生肖知识库
function kbShengxiang() {
  const k = _kb?.shengxiang || {};
  if (!k.entries) return '';
  let s = '\n\n【生肖知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 民俗知识库
function kbGuxiang() {
  const k = _kb?.guxiang || {};
  if (!k.entries) return '';
  let s = '\n\n【民俗知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 万年历知识库
function kbWannianli() {
  const k = _kb?.wannianli || {};
  if (!k.entries) return '';
  let s = '\n\n【万年历知识库】';
  for (const item of k.entries.slice(0, 2)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 子平扩展
function kbZeriExt() {
  const k = _kb?.zeri_ext || {};
  if (!k.entries) return '';
  let s = '\n\n【子平扩展知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 子平吉凶
function kbZeriJixiong() {
  const k = _kb?.zeri_jixiong || {};
  if (!k.entries) return '';
  let s = '\n\n【吉凶知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 佛教神祇
function kbBuddhismDivine() {
  const k = _kb?.buddhism_divine || {};
  if (!k.entries) return '';
  let s = '\n\n【佛教神祇知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 佛教咒语
function kbBuddhismMantra() {
  const k = _kb?.buddhism_mantra || {};
  if (!k.entries) return '';
  let s = '\n\n【佛教咒语知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 道教九火
function kbDaoismJiuhuo() {
  const k = _kb?.daoism_jiuhuo || {};
  if (!k.entries) return '';
  let s = '\n\n【道教九火知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 道教寿诀
function kbDaoismShoujue() {
  const k = _kb?.daoism_shoujue || {};
  if (!k.entries) return '';
  let s = '\n\n【道教寿诀知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 道教斋醮
function kbDaoismZhaijiao() {
  const k = _kb?.daoism_zhaijiao || {};
  if (!k.entries) return '';
  let s = '\n\n【道教斋醮知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// 道教咒术
function kbDaoismZhoushu() {
  const k = _kb?.daoism_zhoushu || {};
  if (!k.entries) return '';
  let s = '\n\n【道教咒术知识库】';
  for (const item of k.entries.slice(0, 3)) s += `\n· ${item.title}：${item.content}`;
  return s;
}

// ========== AI 调用 ==========
async function callDeepSeek(prompt, system, onChunk, opts = {}) {
  const { temperature = 0.15, model: optModel } = opts;
  const useLocal = localStorage.getItem('use_local_model') === '1';
  const messages = [];
  const chineseConstraint = '【铁律·语言约束】你的所有输出必须使用纯中文。严禁输出任何英文单词、英文句子、中英文混合内容。严禁输出思考过程、分析步骤、"thinking process"、"step by step"、"let me think"等元内容。如果你需要推理，请在心中完成，只向用户展示最终的中文解读结果。\n\n';
  if (system) {
    messages.push({ role: 'system', content: chineseConstraint + system });
  } else {
    messages.push({ role: 'system', content: chineseConstraint });
  }
  messages.push({ role: 'user', content: prompt + '\n\n【再次强调】请用纯中文回答，不要出现任何英文。' });

  // 统一超时配置（本地模型推理慢，但10分钟太长，改为6分钟+优雅降级）
  const LOCAL_TIMEOUT = 360000; // 6分钟
  const CLOUD_TIMEOUT = 120000; // 2分钟
  const MAX_TOKENS = 4096;

  if (useLocal) {
    showToast('本地模型正在深度思考（最长6分钟），请耐心等待...', 'success');
    const localUrl = `${getLocalServerUrl()}/v1/chat/completions`;
    let localTimer, localP1, localP2;
    try {
      const ctrl = new AbortController();
      localTimer = setTimeout(() => ctrl.abort(), LOCAL_TIMEOUT);
      // 进度提示
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
        if (onChunk && res.body) {
          const full = await readSSE(res.body, onChunk);
          return full;
        }
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          return stripThinking(data.choices[0].message.content);
        }
        throw new Error('本地模型返回格式异常');
      }
      const errText = await res.text().catch(() => '');
      console.error('本地模型 HTTP 错误:', res.status, errText);
      // 本地失败不抛错，继续fallback到云端
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

  const key = localStorage.getItem('ds_api_key') || DEFAULT_API_KEY;
  const isFallback = useLocal;
  if (!key) throw new Error('请先设置 DeepSeek API Key 或启动本地模型');
  const model = optModel || localStorage.getItem('ds_model') || 'deepseek-chat';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLOUD_TIMEOUT);
  const useStream = !!onChunk;

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
      throw new Error(err.error?.message || 'HTTP ' + res.status);
    }

    if (useStream && res.body) {
      const full = await readSSE(res.body, onChunk);
      if (isFallback) return '[已自动切换至云端模型]\n\n' + full;
      return full;
    }

    const data = await res.json();
    // 防御性检查：防止reasoning模型返回空content
    const text = data.choices?.[0]?.message?.content;
    if (!text || text.trim().length === 0) {
      const reasoning = data.choices?.[0]?.message?.reasoning_content;
      if (reasoning && reasoning.trim().length > 0) {
        return '[模型返回思维链内容，无正式解读]\n\n' + reasoning;
      }
      throw new Error('模型返回空内容，请检查模型参数（如Qwen需加--reasoning off）');
    }

    const cleanText = stripThinking(text);
    if (isFallback) return '[已自动切换至云端模型]\n\n' + cleanText;
    return cleanText;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ========== 八字 ==========
var WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水',
             '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };

var DI_ZHI_CANG_GAN = {
  '子': ['癸'], '丑': ['己','癸','辛'], '寅': ['甲','丙','戊'], '卯': ['乙'],
  '辰': ['戊','乙','癸'], '巳': ['丙','庚','戊'], '午': ['丁','己'], '未': ['己','丁','乙'],
  '申': ['庚','壬','戊'], '酉': ['辛'], '戌': ['戊','辛','丁'], '亥': ['壬','甲']
};

function getBaziPan(solar, gender) {
  const ec = solar.getLunar().getEightChar();
  const pan = {
    year: ec.getYear(),
    month: ec.getMonth(),
    day: ec.getDay(),
    hour: ec.getTime()
  };
  try {
    const yun = ec.getYun(gender === 'male' ? 1 : 0);
    pan.yun = {
      startYear: yun.getStartYear(),
      startMonth: yun.getStartMonth(),
      startDay: yun.getStartDay(),
      startSolar: yun.getStartSolar().toYmd(),
      forward: yun.getForward()
    };
    pan.daYun = yun.getDaYun().map(dy => ({
      ganZhi: dy.getGanZhi(),
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      startAge: dy.getStartAge(),
      endAge: dy.getEndAge()
    }));
  } catch (e) { console.log('大运计算失败:', e.message); }
  return pan;
}

async function doBazi() {
  const btn = document.getElementById('baziBtn');
  btn.disabled = true; btn.textContent = '排盘中...';

  try {
    const year = +document.getElementById('baziYear').value;
    const month = +document.getElementById('baziMonth').value;
    const day = +document.getElementById('baziDay').value;
    const hour = +document.getElementById('baziHour').value;
    const gender = state.bazi.gender;
    const question = document.getElementById('baziQuestion').value;

    let solar;
    if (state.bazi.cal === 'lunar') {
      const lunar = Lunar.fromYmd(year, month, day);
      solar = lunar.getSolar();
    } else {
      solar = Solar.fromYmd(year, month, day);
    }

    const gz = getBaziPan(solar, gender);
    const dayGan = gz.day[0];
    const tenGods = calcTenGods(dayGan, gz);

    // 计算流年干支（当前年份）
    const now = new Date();
    const liuNianGanZhi = getYearGZ(now.getFullYear());
    const liuNianShiShen = tenGodRelation(dayGan, liuNianGanZhi[0]);

    currentBazi = { solar, gz, tenGods, gender, question, pillars: gz, daYun: gz.daYun || [], wangShuai: judgeWangShuai(dayGan, gz), liuNian: { ganZhi: liuNianGanZhi, shiShen: liuNianShiShen } };
    renderBazi(currentBazi);
    currentBaziPrompt = buildBaziPrompt(currentBazi);
    document.getElementById('baziResult').classList.add('visible');
    document.getElementById('baziAI').style.display = 'block';
    document.getElementById('baziAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '开始排盘';
  }
}
window.doBazi = doBazi;

function calcTenGods(dayGan, gz) {
  const r = {};
  for (const k of ['year','month','day','hour']) {
    r[k + '_gan'] = tenGodRelation(dayGan, gz[k][0]);
    const zhi = gz[k][1];
    const cangGan = DI_ZHI_CANG_GAN[zhi] || [];
    r[k + '_zhi'] = cangGan.map(g => `${g}(${tenGodRelation(dayGan, g)})`).join('、');
  }
  return r;
}

function tenGodRelation(dayGan, targetGan) {
  const map = {
    '甲':{ '甲':'比肩','乙':'劫财','丙':'食神','丁':'伤官','戊':'偏财','己':'正财','庚':'七杀','辛':'正官','壬':'偏印','癸':'正印' },
    '乙':{ '甲':'劫财','乙':'比肩','丙':'伤官','丁':'食神','戊':'正财','己':'偏财','庚':'正官','辛':'七杀','壬':'正印','癸':'偏印' },
    '丙':{ '甲':'偏印','乙':'正印','丙':'比肩','丁':'劫财','戊':'食神','己':'伤官','庚':'偏财','辛':'正财','壬':'七杀','癸':'正官' },
    '丁':{ '甲':'正印','乙':'偏印','丙':'劫财','丁':'比肩','戊':'伤官','己':'食神','庚':'正财','辛':'偏财','壬':'正官','癸':'七杀' },
    '戊':{ '甲':'七杀','乙':'正官','丙':'偏印','丁':'正印','戊':'比肩','己':'劫财','庚':'食神','辛':'伤官','壬':'偏财','癸':'正财' },
    '己':{ '甲':'正官','乙':'七杀','丙':'正印','丁':'偏印','戊':'劫财','己':'比肩','庚':'伤官','辛':'食神','壬':'正财','癸':'偏财' },
    '庚':{ '甲':'偏财','乙':'正财','丙':'七杀','丁':'正官','戊':'偏印','己':'正印','庚':'比肩','辛':'劫财','壬':'食神','癸':'伤官' },
    '辛':{ '甲':'正财','乙':'偏财','丙':'正官','丁':'七杀','戊':'正印','己':'偏印','庚':'劫财','辛':'比肩','壬':'伤官','癸':'食神' },
    '壬':{ '甲':'食神','乙':'伤官','丙':'偏财','丁':'正财','戊':'七杀','己':'正官','庚':'偏印','辛':'正印','壬':'比肩','癸':'劫财' },
    '癸':{ '甲':'伤官','乙':'食神','丙':'正财','丁':'偏财','戊':'正官','己':'七杀','庚':'正印','辛':'偏印','壬':'劫财','癸':'比肩' },
  };
  return (map[dayGan] || {})[targetGan] || '';
}
window.tenGodRelation = tenGodRelation;

function renderBazi(pan) {
  const gz = pan.gz;
  const labels = { year:'年柱', month:'月柱', day:'日柱', hour:'时柱' };
  let html = '<div class="result-title">八字排盘结果</div>';
  html += '<div class="pillars-table">';
  for (const k of ['year','month','day','hour']) {
    html += `<div class="pillar-card"><div class="pillar-label">${labels[k]}</div>`;
    html += `<div class="pillar-ganzhi">${gz[k]}</div>`;
    html += `<div class="pillar-info">${WX[gz[k][0]]} · ${WX[gz[k][1]]}</div>`;
    html += `<div class="pillar-info" style="color:var(--accent-green);font-size:0.7rem;">${pan.tenGods[k+'_gan'] || ''}</div>`;
    if (pan.tenGods[k+'_zhi']) {
      html += `<div class="pillar-info" style="color:var(--text-secondary);font-size:0.65rem;">藏：${pan.tenGods[k+'_zhi']}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // 流年信息
  if (pan.liuNian) {
    html += `<div style="text-align:center;margin-top:0.5rem;font-size:0.8rem;color:var(--accent-gold);">流年：${pan.liuNian.ganZhi}（${pan.liuNian.shiShen}）</div>`;
  }

  document.getElementById('baziResult').innerHTML = html;
}

function getYearGZ(year) {
  const gan = ["庚","辛","壬","癸","甲","乙","丙","丁","戊","己"];
  const zhi = ["申","酉","戌","亥","子","丑","寅","卯","辰","巳","午","未"];
  return gan[year % 10] + zhi[year % 12];
}
function buildLiuyaoPrompt(pan, question) {
  return window.liuyao ? window.liuyao.formatLiuyaoPrompt(pan, question) : "";
}
function buildQimenPrompt(pan, question) {
  return window.qimen ? window.qimen.formatQimenPrompt(pan, question) : "";
}
function buildFengshuiPrompt(pan, question) {
  let s = "=== 风水咨询 ===\n";
  if (pan.address) s += "地址/户型：" + pan.address + "\n";
  if (pan.mingGua) s += "命卦：" + pan.mingGua + "\n";
  if (pan.zhaiGua) s += "宅卦：" + pan.zhaiGua + "\n";
  if (question) s += "\n所问之事：" + question + "\n";
  return s;
}

function buildBaziPrompt(pan) {
  const gz = pan.gz;
  const now = new Date();
  const wangShuai = judgeWangShuai(gz.day[0], gz);
  let s = '=== 八字排盘 ===\n';
  s += `四柱：${gz.year} ${gz.month} ${gz.day} ${gz.hour}\n`;
  s += `日主：${gz.day[0]}\n性别：${pan.gender==='male'?'男':'女'}\n`;
  s += `旺衰判断：${wangShuai}${WX[gz.day[0]]}\n`;
  s += '地支藏干：';
  const zhiLabels = { year:'年', month:'月', day:'日', hour:'时' };
  for (const k of ['year','month','day','hour']) {
    if (pan.tenGods[k+'_zhi']) s += `${zhiLabels[k]}(${pan.tenGods[k+'_zhi']}) `;
  }
  s += '\n';
  s += `当前时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日\n`;
  if (gz.yun) {
    s += `起运：出生后${gz.yun.startYear}年${gz.yun.startMonth}个月${gz.yun.startDay}天起运（${gz.yun.startSolar}）\n`;
    s += `大运排列：${gz.yun.forward ? '顺排' : '逆排'}\n`;
    s += '大运：\n';
    for (const dy of (gz.daYun || []).slice(0, 8)) {
      const marker = (now.getFullYear() >= dy.startYear && now.getFullYear() <= dy.endYear) ? ' 【当前大运】' : '';
      s += `  ${dy.startYear}-${dy.endYear}年（${dy.startAge}-${dy.endAge}岁）：${dy.ganZhi}${marker}\n`;
    }
  }
  if (pan.liuNian) {
    s += `\n流年：${pan.liuNian.ganZhi}（流年天干对日主为${pan.liuNian.shiShen || '同我'}）\n`;
  }
  if (pan.question) s += `\n所问之事：${pan.question}\n`;
  s += '\n请根据以上八字命盘进行详细解读，重点分析当前大运和流年运势。';
  return s;
}

async function doAIBazi() {
  if (!currentBaziPrompt) return;
  const btn = document.getElementById('baziAIBtn');
  const content = document.getElementById('baziAIContent');
  btn.disabled = true; btn.textContent = '加载知识库...';
  content.innerHTML = '<div class="spinner"></div><div>正在加载知识库，请稍候...</div>';

  await ensureKB();
  btn.textContent = '解读中...';
  content.innerHTML = '<div class="spinner"></div><div>正在构建索引...</div>';
  await window.RAG.build();
  btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentBazi.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const facts = window.Expert.bazi(currentBazi);
    const ragContent = window.RAG.search(currentBazi, currentBazi.question, { topK: 10, maxChars: 2500, source: '八字' });
    const historyPrompt = getSimilarHistoryPrompt('bazi', currentBazi.gz.day, currentBazi.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('bazi') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('bazi', currentBazi.question) : '';
    const system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbBaziExt()
      + kbBaziDayun(currentBazi)
      + kbBaziGeju(currentBazi)
      + kbBaziShensha(currentBazi)
      + kbBaziShensha2(currentBazi)
      + kbBaziShishen(currentBazi)
      + kbBaziTiaohou(currentBazi)
      + kbBaziHehun(currentBazi)
      + kbBaziZiweiHecan(currentBazi)
      + kbNihaiXia()
      + '\n\n'
      + window.Expert.chainOfThought('八字');
    const text = await callDeepSeek(currentBaziPrompt, system, (delta, full) => {
      fullText = full;
      content.textContent = prefix + separator + full;
    });
    const finalText = prefix + separator + (fullText || text);
    saveHistory('bazi', currentBazi.gz.day, currentBazi.question || '八字解读', finalText);
    addFeedbackUI('bazi', content, finalText, currentBaziPrompt, system);
    showResultActions('baziAIContent', 'baziAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error"><span>⚠️ ${escapeHtml(e.message)}</span><button onclick="doAIBazi()" class="retry-btn">🔄 重试</button></div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAIBazi = doAIBazi;

// ========== 紫微 ==========
async function doZiwei() {
  const btn = document.getElementById('zwBtn');
  btn.disabled = true; btn.textContent = '排盘中...';
  try {
    const year = +document.getElementById('zwYear').value;
    const month = +document.getElementById('zwMonth').value;
    const day = +document.getElementById('zwDay').value;
    const hour = +document.getElementById('zwHour').value;
    const gender = state.zw.gender;
    const question = document.getElementById('zwQuestion').value;

    if (!window.iztroAstro) { showToast('紫微库加载中，请稍后', 'error'); return; }

    let chart;
    if (state.zw.cal === 'lunar') {
      chart = window.iztroAstro.byLunar(`${year}-${month}-${day}`, hour, gender, state.zw.leap, true, 'zh-CN');
    } else {
      chart = window.iztroAstro.bySolar(`${year}-${month}-${day}`, hour, gender, true, 'zh-CN');
    }

    currentZw = adaptZiwei(chart, new Date());
    renderZiwei(currentZw);
    currentZwPrompt = buildZiweiPrompt(currentZw, question);
    document.getElementById('zwResult').classList.add('visible');
    document.getElementById('zwAI').style.display = 'block';
    document.getElementById('zwAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '排盘';
  }
}
window.doZiwei = doZiwei;

function adaptZiwei(chart, targetDate) {
  const palaces = [];
  const mingIdx = chart.palaces?.findIndex?.(p => p.name === '命宫') ?? -1;
  const shenIdx = chart.palaces?.findIndex?.(p => p.bodyPalace) ?? -1;

  if (chart.palaces) {
    for (const p of chart.palaces) {
      const stars = [];
      if (p.majorStars) for (const s of p.majorStars) stars.push({ name: s.name, type: 'main', brightness: s.brightness });
      if (p.minorStars) for (const s of p.minorStars) stars.push({ name: s.name, type: 'aux' });
      if (p.adjectiveStars) for (const s of p.adjectiveStars) stars.push({ name: s.name, type: 'adj' });
      palaces.push({
        name: p.name, ganzhi: (p.heavenlyStem||'')+(p.earthlyBranch||''),
        stars, isMing: p.name === '命宫', isShen: !!p.bodyPalace,
      });
    }
  }
  const siHua = {};
  // iztro v2+ 四化在星的 mutagen 属性上，chart 无 mutagen 数组
  // 从 chineseDate 取年干，用 iztro.util.getMutagensByHeavenlyStem 获取四化
  try {
    const yearlyStem = chart.chineseDate?.split(' ')[0]?.[0];
    if (yearlyStem && window.iztro?.util?.getMutagensByHeavenlyStem) {
      const mutagens = window.iztro.util.getMutagensByHeavenlyStem(yearlyStem);
      if (mutagens && mutagens.length === 4) {
        siHua['化禄'] = mutagens[0];
        siHua['化权'] = mutagens[1];
        siHua['化科'] = mutagens[2];
        siHua['化忌'] = mutagens[3];
      }
    }
  } catch (e) { console.warn('四化计算失败:', e); }
  // 兼容旧版 iztro（chart.mutagen 数组）
  if (Object.keys(siHua).length === 0 && chart.mutagen) {
    if (chart.mutagen[0]) siHua['化禄'] = chart.mutagen[0];
    if (chart.mutagen[1]) siHua['化权'] = chart.mutagen[1];
    if (chart.mutagen[2]) siHua['化科'] = chart.mutagen[2];
    if (chart.mutagen[3]) siHua['化忌'] = chart.mutagen[3];
  }
  // 大限流年排盘
  let horoscope = null;
  try {
    if (targetDate && chart.horoscope) {
      const hs = chart.horoscope(targetDate);
      if (hs) {
        horoscope = {
          decadal: hs.decadal ? {
            name: hs.decadal.name || '大限',
            palace: hs.decadal.palaceNames?.[0] || '',
            ganzhi: (hs.decadal.heavenlyStem || '') + (hs.decadal.earthlyBranch || ''),
            mutagen: hs.decadal.mutagen || [],
            ageRange: hs.decadal.range || []
          } : null,
          age: hs.age ? {
            nominalAge: hs.age.nominalAge,
            palace: hs.age.palaceNames?.[0] || '',
            ganzhi: (hs.age.heavenlyStem || '') + (hs.age.earthlyBranch || '')
          } : null,
          yearly: hs.yearly ? {
            name: hs.yearly.name || '流年',
            palace: hs.yearly.palaceNames?.[0] || '',
            ganzhi: (hs.yearly.heavenlyStem || '') + (hs.yearly.earthlyBranch || ''),
            mutagen: hs.yearly.mutagen || []
          } : null
        };
      }
    }
  } catch (e) { console.warn('大限流年排盘失败:', e); }

  return { mingGong: palaces[mingIdx] || {}, shenGong: palaces[shenIdx] || {}, palaces, siHua, horoscope };
}

function renderZiwei(chart) {
  let html = '<div class="result-title">紫微斗数命盘</div>';
  html += '<div style="display:flex;justify-content:center;gap:1rem;margin-bottom:0.8rem;font-size:0.8rem;color:var(--text-secondary);">';
  if (chart.mingGong.name) {
    const ms = chart.mingGong.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    html += `<span>命宫：<strong style="color:var(--accent-gold)">${chart.mingGong.name} ${chart.mingGong.ganzhi}</strong> ${ms}</span>`;
  }
  if (Object.keys(chart.siHua).length) {
    const h = Object.entries(chart.siHua).map(([k,v])=>`${v}${k}`).join(' ');
    html += `<span>四化：<strong style="color:var(--accent-gold)">${h}</strong></span>`;
  }
  // 大限流年信息
  if (chart.horoscope) {
    const hs = chart.horoscope;
    html += '<div style="display:flex;justify-content:center;gap:1rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--text-secondary);">';
    if (hs.decadal) html += `<span>大限：${hs.decadal.palace} ${hs.decadal.ganzhi}</span>`;
    if (hs.age) html += `<span>小限：${hs.age.nominalAge}岁 ${hs.age.palace}</span>`;
    if (hs.yearly) html += `<span>流年：${hs.yearly.palace} ${hs.yearly.ganzhi}</span>`;
    html += '</div>';
  }

  html += '<div class="palaces-grid">';
  for (const p of chart.palaces) {
    const cls = ['palace-card']; if (p.isMing) cls.push('ming');
    const mains = p.stars.filter(s=>s.type==='main').map(s=> s.name + (s.brightness?'('+s.brightness+')':'')).join(' ');
    const auxs = p.stars.filter(s=>s.type!=='main').map(s=>s.name).join(' ');
    html += `<div class="${cls.join(' ')}">`;
    html += `<div style="font-weight:600;color:var(--accent-gold-light);">${p.name}${p.isMing?'(命)':''}</div>`;
    html += `<div style="color:var(--text-muted);font-size:0.65rem;">${p.ganzhi}</div>`;
    if (mains) html += `<div style="color:var(--accent-gold);font-size:0.75rem;">${mains}</div>`;
    if (auxs) html += `<div style="color:var(--text-secondary);font-size:0.65rem;">${auxs}</div>`;
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('zwResult').innerHTML = html;
}

function buildZiweiPrompt(chart, question) {
  const now = new Date();
  let s = '=== 紫微斗数排盘 ===\n';
  s += `当前时间：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日\n`;
  if (chart.mingGong.name) {
    const ms = chart.mingGong.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    s += `命宫：${chart.mingGong.name}（${chart.mingGong.ganzhi}）${ms}\n`;
  }
  if (chart.shenGong.name) s += `身宫：${chart.shenGong.name}（${chart.shenGong.ganzhi}）\n`;
  if (Object.keys(chart.siHua).length) {
    s += '四化：' + Object.entries(chart.siHua).map(([k,v])=>`${v}${k}`).join(' ') + '\n';
  }
  s += '\n十二宫：\n';
  for (const p of chart.palaces) {
    const ms = p.stars.filter(s=>s.type==='main').map(s=>s.name).join(' ');
    s += `  ${p.name}（${p.ganzhi}）：${ms || '无主星'}\n`;
  }
  if (question) s += `\n所问之事：${question}\n`;
  s += '\n请根据以上紫微斗数命盘进行详细解读，重点分析当前流年运势。';
  return s;
}

async function doAIZiwei() {
  if (!currentZwPrompt) return;
  await ensureKB();
  await window.RAG.build();
  const btn = document.getElementById('zwAIBtn');
  const content = document.getElementById('zwAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentZw.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const facts = window.Expert.ziwei(currentZw);
    const ragContent = window.RAG.search(currentZw, currentZw.question, { topK: 10, maxChars: 2500, source: '紫微' });
    const historyPrompt = getSimilarHistoryPrompt('ziwei', currentZw.mingGong.ganzhi, currentZw.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('ziwei') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('ziwei', currentZw.question) : '';
    const system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbZiweiExt()
      + kbZiweiExt2(currentZw)
      + kbZiweiFuxing()
      + kbZiweiDaxian()
      + kbZiweiDaxian2(currentZw)
      + kbZiweiGeju()
      + kbZiweiGongwei()
      + kbZiweiSihua(currentZw)
      + kbZiweiZuhe()
      + kbNihaiXia()
      + '\n\n'
      + window.Expert.chainOfThought('紫微');
    const text = await callDeepSeek(currentZwPrompt, system, (delta, full) => {
      fullText = full;
      content.textContent = prefix + separator + full;
    });
    const finalText = prefix + separator + (fullText || text);
    saveHistory('ziwei', currentZw.mingGong.ganzhi, currentZw.question || '紫微解读', finalText);
    addFeedbackUI('ziwei', content, finalText, currentZwPrompt, system);
    showResultActions('zwAIContent', 'zwAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error"><span>⚠️ ${escapeHtml(e.message)}</span><button onclick="doAIZiwei()" class="retry-btn">🔄 重试</button></div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAIZiwei = doAIZiwei;

// ========== 六爻 ==========
function selLiuyaoMethod(btn) {
  document.querySelectorAll('#pageLiuyao [data-method]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.liuyao.method = btn.dataset.method;
  document.getElementById('liuyaoNumberRow').style.display = btn.dataset.method === 'number' ? 'grid' : 'none';
}
window.selLiuyaoMethod = selLiuyaoMethod;

function selLiuyaoMode(btn) {
  document.querySelectorAll('#pageLiuyao [data-mode]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.liuyao.mode = btn.dataset.mode;
  const xw1 = document.getElementById('lyXunwuRow1');
  const xw2 = document.getElementById('lyXunwuRow2');
  const qLabel = document.getElementById('lyQuestionLabel');
  const qInput = document.getElementById('lyQuestion');
  if (btn.dataset.mode === 'xunwu') {
    xw1.style.display = 'grid';
    xw2.style.display = 'grid';
    if(qLabel) qLabel.textContent = '寻物描述（描述丢失经过，心诚则灵）';
    if(qInput) qInput.placeholder = '例如：我的黑色钱包昨天不见了';
  } else {
    xw1.style.display = 'none';
    xw2.style.display = 'none';
    if(qLabel) qLabel.textContent = '所问之事（可选）';
    if(qInput) qInput.placeholder = '例如：明日出行是否顺利？';
  }
}
window.selLiuyaoMode = selLiuyaoMode;

async function doLiuyao() {
  const btn = document.getElementById('lyBtn');
  btn.disabled = true; btn.textContent = '排盘中...';
  try {
    const method = state.liuyao.method;
    const mode = state.liuyao.mode || 'normal';
    const question = document.getElementById('lyQuestion').value;
    let enhancedQuestion = question;
    let lostItemName = '';
    if (mode === 'xunwu') {
      lostItemName = document.getElementById('lyLostItem').value.trim();
      if (!lostItemName) { showToast('请输入失物名称', 'error'); btn.disabled = false; btn.textContent = '起卦排盘'; return; }
      const lostPlace = document.getElementById('lyLostPlace').value.trim();
      const lostTime = document.getElementById('lyLostTime').value;
      enhancedQuestion = `寻物占：寻找丢失的${lostItemName}`;
      if (lostPlace) enhancedQuestion += `，丢失地点：${lostPlace}`;
      if (lostTime) {
        const dt = new Date(lostTime);
        enhancedQuestion += `，丢失时间：${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      }
      if (question) enhancedQuestion += `。原描述：${question}`;
    }
    let pan;
    if (method === 'time') {
      pan = window.liuyao.panGua('time', { dt: new Date() });
    } else if (method === 'number') {
      const n1 = +document.getElementById('lyNum1').value || 1;
      const n2 = +document.getElementById('lyNum2').value || 1;
      const n3 = document.getElementById('lyNum3').value;
      pan = window.liuyao.panGua('number', { num1: n1, num2: n2, num3: n3 ? +n3 : null });
    } else if (method === 'coin') {
      pan = window.liuyao.panGua('coin', { dt: new Date() });
    } else {
      pan = window.liuyao.panGua('random', {});
    }
    currentLy = pan;
    renderLiuyao(pan);
    currentLyPrompt = window.liuyao.formatLiuyaoPrompt(pan, enhancedQuestion);
    if (mode === 'xunwu' && lostItemName) {
      const analysis = analyzeXunWu(pan, lostItemName);
      renderXunWuReport(analysis);
    } else {
      document.getElementById('lyXunwuReport').style.display = 'none';
    }
    document.getElementById('lyResult').classList.add('visible');
    document.getElementById('lyAI').style.display = 'block';
    document.getElementById('lyAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '起卦排盘';
  }
}
window.doLiuyao = doLiuyao;

function renderLiuyao(pan) {
  let html = '<div class="result-title">六爻排盘结果</div>';
  html += `<div class="gua-info">`;
  html += `<span>卦名：<strong>${pan.gua.name}</strong></span>`;
  if (pan.gua.dongYaoList && pan.gua.dongYaoList.length > 0) {
    html += `<span>动爻：<strong>第${pan.gua.dongYaoList.join('、')}爻（${pan.gua.dongYaoName}）</strong></span>`;
  } else {
    html += `<span>动爻：<strong style="color:var(--text-muted)">无</strong></span>`;
  }
  html += `</div>`;

  // 铜钱摇卦：显示每爻摇出结果
  if (pan.coinResults && pan.coinResults.length === 6) {
    const labels = ['初爻','二爻','三爻','四爻','五爻','上爻'];
    html += '<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin:0.5rem 0;font-size:0.8rem;">';
    html += '<div style="color:var(--accent-gold);margin-bottom:0.3rem;">🪙 铜钱摇卦记录（从初爻到上爻）</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.3rem;text-align:center;">';
    for (let i = 0; i < 6; i++) {
      const r = pan.coinResults[i];
      const clr = r.isDong ? 'var(--accent-red)' : 'var(--text-primary)';
      html += `<div style="background:var(--bg-card);padding:0.3rem;border-radius:4px;color:${clr};font-size:0.7rem;">`;
      html += `<div style="font-size:0.65rem;color:var(--text-muted);">${labels[i]}</div>`;
      html += `<div style="font-weight:600;">${r.label}</div>`;
      html += `<div style="font-size:0.6rem;color:var(--text-muted);">${r.desc}</div>`;
      html += `</div>`;
    }
    html += '</div></div>';
  }

  html += '<div class="yao-list">';
  for (const yao of [...pan.yaoList].reverse()) {
    const dong = yao.isDong ? '<span class="dong">【动】</span>' : '';
    html += `<div class="yao-item">`;
    html += `<span>${yao.name} ${yao.gan}${yao.zhi}(${yao.wuxing}) ${yao.liuqin} ${yao.liushen}</span>`;
    html += `${dong}</div>`;
  }
  html += '</div>';

  if (pan.huGua) {
    html += `<div style="text-align:center;margin-top:0.5rem;color:var(--text-secondary);font-size:0.8rem;">互卦：${pan.huGua}</div>`;
  }
  document.getElementById('lyResult').innerHTML = html;
}

// ========== 寻物占分析 ==========
var XUNWU_CATEGORIES = {
  '妻财': { keywords: ['钱包','钱','现金','手机','首饰','珠宝','手表','项链','戒指','耳环','黄金','银子','银行卡','信用卡','手表','手镯','玉','翡翠'], description: '金银钱财类' },
  '父母': { keywords: ['身份证','护照','驾照','证件','证书','合同','文件','书本','笔记','钥匙','车钥匙','房本','发票','单据','毕业证','学位证','档案'], description: '文书证件类' },
  '子孙': { keywords: ['猫','狗','宠物','鸟','鱼','动物','玩具','小孩','婴儿','毛孩子','仓鼠','兔子'], description: '动物宠物类' },
  '兄弟': { keywords: ['衣服','裤子','鞋','帽子','伞','包','背包','箱子','工具','锅','碗','水杯','眼镜','围巾','手套','袜子','毛巾','化妆品','梳子'], description: '衣物用品类' },
  '官鬼': { keywords: ['自行车','电动车','汽车','摩托车','锁','门','窗','电器','电脑','平板','耳机','充电器','数据线','U盘','硬盘','相机'], description: '交通工具/电器类' }
};

var XUNWU_DIRECTION = {
  '木': { primary: '东方', secondary: '东南方', reason: '木主东方' },
  '火': { primary: '南方', secondary: '南方', reason: '火主南方' },
  '金': { primary: '西方', secondary: '西北方', reason: '金主西方' },
  '水': { primary: '北方', secondary: '北方', reason: '水主北方' },
  '土': { primary: '中央/原地', secondary: '西南方、东北方', reason: '土主中央' }
};

var XUNWU_ENV = {
  '青龙': { desc: '高处、洁净、明亮处', places: ['柜子上','书架顶层','高处台面','整洁的桌面'], reason: '青龙主高贵洁净' },
  '朱雀': { desc: '文书附近、说话处、喧哗处', places: ['桌上','打印机旁','电视旁','说话交流的地方'], reason: '朱雀主口舌文书' },
  '勾陈': { desc: '地面、土中、陈旧处', places: ['地面','地下','旧物堆','地板缝隙','土堆旁'], reason: '勾陈主土地陈旧' },
  '腾蛇': { desc: '缠绕处、中空物内、拐角', places: ['包里','袋中','缝隙处','管道旁','沙发垫下','被科中'], reason: '腾蛇主缠绕中空' },
  '白虎': { desc: '道路边、金属旁、凶煞处', places: ['路边','金属架旁','车旁','垃圾桶','利器旁'], reason: '白虎主道路金属' },
  '玄武': { desc: '暗处、隐蔽处、水边', places: ['床底','厕所','水池旁','阴暗角落','抽屉深处'], reason: '玄武主阴暗隐蔽' }
};

function classifyLostItem(itemName) {
  if (!itemName) return { category: '妻财', description: '未分类' };
  const name = itemName.toLowerCase();
  for (const [category, info] of Object.entries(XUNWU_CATEGORIES)) {
    for (const kw of info.keywords) {
      if (name.includes(kw.toLowerCase())) { return { category, description: info.description }; }
    }
  }
  return { category: '妻财', description: '贵重物品' };
}

function findYongShen(yaoList, category) {
  for (let i = 0; i < yaoList.length; i++) {
    if (yaoList[i].liuqin === category) { return { position: i, yao: yaoList[i] }; }
  }
  return null;
}

function analyzeXunWu(pan, lostItemName) {
  const classification = classifyLostItem(lostItemName);
  const yongShen = findYongShen(pan.yaoList, classification.category);
  if (!yongShen) return { error: '未能定位用神' };
  const yl = yongShen.yao;
  const isMoving = yl.isDong;
  const direction = XUNWU_DIRECTION[yl.wuxing] || { primary: '未知', reason: '无法确定五行' };
  const environment = XUNWU_ENV[yl.liushen] || { desc: '无法判断', places: [], reason: '六神信息不足' };
  const probLevel = isMoving ? 'high' : 'medium';
  const probPercent = isMoving ? 75 : 55;
  const probReason = isMoving ? '用神发动，化变有力，失物有动向' : '用神安静，需主动寻找';
  const timing = isMoving ? { desc: '3-7日内有望', reason: '动父主变化，近期会有动向' } : { desc: '近期留意', reason: '用神状态平稳' };
  return {
    itemName: lostItemName, category: classification,
    yongShen: { position: yongShen.position + 1, liuqin: yl.liuqin, wuxing: yl.wuxing, liushen: yl.liushen, isMoving },
    direction, environment,
    probability: { level: probLevel, percentage: probPercent, reason: probReason, canFind: true },
    timing
  };
}

function renderXunWuReport(analysis) {
  const report = document.getElementById('lyXunwuReport');
  const grid = document.getElementById('lyXunwuGrid');
  if (!report || !grid) return;
  if (analysis.error) { report.style.display = 'none'; return; }
  report.style.display = 'block';
  const probLabel = analysis.probability.level === 'high' ? '高' : analysis.probability.level === 'medium' ? '中' : '低';
  const probColor = analysis.probability.level === 'high' ? 'var(--accent-green)' : analysis.probability.level === 'medium' ? 'var(--accent-gold)' : 'var(--accent-red)';
  grid.innerHTML = `
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">失物类别 / 用神</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:var(--accent-gold);">${analysis.category.category}父 · ${analysis.category.description}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">「${analysis.itemName}」取${analysis.category.category}为用神，位于第${analysis.yongShen.position}父</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">方位判断</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:var(--accent-gold);">${analysis.direction.primary}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">用神五行属${analysis.yongShen.wuxing||'?'}，${analysis.direction.reason}${analysis.direction.secondary?'，也可留意'+analysis.direction.secondary:''}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">环境特征</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.1rem;font-weight:700;color:var(--accent-gold);">${analysis.environment.desc}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">临${analysis.yongShen.liushen||'?'}六神，${analysis.environment.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;">
      <div style="font-size:0.7rem;color:var(--text-muted);">找回概率</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.2rem;font-weight:700;color:${probColor};">${analysis.probability.percentage}% · ${probLabel}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">${analysis.probability.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;grid-column:1/-1;">
      <div style="font-size:0.7rem;color:var(--text-muted);">预计找回时间</div>
      <div style="font-family:'Noto Serif SC',serif;font-size:1.1rem;font-weight:700;color:var(--accent-gold);">${analysis.timing.desc}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;">${analysis.timing.reason}</div>
    </div>
    <div class="result-card" style="background:var(--bg-inner);border:1px solid var(--border);border-radius:8px;padding:0.8rem;grid-column:1/-1;">
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.5rem;">具体建议</div>
      <ul style="margin-left:1rem;font-size:0.8rem;color:var(--text-secondary);line-height:1.7;">
        ${analysis.direction.primary!=='未知'?`<li>重点搜索${analysis.direction.primary}区域${analysis.direction.secondary?'及'+analysis.direction.secondary:''}</li>`:''}
        ${analysis.environment.places.length>0?`<li>重点查看：${analysis.environment.places.join('、')}</li>`:''}
        <li>保持信心，细心寻找</li>
        <li>心诚则灵，起卦后第一时间按提示方向寻找成功率最高</li>
      </ul>
    </div>
  `;
}

async function doAILiuyao() {
  if (!currentLyPrompt) return;
  await ensureKB();
  await window.RAG.build();
  const btn = document.getElementById('lyAIBtn');
  const content = document.getElementById('lyAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentLy.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const facts = window.Expert.liuyao(currentLy);
    const ragContent = window.RAG.search(currentLy, currentLy.question, { topK: 10, maxChars: 2500, source: '六爻' });
    const historyPrompt = getSimilarHistoryPrompt('liuyao', currentLy.gua.name, currentLy.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('liuyao') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('liuyao', currentLy.question) : '';
    let system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbLiuyaoExt()
      + kbLiuyaoNajia()
      + kbLiuyaoLiuqin()
      + kbLiuyaoLiushen()
      + kbLiuyaoXunkong()
      + kbLiuyaoJintui()
      + kbLiuyaoMeihuaHucan(currentLy)
      + kbLiuyaoCases()
      + kbMeihua(currentLy)
      + kbMeihuaLeixiang()
      + kbNihaiXia()
      + '\n\n'
      + window.Expert.chainOfThought('六爻');
    if ((state.liuyao.mode || 'normal') === 'xunwu') {
      system += '\n\n【此为寻物占】用户正在寻找丢失的物品。重点解读：方位、距离、环境特征、是否还在原处、找回可能性、最佳时间、具体建议。';
    }
    const text = await callDeepSeek(currentLyPrompt, system, (delta, full) => {
      fullText = full;
      content.textContent = prefix + separator + full;
    });
    const finalText = prefix + separator + (fullText || text);
    saveHistory('liuyao', currentLy.gua.name, currentLy.question || '六爻解读', finalText);
    addFeedbackUI('liuyao', content, finalText, currentLyPrompt, system);
    showResultActions('lyAIContent', 'lyAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error"><span>⚠️ ${escapeHtml(e.message)}</span><button onclick="doAILiuyao()" class="retry-btn">🔄 重试</button></div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAILiuyao = doAILiuyao;

// ========== 奇门 ==========
async function doQimen() {
  const btn = document.getElementById('qmBtn');
  btn.disabled = true; btn.textContent = '排盘中...';

  try {
    const year = +document.getElementById('qmYear').value;
    const month = +document.getElementById('qmMonth').value;
    const day = +document.getElementById('qmDay').value;
    const hour = +document.getElementById('qmHour').value;
    const question = document.getElementById('qmQuestion').value;

    if (!window.qimen) { showToast('奇门库加载中，请稍后', 'error'); return; }

    const pan = window.qimen.panQimen(year, month, day, hour, 0);
    currentQm = pan;
    renderQimen(pan);
    currentQmPrompt = window.qimen.formatQimenPrompt(pan, question);
    document.getElementById('qmResult').classList.add('visible');
    document.getElementById('qmAI').style.display = 'block';
    document.getElementById('qmAIContent').innerHTML = '';
  } catch (e) {
    showToast('排盘失败: ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '开始排盘';
  }
}
window.doQimen = doQimen;

function renderQimen(pan) {
  let html = '<div class="result-title">奇门遁甲排盘结果</div>';

  html += `<div class="gua-info">`;
  html += `<span>节气：<strong>${pan.jieqi}</strong></span>`;
  html += `<span>局数：<strong>${pan.jushu_text}</strong></span>`;
  html += `<span>旬首：<strong>${pan.xunshou}</strong></span>`;
  html += `</div>`;

  html += `<div style="text-align:center;margin-bottom:0.8rem;font-size:0.8rem;color:var(--text-secondary);">四柱：${pan.bazi.join(' ')}</div>`;

  // 九宫格按洛书顺序：4 9 2 / 3 5 7 / 8 1 6
  const luoshuOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  const gongMap = {};
  pan.gong9.forEach(g => gongMap[g.gong] = g);

  html += '<div class="jiugong-grid">';
  for (const n of luoshuOrder) {
    const g = gongMap[n];
    if (!g) { html += '<div class="gong-card"></div>'; continue; }

    const cls = ['gong-card'];
    if (g.is_dipan_zhifu) cls.push('zhifu');
    if (g.is_renpan_zhishi) cls.push('zhishi');

    const mark = g.is_dipan_zhifu ? '<div class="mark">直符</div>' :
                 g.is_renpan_zhishi ? '<div class="mark">直使</div>' : '';

    html += `<div class="${cls.join(' ')}">${mark}`;
    html += `<div class="gong-name">${g.name}</div>`;
    html += `<div class="gong-direction">${g.direction} · ${g.wuxing}</div>`;
    html += `<div class="gong-item"><span class="label">九星</span> <span class="value star">${g.jiuxing}</span></div>`;
    html += `<div class="gong-item"><span class="label">八门</span> <span class="value door">${g.renpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">八神</span> <span class="value god">${g.shenpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">天盘</span> <span class="value">${g.tianpan}</span></div>`;
    html += `<div class="gong-item"><span class="label">地盘</span> <span class="value">${g.dipan}</span></div>`;
    html += '</div>';
  }
  html += '</div>';

  document.getElementById('qmResult').innerHTML = html;
}

async function doAIQimen() {
  if (!currentQmPrompt) return;
  await ensureKB();
  await window.RAG.build();
  const btn = document.getElementById('qmAIBtn');
  const content = document.getElementById('qmAIContent');
  btn.disabled = true; btn.textContent = '解读中...';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentQm.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) content.textContent = '';

  let fullText = '';
  try {
    const facts = window.Expert.qimen(currentQm);
    const ragContent = window.RAG.search(currentQm, currentQm.question, { topK: 10, maxChars: 2500, source: '奇门' });
    const historyPrompt = getSimilarHistoryPrompt('qimen', currentQm.jushu_text, currentQm.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('qimen') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('qimen', currentQm.question) : '';
    const system = (facts ? '【确定事实·100%准确】\n' + facts + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + kbQimenExt()
      + kbQimenPaipan()
      + kbQimenYongshen()
      + kbQimenXingmen()
      + kbQimenGeju()
      + kbQimenZhanji()
      + kbQimenFengshui()
      + kbQise()
      + kbNihaiXia()
      + '\n\n'
      + window.Expert.chainOfThought('奇门');
    const text = await callDeepSeek(currentQmPrompt, system, (delta, full) => {
      fullText = full;
      content.textContent = prefix + separator + full;
    });
    const finalText = prefix + separator + (fullText || text);
    saveHistory('qimen', currentQm.jushu_text, currentQm.question || '奇门解读', finalText);
    addFeedbackUI('qimen', content, finalText, currentQmPrompt, system);
    showResultActions('qmAIContent', 'qmAIActions');
  } catch (e) {
    content.innerHTML = prefix + separator + `<div class="error"><span>⚠️ ${escapeHtml(e.message)}</span><button onclick="doAIQimen()" class="retry-btn">🔄 重试</button></div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAIQimen = doAIQimen;

// ========== 看手相 ==========
let sxLeftBase64 = '', sxRightBase64 = '', sxGender = 'male';

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
  // 更新左右手标签
  if (gender === 'male') {
    document.getElementById('sxLeftLabel').textContent = '先天命格';
    document.getElementById('sxRightLabel').textContent = '后天运势';
  } else {
    document.getElementById('sxLeftLabel').textContent = '后天运势';
    document.getElementById('sxRightLabel').textContent = '先天命格';
  }
}
window.setSxGender = setSxGender;

async function onSxFileSelect(e, hand) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const compressed = await compressImage(ev.target.result);
    if (hand === 'left') {
      sxLeftBase64 = compressed;
      document.getElementById('sxPreviewLeft').src = sxLeftBase64;
      document.getElementById('sxPreviewWrapLeft').style.display = 'block';
      document.getElementById('sxUploadAreaLeft').style.display = 'none';
    } else {
      sxRightBase64 = compressed;
      document.getElementById('sxPreviewRight').src = sxRightBase64;
      document.getElementById('sxPreviewWrapRight').style.display = 'block';
      document.getElementById('sxUploadAreaRight').style.display = 'none';
    }
    document.getElementById('sxResult').style.display = 'none';
    // 两只手都上传后显示解读按钮
    if (sxLeftBase64 && sxRightBase64) {
      document.getElementById('sxActionArea').style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}
window.onSxFileSelect = onSxFileSelect;

function clearShouxiang() {
  sxLeftBase64 = ''; sxRightBase64 = '';
  document.getElementById('sxFileInputLeft').value = '';
  document.getElementById('sxFileInputRight').value = '';
  document.getElementById('sxPreviewWrapLeft').style.display = 'none';
  document.getElementById('sxPreviewWrapRight').style.display = 'none';
  document.getElementById('sxUploadAreaLeft').style.display = 'block';
  document.getElementById('sxUploadAreaRight').style.display = 'block';
  document.getElementById('sxActionArea').style.display = 'none';
  document.getElementById('sxResult').style.display = 'none';
}
window.clearShouxiang = clearShouxiang;

function sxFlipImage(hand) {
  const base64 = hand === 'left' ? sxLeftBase64 : sxRightBase64;
  if (!base64) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    const flipped = canvas.toDataURL('image/jpeg', 0.9);
    if (hand === 'left') {
      sxLeftBase64 = flipped;
      document.getElementById('sxPreviewLeft').src = flipped;
    } else {
      sxRightBase64 = flipped;
      document.getElementById('sxPreviewRight').src = flipped;
    }
  };
  img.src = base64;
}
window.sxFlipImage = sxFlipImage;

async function doShouxiang() {
  if (!sxLeftBase64 || !sxRightBase64) {
    showToast('请上传左右两只手的手掌照片', 'error');
    return;
  }
  const resultEl = document.getElementById('sxResult');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">AI 正在分析双手手相...</div>';
  await ensureKB();

  const isMale = sxGender === 'male';
  const 先天Hand = isMale ? '左手' : '右手';
  const 后天Hand = isMale ? '右手' : '左手';

  const visionPrompt = `请仔细观察以下两张手相照片。

【重要规则：左右手已由用户上传时明确标注，严格按以下顺序分析，不要自行判断方向】
第一张图片 = ${先天Hand}（${先天Hand === '左手' ? '用户上传的左边照片' : '用户上传的右边照片'}）· 先天命格
第二张图片 = ${后天Hand}（${后天Hand === '右手' ? '用户上传的右边照片' : '用户上传的左边照片'}）· 后天运势
用户性别：${isMale ? '男' : '女'}

【性别与左右手分工】
${isMale ? '男性手相：左手代表先天命格（天生底子），右手代表后天运势（实际人生经历）。' : '女性手相：右手代表先天命格（天生底子），左手代表后天运势（实际人生经历）。'}

请对每张照片分别提取结构化信息，并做双手对比：

【${先天Hand} · 先天命格】（第一张图片）
1. 掌型判断（火/水/木/金/土型及理由）
2. 生命线特征（长短、深浅、断裂/岛纹/分叉/链状纹）
3. 智慧线特征
4. 感情线特征
5. 事业线/财运线/婚姻线有无及特征
6. 掌丘丰满度
7. 手指特征
8. 特殊标记（三角纹、十字纹、星纹等）

【${后天Hand} · 后天运势】（第二张图片）
（同上8项）

【双手对比】
9. 两只手纹路的相似度与差异
10. 从先天手到后天手，哪些纹路变深/变浅/新增/消失
11. 这种变化反映的运势转变

请用中文输出结构化观察结果。`;

  // ========== 检测本地模型是否可用 ==========
  async function checkLocalModel(port) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`http://${getLocalServerIp()}:${port}/v1/models`, {
        method: 'GET',
        signal: ctrl.signal
      });
      clearTimeout(t);
      return res.ok;
    } catch (e) {
      console.log('检测端口' + port + '失败:', e.message);
      return false;
    }
  }

  const localPort = getLocalServerPort();
  const hasVL   = await checkLocalModel(localPort);  // 识图模型
  const hasText = await checkLocalModel(localPort);  // 文本模型

  // ========== 本地 VL 一把搞定 ==========
  if (hasVL) {
    try {
      resultEl.innerHTML = `<div class="loading">本地模型(${localPort})正在深度思考（最长8分钟）...</div>`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 600000); // 10分钟，深度思考慢模型需要足够时间，深度思考慢模型需要足够时间
      const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('shouxiang') : '';
      const fullPrompt = `你是一位精通手相学的命理大师。用户性别为${isMale ? '男' : '女'}，传统手相学中${isMale ? '男看左先天右后天' : '女看右先天左后天'}。

【重要规则】
第一张图片 = ${先天Hand} · 先天命格
第二张图片 = ${后天Hand} · 后天运势

请直接观察这两张手相照片，给出完整的命理解读：
1. ${先天Hand}先天命格分析
2. ${后天Hand}后天运势分析
3. 先天到后天的运势变化
4. 健康、事业、财运、感情等方面
5. 两只手差异的含义
6. 改善建议与趋吉避凶

知识库参考：
` + kbShouxiang() + (feedbackCalib ? '\n\n' + feedbackCalib : '') + `

【语言约束】所有输出必须使用纯中文，禁止输出任何英文单词、句子或混合中英文内容。禁止输出思考过程、分析步骤、"thinking process"等元内容。`;
      const res = await fetch(`${getLocalServerUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'local',
          messages: [{ role: 'user', content: [
            { type: 'text', text: fullPrompt },
            { type: 'image_url', image_url: { url: sxLeftBase64 } },
            { type: 'image_url', image_url: { url: sxRightBase64 } }
          ] }],
          temperature: 0.15, max_tokens: 4096
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('VL HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
      const cleanText = stripThinking(text);
      resultEl.innerHTML = '<div style="white-space:pre-wrap;">[本地 VL 模型 · 一把搞定]\n\n' + escapeHtml(cleanText) + '</div>';
      return;
    } catch (e) {
      console.log('本地 VL 失败:', e.message);
      resultEl.innerHTML = `<div class="loading">本地 模型(${localPort})失败: ` + escapeHtml(e.message) + '，准备切换云端...</div>';
    }
  }

  // ========== Fallback: 云端 VL 一把搞定 ==========
  const vKey = localStorage.getItem('vision_api_key') || DEFAULT_VISION_KEY;
  if (!vKey) {
    resultEl.innerHTML = `<div class="error">本地识图服务未启动(${localPort})，且未配置识图 API Key。<br>请在设置页填写阿里云百炼 API Key，或启动本地 VL 模型。</div>`;
    return;
  }

  resultEl.innerHTML = '<div class="loading">本地不可用，调用云端识图（双手分析）...</div>';
  try {
    const model = localStorage.getItem('vision_model') || 'qwen-vl-plus';
    const promptText = `你是一位精通手相学的命理大师。用户性别为${isMale ? '男' : '女'}，传统手相学中${isMale ? '男看左先天右后天' : '女看右先天左后天'}。\n\n【重要规则：左右手已由用户上传时明确标注，严格按以下顺序分析】\n第一张图片 = ${先天Hand} · 先天命格\n第二张图片 = ${后天Hand} · 后天运势\n\n请仔细观察这两张手相照片（${先天Hand}和${后天Hand}），从以下维度进行详细分析：\n\n【${先天Hand}分析】（第一张图片）\n1. 掌型（火型、水型、木型、金型、土型）\n2. 三大主线（生命线、智慧线、感情线）\n3. 事业线、财运线、婚姻线等辅助纹路\n4. 掌丘与手指特征\n\n【${后天Hand}分析】（第二张图片）\n（同上）\n\n【双手对比】\n5. 先天到后天的运势变化\n6. 两只手差异的含义\n\n请用通俗易懂的语言给出详细解读。` + kbShouxiang() + (window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('shouxiang') : '') + `

【语言约束】所有输出必须使用纯中文，禁止输出任何英文单词、句子或混合中英文内容。禁止输出思考过程、分析步骤、"thinking process"等元内容。`;
    const ctrl3 = new AbortController();
    const t3 = setTimeout(() => ctrl3.abort(), 90000);
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: sxLeftBase64 } },
          { type: 'image_url', image_url: { url: sxRightBase64 } }
        ] }],
        temperature: 0.6, max_tokens: 4096
      }),
      signal: ctrl3.signal
    });
    clearTimeout(t3);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || 'HTTP ' + res.status); }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '未返回内容';
    const cleanText = stripThinking(text);
    resultEl.innerHTML = '<div style="white-space:pre-wrap;">[云端模型]\n\n' + escapeHtml(cleanText) + '</div>';
  } catch (e) {
    resultEl.innerHTML = `<div class="error"><strong>分析失败</strong><br>本地模型无法连接，云端模型也未配置或不可用。<br><br><strong>解决步骤：</strong><br>1. 确认手机和电脑在同一WiFi下<br>2. 检查本地模型是否已启动（${localPort}端口）<br>3. 或在设置页配置阿里云百炼API Key<br><br>错误详情: ` + escapeHtml(e.message) + '</div>';
  }
}
window.doShouxiang = doShouxiang;

// ========== 姓名学 ==========
let xsGender = 'male';
function selXsGender(btn) {
  document.querySelectorAll('#pageXingshi [data-gender]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  xsGender = btn.dataset.gender;
}
window.selXsGender = selXsGender;

// ========== 三术同参（八字+紫微+六爻） ==========
let cxGender = 'male';
let cxCal = 'solar', cxLeap = false;
let cxState = { cal: 'solar', leap: false, gender: 'male' };
function selCxGender(btn) { document.querySelectorAll('#pageCross [data-gender]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); cxGender = btn.dataset.gender; cxState.gender = cxGender; }
function selCxCal(btn) {
  document.querySelectorAll('#pageCross [data-cal]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cxCal = btn.dataset.cal; cxState.cal = cxCal;
  document.getElementById('cxLeapWrap').style.display = cxCal === 'lunar' ? 'block' : 'none';
}
function selCxLeap(btn) {
  document.querySelectorAll('#pageCross [data-leap]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cxLeap = btn.dataset.leap === 'true'; cxState.leap = cxLeap;
}
window.selCxGender = selCxGender;
window.selCxCal = selCxCal;
window.selCxLeap = selCxLeap;

// currentCross已在上方声明
// let currentCross = null, currentCrossPrompt = '';

// 三盘信号词提取（用于让 AI 找共性）
function extractSignals(pan, domain) {
  const signals = [];
  if (domain === 'bazi' && pan.gz) {
    const wx = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' }[pan.gz.day[0]];
    signals.push(pan.gz.day[0] + wx); // 日主五行
    if (pan.tenGods) {
      const gods = new Set();
      Object.values(pan.tenGods).forEach(v => v && ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'].forEach(g => v.includes(g) && gods.add(g)));
      signals.push([...gods].join(','));
    }
  } else if (domain === 'ziwei' && pan.mingGong) {
    pan.mingGong.stars?.forEach(s => s.type === 'main' && signals.push(s.name));
  } else if (domain === 'liuyao' && pan.yaoList) {
    const dong = pan.yaoList.filter(y => y.isDong);
    signals.push(pan.gua.name);
    if (dong.length > 0) {
      signals.push('动' + dong[0].liuqin);
    }
    const cai = pan.yaoList.find(y => y.liuqin === '妻财');
    if (cai) signals.push('财在' + cai.name + '(' + (cai.isDong ? '动' : '静') + ')');
  }
  return signals;
}

function doCross() {
  const year = +document.getElementById('cxYear').value;
  const month = +document.getElementById('cxMonth').value;
  const day = +document.getElementById('cxDay').value;
  const hour = +document.getElementById('cxHour').value;
  const question = document.getElementById('cxQuestion').value || '问近期运势';
  const gender = cxGender;
  if (!year || year < 1900 || year > 2030) { showToast('请输入有效年份(1900-2030)', 'error'); return; }
  if (!month || month < 1 || month > 12) { showToast('请输入有效月份(1-12)', 'error'); return; }
  if (!day || day < 1 || day > 31) { showToast('请输入有效日期(1-31)', 'error'); return; }
  if (hour < 0 || hour > 23) { showToast('请输入有效小时(0-23)', 'error'); return; }

  const result = document.getElementById('cxResult');
  result.style.display = 'block';
  result.innerHTML = '<div class="loading">三术同参排盘中...</div>';

  try {
    // 1. 八字（支持农历+闰月）
    let solar;
    if (cxCal === 'lunar') {
      // lunar-javascript 1.6.x：闰月用负数月表示，如 2017 闰六月 = -6
      // isLeapMonth 参数 = true 时表示闰月（不论 month 是正负，true 才是闰月）
      const lunar = window.Lunar.fromYmd(year, month, day, cxLeap);
      solar = lunar.getSolar();
    } else {
      solar = window.Solar.fromYmd(year, month, day);
    }
    const gz = getBaziPan(solar, gender);
    if (!gz || !gz.day || gz.day.length < 2) {
      throw new Error(`八字排盘失败：日柱未生成（请检查日期是否有效）`);
    }
    const tg = gz.day[0];
    const tenGods = calcTenGods(tg, gz);
    const wangShuai = judgeWangShuai(tg, gz);
    const baziPan = { solar, gz, tenGods, gender, question, wangShuai };

    // 2. 紫微（小时转地支序号）
    const zhiIdx = Math.floor((hour + 1) / 2) % 12;
    let chart;
    if (cxCal === 'lunar') {
      // iztro 1.x 闰月参数：第四个参数 true=闰月
      chart = window.iztroAstro.byLunar(`${year}-${month}-${day}`, zhiIdx, gender, cxLeap, true, 'zh-CN');
    } else {
      chart = window.iztroAstro.bySolar(`${year}-${month}-${day}`, zhiIdx, gender, true, 'zh-CN');
    }
    if (!chart || !chart.palaces) throw new Error('紫微排盘失败：命盘未生成');
    const ziweiPan = adaptZiwei(chart);

    // 3. 六爻（用当前时刻起卦，时间起卦）
    const lyDt = new Date(year, month - 1, day, hour);
    if (isNaN(lyDt.getTime())) throw new Error('日期无效，无法起六爻');
    const lyPan = window.liuyao.panGua('time', { dt: lyDt });
    if (!lyPan || !lyPan.gua || !lyPan.yaoList || lyPan.yaoList.length !== 6) {
      throw new Error('六爻排盘失败');
    }

    // 渲染三盘
    let html = '<h3 style="color:var(--accent-gold);">🔀 三术同参结果</h3>';
    if (cxCal === 'lunar') {
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">⚠️ 已按${cxLeap ? '闰' : '非闰'}农历${year}年${month}月${day}日 → 公历${solar.toYmd()} 排盘</div>`;
    }

    // 八字摘要
    const baziSig = extractSignals(baziPan, 'bazi');
    html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
      <div style="color:var(--accent-gold);">📅 八字：${gz.year} ${gz.month} ${gz.day} ${gz.hour}</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
        旺衰：${wangShuai === '身强' ? '<span style="color:var(--accent-green)">身强</span>' : '<span style="color:var(--accent-red)">身弱</span>'}
        · 信号：${baziSig.join('、')}
      </div>
    </div>`;

    // 紫微摘要
    const zwSig = extractSignals(ziweiPan, 'ziwei');
    const mainStars = ziweiPan.mingGong.stars?.filter(s => s.type === 'main').map(s => s.name).join('、') || '无';
    html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
      <div style="color:var(--accent-gold);">⭐ 紫微：命宫在${ziweiPan.mingGong.name}（${ziweiPan.mingGong.ganzhi}）</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
        主星：${mainStars} · 信号：${zwSig.join('、')}
      </div>
    </div>`;

    // 六爻摘要
    const lySig = extractSignals(lyPan, 'liuyao');
    const dongList = lyPan.gua.dongYaoList || [];
    html += `<div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.5rem;">
      <div style="color:var(--accent-gold);">☯ 六爻：${lyPan.gua.name} ${dongList.length > 0 ? '动第' + dongList.join('、') + '爻' : '静卦'}</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.3rem;">
        信号：${lySig.join('、')}
      </div>
    </div>`;

    result.innerHTML = html;

    currentCross = { bazi: baziPan, ziwei: ziweiPan, liuyao: lyPan, question, signals: { bazi: baziSig, ziwei: zwSig, liuyao: lySig } };
    currentCrossPrompt = buildCrossPrompt(currentCross);

    document.getElementById('cxAI').style.display = 'block';
    document.getElementById('cxAIBtn').style.display = 'inline-block';
    document.getElementById('cxAILoading').style.display = 'none';
    document.getElementById('cxAIText').style.display = 'none';
  } catch (e) {
    result.innerHTML = `<div class="error">排盘失败: ${escapeHtml(e.message)}</div>`;
  }
}
window.doCross = doCross;

function buildCrossPrompt(c) {
  let s = `=== 三术同参综合排盘 ===\n`;
  s += `问题：${c.question}\n`;
  s += `生辰：${c.bazi.gz.year} ${c.bazi.gz.month} ${c.bazi.gz.day} ${c.bazi.gz.hour}\n`;
  s += `性别：${c.bazi.gender === 'male' ? '男' : '女'}\n\n`;

  s += `【八字盘】\n`;
  s += `四柱：${c.bazi.gz.year} ${c.bazi.gz.month} ${c.bazi.gz.day} ${c.bazi.gz.hour}\n`;
  s += `日主：${c.bazi.gz.day[0]}（${c.signals.bazi[0]||''}） 旺衰：${c.bazi.wangShuai || '?'}\n`;
  s += `十神信号：${c.signals.bazi.join('、')}\n\n`;

  s += `【紫微盘】\n`;
  s += `命宫：${c.ziwei.mingGong.name}（${c.ziwei.mingGong.ganzhi}）\n`;
  s += `主星：${c.ziwei.mingGong.stars?.filter(s=>s.type==='main').map(s=>s.name).join('、')||'无'}\n`;
  s += `四化：${Object.entries(c.ziwei.siHua||{}).map(([k,v])=>v+k).join(' ') || '无'}\n\n`;

  s += `【六爻盘】\n`;
  s += `卦名：${c.liuyao.gua.name}\n`;
  s += `动爻：${(c.liuyao.gua.dongYaoList||[]).length > 0 ? '第' + c.liuyao.gua.dongYaoList.join('、') + '爻' : '无'}\n`;
  s += `六亲信号：${c.signals.liuyao.join('、')}\n\n`;

  s += `【请按"三术同参"模式解读】\n`;
  s += `1. 提取三盘共同信号（旺相/动爻/格局/四化）\n`;
  s += `2. 比较三盘对同一问题的方向（吉/凶/中）\n`;
  s += `3. 一致处为高置信结论；矛盾处需特别说明\n`;
  s += `4. 给出综合判断及具体建议\n`;
  return s;
}

async function doAICross() {
  if (!currentCrossPrompt || !currentCross || !currentCross.bazi) {
    showToast('请先进行三术排盘', 'error');
    return;
  }
  await ensureKB();
  await window.RAG.build();
  const btn = document.getElementById('cxAIBtn');
  const loading = document.getElementById('cxAILoading');
  const text = document.getElementById('cxAIText');
  btn.disabled = true; btn.textContent = '综合中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问：' + (currentCross.question || '') + '\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '⏳ 正在综合八字+紫微+六爻三术...\n';

  let fullText = '⏳ 正在综合八字+紫微+六爻三术...\n';
  try {
    const factsBazi = window.Expert.bazi(currentCross.bazi);
    const factsLiu = window.Expert.liuyao(currentCross.liuyao);
    const factsZiwei = window.Expert.ziwei(currentCross.ziwei);
    // 交叉验证（代码层面确定三术一致性）
    const crossCheck = window.Expert.crossValidate ? window.Expert.crossValidate(currentCross) : null;
    const ragContent = window.RAG.search(currentCross.bazi, currentCross.question, { topK: 8, maxChars: 2000 });
    const historyPrompt = getSimilarHistoryPrompt('cross', currentCross.bazi.gz.day, currentCross.question);
    const feedbackCalib = window.FeedbackLoop ? window.FeedbackLoop.getCalibrationPrompt('cross') : '';
    const riskPrompt = window.FeedbackLoop ? window.FeedbackLoop.getRiskPrompt('cross', currentCross.question) : '';
    const system = '【三术同参原则】\n'
      + '1. 三术皆属同一人生轨迹的"不同投影"，不应有本质矛盾\n'
      + '2. 一致结论置信度高，可作主要建议\n'
      + '3. 矛盾时需分析是排盘差异还是时点差异，不轻易否定\n'
      + '4. 给每条结论标注：八字+紫微+六爻 三/二/一 术支持\n'
      + '5. 优先采信交叉验证中"高置信度"结论\n'
      + '6. 用神一致时结论更可靠，用神不一致时需分别说明各术视角\n\n'
      + (crossCheck?.formatted || '')
      + '\n'
      + (factsBazi ? '【八字事实·100%准确】\n' + factsBazi + '\n' : '')
      + (factsZiwei ? '【紫微事实·100%准确】\n' + factsZiwei + '\n' : '')
      + (factsLiu ? '【六爻事实·100%准确】\n' + factsLiu + '\n' : '')
      + (ragContent || '')
      + (historyPrompt || '')
      + (feedbackCalib || '')
      + (riskPrompt || '')
      + '\n\n'
      + window.Expert.chainOfThought('三术同参');

    // 引导用户问题转化为三术共同关心的方向
    const out = await callDeepSeek(currentCrossPrompt, system, (delta, full) => {
      fullText = full;
      text.textContent = prefix + separator + full;
    });
    // 流式失败兜底：用最终返回值
    if (!fullText && out) {
      fullText = out;
      text.textContent = prefix + separator + out;
    } else if (fullText && out && fullText.length < out.length) {
      // 流式接收不完整（被截断）
      text.textContent = prefix + separator + fullText + '\n\n... [内容已截断，完整内容见历史]';
    }
    const finalText = prefix + separator + (fullText || out);
    saveHistory('cross', currentCross.bazi.gz.day, currentCross.question, finalText);
    addFeedbackUI('cross', text, finalText, currentCrossPrompt, system);
    showResultActions('cxAIText', 'cxAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error"><span>⚠️ 综合解读失败: ' + escapeHtml(e.message) + '</span><button onclick="doAICross()" class="retry-btn">🔄 重试</button></div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 综合解读';
  }
}
window.doAICross = doAICross;

// currentXs已在上方声明
// let currentXs = null, currentXsPrompt = '';

function doXingshi() {
  const surname = document.getElementById('xsSurname').value.trim();
  const name = document.getElementById('xsName').value.trim();
  if (!surname || !name) { showToast('请输入完整的姓氏和名字', 'error'); return; }
  if (!window.Xingshi) { showToast('姓名学模块加载中', 'error'); return; }

  try {
    const data = window.Xingshi.calculateGege(surname, name);
    const result = document.getElementById('xsResult');
    result.style.display = 'block';

    const wuxingMap = { 1:'木', 2:'木', 3:'火', 4:'火', 5:'土', 6:'土', 7:'金', 8:'金', 9:'火' };
    const dotGe = (n) => {
      const last = n % 10;
      return [1, 3, 5, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 77, 78, 81].includes(last) ? '大吉'
           : [29, 38, 49, 53, 73, 80].includes(last) ? '中吉'
           : '凶';
    };
    const clr = (s) => s === '大吉' ? 'var(--accent-green)' : s === '中吉' ? 'var(--accent-gold)' : 'var(--accent-red)';

    result.innerHTML = `
      <h3 style="color:var(--accent-gold);">📜 姓名五格排盘</h3>
      <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
        <div style="font-size:1.3rem;font-weight:600;color:var(--accent-gold);">${surname}${name}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">
          姓「${data.surname.split('').map(c => c + '(' + window.Xingshi.getCharBihua(c) + ')').join('、')}」 ·
          名「${data.name.split('').map(c => c + '(' + window.Xingshi.getCharBihua(c) + ')').join('、')}」
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:0.8rem;font-size:0.9rem;">
        <thead>
          <tr style="background:var(--bg-inner);">
            <th style="padding:0.4rem;">五格</th><th>数</th><th>五行</th><th>吉凶</th><th>影响</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>天格</td><td>${data.tiange}</td><td>${wuxingMap[data.tiange]||''}</td><td style="color:${clr(dotGe(data.tiange))};">${dotGe(data.tiange)}</td><td>先天运、父母</td></tr>
          <tr><td><strong>人格</strong></td><td><strong>${data.renge}</strong></td><td><strong>${wuxingMap[data.renge]||''}</strong></td><td style="color:${clr(dotGe(data.renge))};"><strong>${dotGe(data.renge)}</strong></td><td><strong>主运、事业【最重】</strong></td></tr>
          <tr><td>地格</td><td>${data.dige}</td><td>${wuxingMap[data.dige]||''}</td><td style="color:${clr(dotGe(data.dige))};">${dotGe(data.dige)}</td><td>前运、基础</td></tr>
          <tr><td>外格</td><td>${data.waige}</td><td>${wuxingMap[data.waige]||''}</td><td style="color:${clr(dotGe(data.waige))};">${dotGe(data.waige)}</td><td>副运、社交</td></tr>
          <tr><td>总格</td><td>${data.zongge}</td><td>${wuxingMap[data.zongge]||''}</td><td style="color:${clr(dotGe(data.zongge))};">${dotGe(data.zongge)}</td><td>后运、总格局</td></tr>
        </tbody>
      </table>
      <div style="background:var(--bg-inner);padding:0.6rem;border-radius:6px;margin-top:0.8rem;font-size:0.9rem;">
        <span style="color:var(--accent-gold);">三才配置：</span>
        <span style="font-weight:600;">${data.sancaiWuge.join(' → ')}</span>
        <span style="color:var(--text-muted);font-size:0.8rem;">（天格·人格·地格）</span>
      </div>
    `;
    currentXs = { ...data, gender: xsGender, birth: document.getElementById('xsBirth').value.trim() };
    currentXsPrompt = window.Xingshi.buildXingshiPrompt(data, xsGender, currentXs.birth);
    document.getElementById('xsAI').style.display = 'block';
    document.getElementById('xsAIBtn').style.display = 'inline-block';
    document.getElementById('xsAILoading').style.display = 'none';
    document.getElementById('xsAIText').style.display = 'none';
  } catch (e) {
    showToast('测算失败: ' + e.message, 'error');
  }
}
window.doXingshi = doXingshi;

async function doAIXingshi() {
  if (!currentXsPrompt) return;
  await ensureKB();
  const btn = document.getElementById('xsAIBtn');
  const loading = document.getElementById('xsAILoading');
  const text = document.getElementById('xsAIText');
  btn.disabled = true; btn.textContent = '解读中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '';

  let fullText = '';
  try {
    const sys = '你是一位精通姓名学的命理大师，请根据五格剖象进行专业解读。重点说明人格（主运）、地格（基础）、总格（后运）的吉凶含义，并结合三才配置分析。注意：吉数并非绝对好，需要配合三才平衡。' + kbXingshi() + kbXingshiCases();
    const out = await callDeepSeek(currentXsPrompt, sys, (delta, full) => {
      fullText = full;
      text.textContent = prefix + separator + full;
    });
    if (!fullText && out) {
      fullText = out;
      text.textContent = prefix + separator + out;
    }
    showResultActions('xsAIText', 'xsAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error"><span>⚠️ 解读失败: ' + escapeHtml(e.message) + '</span><button onclick="doAIXingshi()" class="retry-btn">🔄 重试</button></div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAIXingshi = doAIXingshi;

function kbXingshi() {
  return '\n\n【知识库参考】五格数理吉凶简表：\n'
    + '大吉数：1, 3, 5, 7, 8, 11, 13, 15, 16, 17, 18, 21, 23, 24, 25, 31, 32, 33, 35, 37, 39, 41, 45, 47, 48, 52, 57, 61, 63, 65, 67, 68, 77, 78, 81\n'
    + '中吉数：29, 38, 49, 53, 73, 80\n'
    + '三才配置要点：人格地格五行相生或比和最吉；相克则主波折。三才配合五格主次分明、人格吉利、总格不凶者为上佳姓名。';
}

// ========== 风水罗盘（八宅） ==========
let fsHouse = 'zhai', fsGender = 'male';
function selFsHouse(btn) { document.querySelectorAll('#pageFengshui [data-house]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); fsHouse = btn.dataset.house; }
function selFsGender(btn) { document.querySelectorAll('#pageFengshui [data-gender]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); fsGender = btn.dataset.gender; }
window.selFsHouse = selFsHouse; window.selFsGender = selFsGender;

// currentFs已在上方声明
// let currentFs = null, currentFsPrompt = '';

// 八宅命卦：命卦算法流派众多
// 此函数只输出"年干+年支+性别"作为事实，命卦由AI按传统公式（最主流版）判断。
function mingGua(year, gender) {
  const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const zhiIdx = ((year - 4) % 12 + 12) % 12;
  const ganIdx = ((year - 4) % 10 + 10) % 10;
  return {
    yearGanZhi: TG[ganIdx] + DZ[zhiIdx],
    yangYear: ganIdx % 2 === 0,  // 阳干：甲丙戊庚壬
    gender,
    zhiIdx
  };
}

// 宅卦（大门朝向决定）：东南西北+四隅 → 后天八卦
var MEN_GUA = { '东':'震', '南':'离', '西':'兑', '北':'坎', '东南':'巽', '西南':'坤', '西北':'乾', '东北':'艮' };

// 八宅"伏位轨迹"按后天八卦顺行（坎→坤→震→巽→中→乾→兑→艮→离→坎）
// 但更标准的"八宅"流派是按"大游年"或"小游年"轨迹
// 主流算法：以大门朝向为"伏位"起点，沿后天八卦顺行
//   伏位=大门朝向卦, 延年=伏位对宫, 天医=伏位顺1, 生气=天医顺1
//   绝命=延年对宫, 祸害=伏位对宫, 五鬼=生气对宫, 六煞=天医对宫
// 注：此简化算法在大门朝向东四卦（震巽坎离）和西四卦（乾坤兑艮）时吉凶方位有差异
function eightZhai(doorDir) {
  const houseGong = MEN_GUA[doorDir];
  if (!houseGong) return null;
  // 后天八卦顺行序
  const HOUTIAN = ['坎','坤','震','巽','中','乾','兑','艮','离'];
  const startIdx = HOUTIAN.indexOf(houseGong);

  // 吉方规则（"大游年"法）：伏位→延年→生气→天医（4个吉位）
  // 凶方：祸害→六煞→五鬼→绝命
  // 大游年：每个卦宫有"4吉4凶"固定位
  const GONG_8ZHAI = {
    '坎': { 吉: { 伏位:'北', 生气:'东南', 天医:'东', 延年:'南' }, 凶: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } },
    '坤': { 吉: { 伏位:'西南', 生气:'北', 天医:'东', 延年:'东南' }, 凶: { 祸害:'南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
    '震': { 吉: { 伏位:'东', 生气:'南', 天医:'东南', 延年:'北' }, 凶: { 祸害:'西南', 六煞:'西', 五鬼:'东北', 绝命:'西北' } },
    '巽': { 吉: { 伏位:'东南', 生气:'东', 天医:'北', 延年:'南' }, 凶: { 祸害:'西', 六煞:'东北', 五鬼:'西南', 绝命:'西北' } },
    '中': { 吉: { 伏位:'中', 生气:'南', 天医:'东', 延年:'北' }, 凶: { 祸害:'西南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
    '乾': { 吉: { 伏位:'西北', 生气:'西南', 天医:'东', 延年:'北' }, 凶: { 祸害:'南', 六煞:'西', 五鬼:'东北', 绝命:'东南' } },
    '兑': { 吉: { 伏位:'西', 生气:'西北', 天医:'东南', 延年:'南' }, 凶: { 祸害:'北', 六煞:'东北', 五鬼:'西南', 绝命:'东' } },
    '艮': { 吉: { 伏位:'东北', 生气:'西', 天医:'北', 延年:'西南' }, 凶: { 祸害:'东', 六煞:'南', 五鬼:'西北', 绝命:'东南' } },
    '离': { 吉: { 伏位:'南', 生气:'北', 天医:'东', 延年:'东南' }, 凶: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } }
  };
  return GONG_8ZHAI[houseGong];
}

function doFengshui() {
  const door = document.getElementById('fsDoor').value;
  const year = +document.getElementById('fsBirthYear').value;
  if (!year || year < 1900 || year > 2030) { showToast('请输入有效出生年（1900-2030）', 'error'); return; }

  const ming = mingGua(year, fsGender);
  const house = MEN_GUA[door];
  const eightHouse = eightZhai(door);
  const ji = eightHouse ? eightHouse.吉 : null;
  const xiong = eightHouse ? eightHouse.凶 : null;

  const result = document.getElementById('fsResult');
  result.style.display = 'block';
  result.innerHTML = `
    <h3 style="color:var(--accent-gold);">🧭 八宅风水分析</h3>
    <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
      <div style="font-size:0.95rem;">命主生辰：<strong style="color:var(--accent-gold);">${ming.yearGanZhi}年 性别${fsGender === 'male' ? '男' : '女'}（${ming.yangYear ? '阳年' : '阴年'}生）</strong></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.3rem;">命卦：交由AI按传统公式（<code>男11-年支、女4+年支</code>）查定；常见算法流派不一，AI会注明所采用流派</div>
      <div style="font-size:0.95rem;margin-top:0.3rem;">宅卦（大门朝向决定）：<strong style="color:var(--accent-gold);">${house}（大门朝${door}）</strong></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:0.8rem;font-size:0.85rem;">
      <thead>
        <tr style="background:var(--bg-inner);">
          <th style="padding:0.4rem;">星位</th><th>方位</th><th>吉凶</th><th>用途建议</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>伏位（伏）</td><td><strong>${ji.伏位}</strong></td><td style="color:var(--accent-gold);">小吉</td><td>书房、子女房</td></tr>
        <tr><td>生气（最吉）</td><td><strong>${ji.生气}</strong></td><td style="color:var(--accent-green);">大吉</td><td>主房、客厅、开门纳气</td></tr>
        <tr><td>延年（大吉）</td><td><strong>${ji.延年}</strong></td><td style="color:var(--accent-green);">大吉</td><td>夫妻房、长辈房</td></tr>
        <tr><td>天医（大吉）</td><td><strong>${ji.天医}</strong></td><td style="color:var(--accent-green);">大吉</td><td>卧室、财位、厨房</td></tr>
        <tr><td>祸害（小凶）</td><td><strong>${xiong.祸害}</strong></td><td style="color:var(--accent-red);">小凶</td><td>避免主用，宜放杂物</td></tr>
        <tr><td>六煞（中凶）</td><td><strong>${xiong.六煞}</strong></td><td style="color:var(--accent-red);">中凶</td><td>避免睡房、宜空置或放植物</td></tr>
        <tr><td>五鬼（大凶）</td><td><strong>${xiong.五鬼}</strong></td><td style="color:var(--accent-red);">大凶</td><td>不可作主门，宜储藏</td></tr>
        <tr><td>绝命（至凶）</td><td><strong>${xiong.绝命}</strong></td><td style="color:var(--accent-red);">至凶</td><td>绝对避免主用，宜化煞</td></tr>
      </tbody>
    </table>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">⚠️ 八宅吉凶方仅按大门朝向（宅卦）排布；命卦的"东四/西四"分类用于判断宅卦是否适合命主（由AI解读时综合判定）</div>
  `;
  currentFs = { ming, door, house, ji, xiong, gender: fsGender, houseType: fsHouse };
  currentFsPrompt = `=== 八宅风水排盘 ===\n出生年：${year}年（${ming.yearGanZhi}年） 性别：${fsGender === 'male' ? '男' : '女'}（${ming.yangYear ? '阳年生' : '阴年生'}）\n大门朝向：${door}（宅卦${house}）\n户型：${fsHouse === 'zhai' ? '住宅' : '办公室'}\n\n【请按以下步骤推理】\n1. 根据年干支+性别，按传统命卦公式（男命11-年支/女命4+年支→模9）算出命卦\n2. 判断东四命/西四命（坎震巽离=东四；乾坤兑艮=西四）\n3. 与宅卦${house}对比，告知是否"宅命相合"\n4. 给出四吉方具体布置建议、四凶方如何化煞\n\n四吉方（按大门朝${door}，宅卦${house}）：\n  伏位${ji.伏位} · 生气${ji.生气} · 延年${ji.延年} · 天医${ji.天医}\n\n四凶方：\n  祸害${xiong.祸害} · 六煞${xiong.六煞} · 五鬼${xiong.五鬼} · 绝命${xiong.绝命}\n\n请结合以上信息给出专业的风水建议。`;
  document.getElementById('fsAI').style.display = 'block';
  document.getElementById('fsAIBtn').style.display = 'inline-block';
  document.getElementById('fsAILoading').style.display = 'none';
  document.getElementById('fsAIText').style.display = 'none';
}
window.doFengshui = doFengshui;

async function doAIFengshui() {
  if (!currentFsPrompt) return;
  await ensureKB();
  const btn = document.getElementById('fsAIBtn');
  const loading = document.getElementById('fsAILoading');
  const text = document.getElementById('fsAIText');
  btn.disabled = true; btn.textContent = '解读中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '';

  let fullText = '';
  try {
    const sys = '你是一位精通八宅风水的大师，请根据命卦、宅卦、户型进行详细分析。重点说明：1.命卦与宅卦是否相合 2.四吉方如何利用 3.四凶方如何化解 4.卧室/客厅/厨房/书房的最佳布局建议。' + kbFengshui() + kbFengshuiExt() + kbFengshuiLuopan() + kbWannianli();
    const out = await callDeepSeek(currentFsPrompt, sys, (delta, full) => {
      fullText = full;
      text.textContent = prefix + separator + full;
    });
    if (!fullText && out) {
      fullText = out;
      text.textContent = prefix + separator + out;
    }
    showResultActions('fsAIText', 'fsAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error"><span>⚠️ 解读失败: ' + escapeHtml(e.message) + '</span><button onclick="doAIFengshui()" class="retry-btn">🔄 重试</button></div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
  }
}
window.doAIFengshui = doAIFengshui;

// 基础风水知识（内联）
function kbFengshuiBasic() {
  return '\n\n【知识库参考】八宅风水要点：\n'
    + '· 八宅由"伏位"起，沿洛书轨迹分四吉四凶星位\n'
    + '· 东四命（坎/震/巽/离）吉位：东、南、北、东南\n'
    + '· 西四命（坤/兑/乾/艮）吉位：西、西南、西北、东北\n'
    + '· 大门（气口）宜在生气方或延年方\n'
    + '· 主卧宜在延年或天医方，厨房灶位宜压五鬼祸害方\n'
    + '· 书房宜在伏位，文昌位则需结合流年飞星另定\n';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 拖拽上传
function setupSxDragDrop(areaId, inputId, hand) {
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
      onSxFileSelect({ target: { files: [file] } }, hand);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupSxDragDrop('sxUploadAreaLeft', 'sxFileInputLeft', 'left');
  setupSxDragDrop('sxUploadAreaRight', 'sxFileInputRight', 'right');
  
  // 兜底：用 addEventListener 绑定所有导航按钮（兼容 WebView）
  const navMap = {
    'navBazi': () => switchPage('bazi'),
    'navZiwei': () => switchPage('ziwei'),
    'navLiuyao': () => switchPage('liuyao'),
    'navQimen': () => switchPage('qimen'),
    'navShouxiang': () => switchPage('shouxiang'),
    'navXingshi': () => switchPage('xingshi'),
    'navCross': () => switchPage('cross'),
    'navFengshui': () => switchPage('fengshui'),
    'navSettings': () => switchPage('settings')
  };
  for (const [id, fn] of Object.entries(navMap)) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', fn);
      el.addEventListener('touchend', function(e) { e.preventDefault(); fn(); });
    }
  }
  
  // 移动端触摸优化
  document.querySelectorAll('button, .toggle-btn, .divine-btn, .save-btn').forEach(el => {
    el.addEventListener('touchstart', () => {}, {passive: true});
    el.style.cursor = 'pointer';
  });
});

// 初始化
loadSettings();
initDateInputs();
switchPage('bazi');

