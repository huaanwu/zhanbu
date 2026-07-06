/**
 * AI 占卜大师 - 主应用逻辑 (v2.0)
 * v2.0.1: 从 index.html 拆出 4770 行 inline JS
 * 包含: 页面切换、状态管理、8 大流派的 UI 绑定 + AI 解读调用
 *
 * 设计原则:
 *   - 全局函数暴露 window.X = X 以兼容 HTML onclick 处理器
 *   - 不使用 ES module (避免 onclick 失效)
 *   - 按流派/特性分组,后续可拆分为 ui-bazi.js / ui-ziwei.js ...
 */

// 启动时强制加载 Expert/RAG（解决大文件脚本加载不稳定问题）
// 注意：file:// 协议下 fetch 被 CORS 阻止，依赖 script src 标签加载
(function checkExpertRAG() {
  // v1.3.1 修复: 严禁使用 eval() 兜底(违反 CLAUDE.md),改为显式错误提示
  if (typeof window.Expert === 'undefined') {
    console.error('expert.js 未加载，请检查 <script src="expert.js"> 标签');
    typeof showToast === 'function' && showToast('expert.js 加载失败，请刷新页面或重新安装', 'error');
  }
  if (typeof window.RAG === 'undefined') {
    console.error('rag.js 未加载，请检查 <script src="rag.js"> 标签');
    typeof showToast === 'function' && showToast('rag.js 加载失败，请刷新页面或重新安装', 'error');
  }
  // v1.4 RAG 预热: 启动后空闲时提前构建,首次 AI 解读不再等 1-3s
  if (window.RAG && typeof window.RAG.prewarm === 'function') {
    window.RAG.prewarm();
  }
})();

var APP_VERSION = 'v3.0.4';
var APP_BUILD_DATE = '2026-07-06';

// ========== 版本升级清理旧配置 ==========
(function() {
  const savedVer = localStorage.getItem('app_version');
  if (savedVer !== APP_VERSION) {
    console.log('版本升级:', savedVer, '->', APP_VERSION, '清理旧配置/格式不兼容的缓存');
    // 旧版本才需要清 local_server_ip;新版本保留用户设置
    // 旧版本的缓存 key 格式可能不兼容,清掉重新建立
    if (savedVer && savedVer < 'v1.3.0') {
      localStorage.removeItem('local_server_ip');
    }
    // 清空格式可能不兼容的旧缓存(新格式会重建)
    if (savedVer && savedVer < 'v1.4.0') {
      localStorage.removeItem('divination_cache_v1');
      localStorage.removeItem('divination_cache_access_order');
      localStorage.removeItem('divination_cache_version');
    }
    // 旧版本的反馈/历史可能用明文存,清掉让用户重新积累(避免解密失败)
    if (savedVer && savedVer < 'v1.4.0') {
      console.log('  → 清空 v1.4 之前明文存储的反馈/历史,重新加密');
      localStorage.removeItem('divination_feedback_v1');
      // 历史保留(明文历史不影响功能,只是不合规)
    }
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

// v1.3.1 安全修复: 严禁硬编码任何 API Key,默认值必须为空
// 用户在设置页 (settings) 配置后存到 localStorage['ds_api_key']
var DEFAULT_API_KEY = '';
var DEFAULT_VISION_KEY = '';

// ========== 页面切换 ==========
function switchPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
  document.getElementById('nav' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
  // v1.2.15 按需预加载对应领域 KB 组（后台加载，不阻塞 UI）
  ensureCoreKB().catch(e => console.warn('core KB fail:', e));
  const groups = PAGE_KB_GROUPS[name];
  if (groups) loadKBGroups(groups).catch(e => console.warn('KB group preload fail:', e));
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
// v1.4 加密版: 总是走加密路径 (signal/output/panSnapshot 都走 AES-GCM)
// 失败时 addEncrypted 内部降级为明文
function saveHistory(domain, signal, question, output, panSnapshot) {
  if (!window.History) return;
  try {
    if (window.Crypto) {
      window.History.addEncrypted(domain, signal, question, output, panSnapshot);
    } else {
      // 浏览器无 Web Crypto API,降级明文
      window.History.add(domain, signal, question, output, panSnapshot);
    }
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
  const feedback = document.getElementById('historyFilterFeedback')?.value || '';

  const items = window.History.search({ domain, days: days === 'all' ? 'all' : +days, keyword, feedback });
  const list = document.getElementById('historyList');
  const stats = document.getElementById('historyStats');

  // 统计面板：v1.2.16 增强（反馈率 + 各模块分布）
  const s = window.History.stats();
  const fbTotal = s.feedbacks.good + s.feedbacks.partial + s.feedbacks.bad;
  const fbRate = fbTotal > 0 ? Math.round((s.feedbacks.good / fbTotal) * 100) : 0;
  const topDomains = Object.entries(s.domains).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${DOMAIN_LABELS[k] || k} ${v}`).join(' / ') || '无';
  stats.innerHTML = `共 <b>${s.total}</b> 条` + (items.length !== s.total ? ` · 筛选 <b>${items.length}</b>` : '')
    + ` · 反馈率 <b style="color:${fbRate >= 70 ? 'var(--accent-green)' : fbRate >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)'};">${fbRate}%</b>`
    + ` <span style="color:var(--text-muted);">（✓${s.feedbacks.good} ≈${s.feedbacks.partial} ✗${s.feedbacks.bad} ○${s.feedbacks.none}）</span>`
    + `<br><span style="color:var(--text-muted);">常用：${topDomains}</span>`;

  if (items.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.85rem;">暂无记录</div>';
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
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;cursor:pointer;"
             onclick="toggleHistoryDetail('${item.id}')">
          <div style="flex:1;min-width:0;">
            <span style="display:inline-block;background:var(--bg-inner);color:var(--accent-gold);font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:4px;margin-right:0.3rem;">${label}</span>
            <span style="font-size:0.8rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70vw;display:inline-block;vertical-align:middle;">${escapeHtml(item.question || '无问题')}</span>
            <span style="font-size:0.75rem;color:${fbColor};margin-left:0.3rem;">${fbIcon}</span>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;">${formatHistoryDate(item.ts)}</span>
        </div>
        <div class="history-summary" style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;"
             onclick="toggleHistoryDetail('${item.id}')">
          ${summary}${(item.output||'').length > 80 ? '...' : ''}
        </div>
        <div class="history-detail" id="hd-${item.id}" style="display:none;margin-top:0.5rem;padding:0.5rem;background:var(--bg-inner);border-radius:6px;font-size:0.8rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.6;max-height:40vh;overflow-y:auto;">
          ${escapeHtml(item.output || '')}
        </div>
        <div class="history-actions" style="display:none;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;" id="ha-${item.id}">
          <button onclick="copyHistoryText('${item.id}')" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">📋 复制</button>
          <button onclick="exportHistoryItem('${item.id}')" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-gold);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">💾 导出</button>
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

function exportHistoryItem(id) {
  if (!window.History) return;
  const items = window.History.load();
  const item = items.find(i => i.id === id);
  if (!item) return;
  const label = DOMAIN_LABELS[item.domain] || item.domain;
  const date = new Date(item.ts);
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const fbMap = { good: '✓ 准确', partial: '≈ 部分准', bad: '✗ 不准' };
  const fb = fbMap[item.feedback] || '○ 未评';
  const text = `# 倪海厦占卜·${label}\n\n` +
    `时间：${dateStr}\n` +
    `类型：${label}\n` +
    `问题：${item.question || '（无）'}\n` +
    `信号：${item.signal || ''}\n` +
    `反馈：${fb}\n` +
    `\n--- 解读 ---\n\n${item.output || ''}\n`;
  // 触发下载
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `占卜_${label}_${dateStr.replace(/[: ]/g, '-')}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('已导出', 'success');
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

// v1.4 隐私合规: 一键清除所有数据
// 用途: 退出登录 / 换设备 / 卸载前(防止数据残留)
// 范围: 所有 divination_* localStorage + ds_api_key / vision_api_key / settings + crypto 密钥
function clearAllData() {
  if (!confirm('⚠️ 即将清除所有数据:\n• API Key / 模型配置\n• 历史记录 / 反馈\n• 缓存 / AB 测试\n• 加密密钥\n\n确定继续?(不可恢复)')) return;
  if (!confirm('再次确认: 清除后需要重新配置 API Key 才能使用 AI 解读')) return;

  try {
    // 列出所有需清除的 key
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('divination_') ||
        k === 'ds_api_key' ||
        k === 'ds_model' ||
        k === 'use_local_model' ||
        k === 'vision_api_key' ||
        k === 'vision_model' ||
        k === 'local_server_ip' ||
        k === 'local_server_port' ||
        k === 'app_version'
      )) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    // 加密密钥
    if (window.Crypto) window.Crypto.clearKey();
    console.log('[clearAllData] 已清除', keysToRemove.length, '个 localStorage key');
    alert('✅ 所有数据已清除,即将重新加载...');
    setTimeout(() => location.reload(), 500);
  } catch (e) {
    console.error('[clearAllData] 失败:', e);
    alert('清除失败: ' + e.message + '\n请手动清除浏览器数据。');
  }
}
window.clearAllData = clearAllData;

// 追问UI：在feedback-bar后追加追问输入框
// v1.4 增强: 1) 累积多轮对话到 ChatSession 2) "新建对话"按钮重置上下文
function addFollowUpUI(domain, contentEl) {
  // 移除旧的追问栏
  contentEl.parentNode.querySelectorAll('.follow-up-bar').forEach(el => el.remove());

  const fu = document.createElement('div');
  fu.className = 'follow-up-bar';
  fu.style.cssText = 'margin-top:0.6rem;padding:0.5rem;background:var(--bg-inner);border-radius:6px;';
  const turnCount = window.ChatSession ? window.ChatSession.size(domain) : 0;
  fu.innerHTML = `
    <div style="display:flex;gap:0.4rem;align-items:center;">
      <input type="text" class="fu-input" placeholder="💬 追问新问题..." style="flex:1;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);padding:0.3rem 0.5rem;border-radius:6px;font-size:0.85rem;">
      <button class="fu-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--accent-gold);padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">追问</button>
      ${turnCount > 0 ? `<button class="fu-new" title="清空对话历史,从头开始" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);padding:0.3rem 0.5rem;border-radius:6px;cursor:pointer;font-size:0.75rem;white-space:nowrap;">🔄 新建对话 (${turnCount})</button>` : ''}
    </div>
  `;

  const input = fu.querySelector('.fu-input');
  const btn = fu.querySelector('.fu-btn');
  const newBtn = fu.querySelector('.fu-new');

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

    if (updaters[domain]) {
      // v1.4: 把上一轮 Q&A 存到 ChatSession
      if (window.ChatSession && saved) {
        window.ChatSession.push(domain, _lastQuestionFor(domain) || '前次问题', saved);
      }
      updaters[domain]();
    } else {
      showToast('该模块暂不支持追问', 'warning');
    }
  });

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (!confirm(`清空当前(${turnCount}轮)对话历史?之前的 Q&A 会被丢弃。`)) return;
      if (window.ChatSession) window.ChatSession.clear(domain);
      // 重新初始化 current*
      if (typeof switchPage === 'function') switchPage('bazi'); // placeholder
      // 直接刷新当前页(简单可靠)
      location.reload();
    });
  }

  const fb = contentEl.parentNode.querySelector('.feedback-bar');
  if (fb && fb.nextSibling) {
    contentEl.parentNode.insertBefore(fu, fb.nextSibling);
  } else if (fb) {
    contentEl.parentNode.appendChild(fu);
  }
}

// v1.4 helper: 记录每个域当前的问题(用于 ChatSession 存上一轮)
const _currentQuestions = {};
function _recordCurrentQuestion(domain, q) {
  _currentQuestions[domain] = q;
}
function _lastQuestionFor(domain) {
  return _currentQuestions[domain];
}
window._recordCurrentQuestion = _recordCurrentQuestion;
window._lastQuestionFor = _lastQuestionFor;

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
    } catch(e) { console.warn('[LocalServerDiscovery] ICE candidate 监听失败:', e); }
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
  statusEl.textContent = '正在获取本机IP...';
  statusEl.style.color = 'var(--text-muted)';

  // 步骤1: 用WebRTC获取本机局域网IP
  let myIp = null;
  let webrtcFailed = false;
  try {
    const pc = new RTCPeerConnection({iceServers: []});
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
          // ICE gathering complete
          pc.close();
          resolve();
        }
      };
      setTimeout(() => { pc.close(); resolve(); }, 2000);
    });
    if (!myIp) webrtcFailed = true;
  } catch(e) {
    webrtcFailed = true;
    console.warn('[LocalServerDiscovery] WebRTC 不可用:', e.message);
  }

  // 步骤2: 推断网段
  let base = '192.168.1';
  if (myIp) {
    const parts = myIp.split('.');
    base = `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  const scanPort = getLocalServerPort();
  statusEl.textContent = `扫描 ${base}.1~50:${scanPort}...`;

  // 步骤3: 并发扫描（每组20个，避免浏览器限制）
  async function scanBatch(start, end, onError) {
    const promises = [];
    for (let i = start; i <= end; i++) {
      const ip = `${base}.${i}`;
      promises.push(new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `http://${ip}:${scanPort}/v1/models`, true);
        xhr.timeout = 1500;
        xhr.onload = () => resolve(xhr.status === 200 ? ip : null);
        xhr.onerror = () => { onError && onError(ip, 'network'); resolve(null); };
        xhr.ontimeout = () => { onError && onError(ip, 'timeout'); resolve(null); };
        xhr.send();
      }));
    }
    const results = await Promise.all(promises);
    return results.find(ip => ip !== null) || null;
  }

  let foundIp = null;
  // 统计错误信息(给用户更明确提示)
  let errorCount = 0, timeoutCount = 0;

  // 先扫 .1~20
  if (!foundIp) {
    statusEl.textContent = `扫描 ${base}.1~20:${scanPort}...`;
    foundIp = await scanBatch(1, 20, (ip, err) => {
      if (err === 'timeout') timeoutCount++;
      else errorCount++;
    });
  }
  if (foundIp) { done(foundIp); return; }
  statusEl.textContent = `扫描 ${base}.21~50:${scanPort}...`;

  // 再扫 .21~50
  if (!foundIp) {
    foundIp = await scanBatch(21, 50, (ip, err) => {
      if (err === 'timeout') timeoutCount++;
      else errorCount++;
    });
  }
  if (foundIp) { done(foundIp); return; }

  // 最后扫常见fallback网段
  const fallbackBases = myIp ? [] : ['192.168.0', '192.168.1', '10.0.0'];
  for (const fb of fallbackBases) {
    statusEl.textContent = `扫描 ${fb}.1~30:${scanPort}...`;
    const promises = [];
    for (let i = 1; i <= 30; i++) {
      const ip = `${fb}.${i}`;
      promises.push(new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `http://${ip}:${scanPort}/v1/models`, true);
        xhr.timeout = 1500;
        xhr.onload = () => resolve(xhr.status === 200 ? ip : null);
        xhr.onerror = () => { errorCount++; resolve(null); };
        xhr.ontimeout = () => { timeoutCount++; resolve(null); };
        xhr.send();
      }));
    }
    const results = await Promise.all(promises);
    foundIp = results.find(ip => ip !== null);
    if (foundIp) { done(foundIp); return; }
  }

  // 未找到 - 给更明确的诊断信息
  let hint = '';
  if (webrtcFailed) {
    hint = '(WebRTC 取本机IP失败,可能未授权;已尝试 192.168.0/1 + 10.0.0 网段)';
  } else if (timeoutCount > errorCount) {
    hint = `(大量超时,可能不在同WiFi;已扫 ${timeoutCount} 个IP)`;
  } else if (errorCount > 0) {
    hint = `(网络错误,防火墙或路由阻断;已扫 ${errorCount} 个IP)`;
  } else {
    hint = `(已扫所有网段均无响应)`;
  }
  statusEl.textContent = `❌ 未找到 ${hint}。请检查: 1.同WiFi 2.模型已启动(${scanPort}端口) 3.防火墙开放${scanPort} 4.或在电脑上 curl http://localhost:${scanPort}/v1/models 验证`;
  statusEl.style.color = 'var(--accent-red)';

  function done(ip) {
    document.getElementById('localServerIpInput').value = ip;
    localStorage.setItem('local_server_ip', ip);
    document.getElementById('localModelCheck').checked = true;
    localStorage.setItem('use_local_model', '1');
    statusEl.textContent = `✅ 发现服务器: ${ip}:${scanPort}`;
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
  } catch (e) { console.warn('[LocalModelTest] /v1/models 测试失败:', e); }

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

// ========== 知识库按需加载（v1.2.15） ==========
// 38 个 KB 分 9 组：首屏仅加载 core（120KB），切页时按需加载对应领域
const KB_PATHS = {
  bazi: 'kb_data/bazi_kb.json',
  bazi_ext: 'kb_data/bazi_ext_kb.json',
  bazi_geju: 'kb_data/bazi_geju_kb.json',
  bazi_shensha: 'kb_data/bazi_shensha_kb.json',
  bazi_tiaohou: 'kb_data/bazi_tiaohou_kb.json',
  gua: 'kb_data/gua_kb.json',
  liuyao_ext: 'kb_data/liuyao_ext_kb.json',
  qimen: 'kb_data/qimen_kb.json',
  qimen_ext: 'kb_data/qimen_ext_kb.json',
  ziwei: 'kb_data/ziwei_kb.json',
  ziwei_ext: 'kb_data/ziwei_ext_kb.json',
  ziwei_ext2: 'kb_data/ziwei_ext2_kb.json',
  nihai_xia: 'kb_data/nihai_xia_kb.json',
  nihai_xia_ext: 'kb_data/nihai_xia_ext_kb.json',
  shouxiang: 'kb_data/shouxiang_kb.json',
  xingshi: 'kb_data/xingshi_kb.json',
  xingshi_ext: 'kb_data/xingshi_ext_kb.json',
  ziwei_fuxing: 'kb_data/ziwei_fuxing_kb.json',
  ziwei_daxian: 'kb_data/ziwei_daxian_kb.json',
  ziwei_geju: 'kb_data/ziwei_geju_kb.json',
  qimen_xingmen: 'kb_data/qimen_xingmen_kb.json',
  qimen_geju: 'kb_data/qimen_geju_kb.json',
  qimen_zhanji: 'kb_data/qimen_zhanji_kb.json',
  liuyao_liushen: 'kb_data/liuyao_liushen_kb.json',
  liuyao_xunkong: 'kb_data/liuyao_xunkong_kb.json',
  liuyao_jintui: 'kb_data/liuyao_jintui_kb.json',
  guxiang: 'kb_data/guxiang_kb.json',
  shengxiang: 'kb_data/shengxiang_kb.json',
  qise: 'kb_data/qise_kb.json',
  buddhism_mantra: 'kb_data/buddhism_mantra_kb.json',
  buddhism_divine: 'kb_data/buddhism_divine_kb.json',
  daoism_fuzhou: 'kb_data/daoism_fuzhou_kb.json',
  daoism_zhoushu: 'kb_data/daoism_zhoushu_kb.json',
  daoism_shoujue: 'kb_data/daoism_shoujue_kb.json',
  fengshui_ext: 'kb_data/fengshui_ext_kb.json',
  zeri_ext: 'kb_data/zeri_ext_kb.json',
  meihua_ext: 'kb_data/meihua_ext_kb.json',
  mianxiang_ext: 'kb_data/mianxiang_ext_kb.json',
  daoism_jiuhuo: 'kb_data/daoism_jiuhuo_kb.json',
  bazi_dayun: 'kb_data/bazi_dayun_kb.json',
  ziwei_gongwei: 'kb_data/ziwei_gongwei_kb.json',
  shouxiang_wenli: 'kb_data/shouxiang_wenli_kb.json',
  wannianli: 'kb_data/wannianli_kb.json',
  liuyao_najia: 'kb_data/liuyao_najia_kb.json',
  fengshui_base: 'kb_data/fengshui_base_kb.json',
  xingshi_cases: 'kb_data/xingshi_cases_kb.json',
  mianxiang_qise: 'kb_data/mianxiang_qise_kb.json',
  meihua_lei_xiang: 'kb_data/meihua_lei_xiang_kb.json',
  daoism_zhaijiao: 'kb_data/daoism_zhaijiao_kb.json',
  ziwei_daxian2: 'kb_data/ziwei_daxian2_kb.json',
  bazi_shensha2: 'kb_data/bazi_shensha2_kb.json',
  qimen_paipan: 'kb_data/qimen_paipan_kb.json',
  liuyao_cases: 'kb_data/liuyao_cases_kb.json',
  ziwei_zuhe: 'kb_data/ziwei_zuhe_kb.json',
  bazi_shishen: 'kb_data/bazi_shishen_kb.json',
  fengshui_luopan: 'kb_data/fengshui_luopan_kb.json',
  zeri_jixiong: 'kb_data/zeri_jixiong_kb.json',
  mianxiang_qise2: 'kb_data/mianxiang_qise2_kb.json',
  xingshi_cases: 'kb_data/xingshi_cases_kb.json',
  liuyao_liuqin: 'kb_data/liuyao_liuqin_kb.json',
  qimen_yongshen: 'kb_data/qimen_yongshen_kb.json',
  ziwei_sihua: 'kb_data/ziwei_sihua_kb.json',
  bazi_hehun: 'kb_data/bazi_hehun_kb.json',
  // v1.3.2 交叉模块 KB
  bazi_ziwei_hecan: 'kb_data/bazi_ziwei_hecan_kb.json',
  qimen_fengshui_jiehe: 'kb_data/qimen_fengshui_jiehe_kb.json',
  liuyao_meihua_hucan: 'kb_data/liuyao_meihua_hucan_kb.json'
};

// KB 分组：core 必加载，其余按页面/AI 调用按需加载
const KB_GROUPS = {
  core: ['nihai_xia', 'nihai_xia_ext'],
  bazi: ['bazi', 'bazi_ext', 'bazi_geju', 'bazi_shensha', 'bazi_shensha2', 'bazi_tiaohou', 'bazi_dayun', 'bazi_shishen', 'bazi_hehun', 'wannianli'],
  ziwei: ['ziwei', 'ziwei_ext', 'ziwei_ext2', 'ziwei_daxian', 'ziwei_daxian2', 'ziwei_fuxing', 'ziwei_geju', 'ziwei_gongwei', 'ziwei_zuhe', 'ziwei_sihua', 'wannianli'],
  liuyao: ['gua', 'liuyao_ext', 'liuyao_liushen', 'liuyao_xunkong', 'liuyao_jintui', 'liuyao_najia', 'liuyao_cases', 'liuyao_liuqin', 'wannianli'],
  qimen: ['qimen', 'qimen_ext', 'qimen_geju', 'qimen_xingmen', 'qimen_zhanji', 'qimen_paipan', 'qimen_yongshen', 'wannianli'],
  fengshui: ['fengshui_ext', 'fengshui_base', 'fengshui_luopan', 'zeri_ext', 'zeri_jixiong', 'meihua_ext', 'meihua_lei_xiang', 'mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2'],
  xingshi: ['xingshi', 'xingshi_ext', 'xingshi_cases'],
  daofobuddhism: ['daoism_fuzhou', 'daoism_zhoushu', 'daoism_shoujue', 'daoism_zhaijiao', 'buddhism_mantra', 'buddhism_divine', 'daoism_jiuhuo']
};

// v1.3.0 KB 3 级权重（核心/主/扩）
// primary：模块核心（必加载，3-4个）
// extended：模块扩展（关键词触发，按需加载）
const KB_TIERS = {
  primary: {
    bazi: ['bazi', 'bazi_ext', 'bazi_shensha'],
    ziwei: ['ziwei', 'ziwei_ext', 'ziwei_gongwei'],
    liuyao: ['gua', 'liuyao_ext', 'liuyao_liushen'],
    qimen: ['qimen', 'qimen_ext', 'qimen_xingmen'],
    fengshui: ['fengshui_ext', 'fengshui_base'],
    shouxiang: ['shouxiang', 'guxiang'],
    xingshi: ['xingshi', 'xingshi_ext'],
    daofobuddhism: ['daoism_fuzhou', 'daoism_zhoushu', 'daoism_shoujue', 'buddhism_mantra', 'buddhism_divine'],
    cross: ['bazi', 'ziwei', 'liuyao', 'qimen', 'nihai_xia']
  },
  extended: {
    bazi: ['bazi_geju', 'bazi_tiaohou', 'bazi_dayun', 'bazi_shishen', 'bazi_shensha2', 'bazi_hehun', 'bazi_ziwei_hecan', 'wannianli'],
    ziwei: ['ziwei_ext2', 'ziwei_daxian', 'ziwei_daxian2', 'ziwei_fuxing', 'ziwei_geju', 'ziwei_zuhe', 'ziwei_sihua', 'wannianli'],
    liuyao: ['liuyao_xunkong', 'liuyao_jintui', 'liuyao_najia', 'liuyao_cases', 'liuyao_liuqin', 'liuyao_meihua_hucan', 'wannianli'],
    qimen: ['qimen_geju', 'qimen_zhanji', 'qimen_paipan', 'qimen_yongshen', 'wannianli'],
    fengshui: ['fengshui_luopan', 'zeri_ext', 'zeri_jixiong', 'meihua_ext', 'meihua_lei_xiang', 'mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2', 'qimen_fengshui_jiehe'],
    shouxiang: ['shengxiang', 'qise', 'shouxiang_wenli'],
    xingshi: ['xingshi_cases'],
    daofobuddhism: ['daoism_zhaijiao', 'daoism_jiuhuo']
  }
};

// v1.3.0 关键词 → extended KB 触发规则
// 用户问题含关键词 → 加载对应 extended KB
const KB_TRIGGER_RULES = {
  bazi: [
    { re: /格局|成败|用神|喜忌|身强|身弱|从格/, libs: ['bazi_geju'] },
    { re: /大运|十年|流年|岁运|交运|起运/, libs: ['bazi_tiaohou', 'bazi_dayun'] },
    { re: /十神|比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印/, libs: ['bazi_shishen'] },
    { re: /神煞|将星|学堂|词馆|文昌贵人|禄神|金舆/, libs: ['bazi_shensha2'] },
    { re: /合婚|配对|生肖|婚姻|配偶/, libs: ['bazi_hehun'] },
    { re: /紫微|合参|双术|两术同参|紫白|命理与紫微/, libs: ['bazi_ziwei_hecan'] }
  ],
  ziwei: [
    { re: /宫位|命宫|兄弟|夫妻|子女|财帛|疾厄|迁移|交友|官禄|田宅|福德|父母|身宫/, libs: ['ziwei_gongwei'] },
    { re: /大限|十年大运|流年|太岁|/, libs: ['ziwei_daxian', 'ziwei_daxian2'] },
    { re: /四化|化禄|化权|化科|化忌|飞化|自化/, libs: ['ziwei_fuxing', 'ziwei_sihua'] },
    { re: /格局|杀破狼|机月同梁|巨日同昌|紫府同宫/, libs: ['ziwei_geju', 'ziwei_zuhe'] },
    { re: /庙旺|亮度|落陷/, libs: ['ziwei_ext2'] },
    { re: /八字|合参|双术|命理与紫微|紫白/, libs: ['bazi_ziwei_hecan'] }
  ],
  liuyao: [
    { re: /纳甲|装卦|六亲|六神|伏神|飞神|世应/, libs: ['liuyao_najia', 'liuyao_liuqin'] },
    { re: /旬空|月破|出空|填实|暗动|日破|冲空/, libs: ['liuyao_xunkong'] },
    { re: /进神|退神|反吟|伏吟|游魂|归魂|独发|独静|三合/, libs: ['liuyao_jintui'] },
    { re: /实例|案例|实战|占卜|求测/, libs: ['liuyao_cases'] },
    { re: /梅花|互参|双术|两术同参|六爻梅花|体用/, libs: ['liuyao_meihua_hucan'] }
  ],
  qimen: [
    { re: /排盘|地盘|天盘|值符|值使|阳遁|阴遁|定局/, libs: ['qimen_paipan'] },
    { re: /格局|奇门格局|伏吟|反吟|悖格|击刑/, libs: ['qimen_geju'] },
    { re: /实战|案例|占断|奇门断事/, libs: ['qimen_zhanji'] },
    { re: /用神|选神|取用|判断/, libs: ['qimen_yongshen'] },
    { re: /风水|结合|布局|择日|五黄/, libs: ['qimen_fengshui_jiehe'] }
  ],
  fengshui: [
    { re: /罗盘|24山|三元九运|地盘|/, libs: ['fengshui_luopan'] },
    { re: /择日|黄道|建除|吉日|良辰|/, libs: ['zeri_ext', 'zeri_jixiong'] },
    { re: /梅花|万物类象|体用|起卦|/, libs: ['meihua_ext', 'meihua_lei_xiang'] },
    { re: /气色|面相|印堂|/, libs: ['mianxiang_ext', 'mianxiang_qise', 'mianxiang_qise2'] },
    { re: /奇门|结合|值符|八门|互参|奇门风水/, libs: ['qimen_fengshui_jiehe'] }
  ],
  shouxiang: [
    { re: /丘|手指|指型|掌型|掌丘|/, libs: ['shengxiang', 'qise'] },
    { re: /掌纹|主线|智慧线|感情线|生命线|事业线|太阳线|/, libs: ['shouxiang_wenli'] }
  ],
  xingshi: [
    { re: /案例|名人|改名|取名|实际/, libs: ['xingshi_cases'] }
  ],
  daofobuddhism: [
    { re: /科仪|斋醮|道场|法事|超度|开光|/, libs: ['daoism_zhaijiao'] },
    { re: /化解|噩梦|失眠|破财|太岁|压床|场景/, libs: ['daoism_jiuhuo'] }
  ]
};

// 页面 → 预加载 KB 组的映射（switchPage 触发）
const PAGE_KB_GROUPS = {
  bazi: ['bazi'],
  ziwei: ['ziwei'],
  liuyao: ['liuyao'],
  qimen: ['qimen'],
  shouxiang: ['shouxiang'],
  xingshi: ['xingshi'],
  fengshui: ['fengshui'],
  daofobuddhism: ['daofobuddhism'],  // v1.2.17 化解页
  cross: ['bazi', 'ziwei', 'liuyao']  // 三术同参需 3 组
};

const _loadedKBGroups = new Set();
let _kb = {};
let _bundleCache = {};   // v2.0.2: bundle → 已 fetch 的数据,避免重复 fetch
let _bundleIndex = null; // v2.0.2: key → bundle 映射
let _bundleIndexPromise = null;

// v2.0.2: 加载 bundle index (一次,后续复用)
function _loadBundleIndex() {
  if (_bundleIndex) return Promise.resolve(_bundleIndex);
  if (_bundleIndexPromise) return _bundleIndexPromise;
  _bundleIndexPromise = (async () => {
    try {
      const r = await fetch('kb_data/_bundles/_index.json');
      if (!r.ok) {
        console.warn('[KB] bundle index 加载失败,降级逐个 fetch');
        _bundleIndex = {};
        return _bundleIndex;
      }
      _bundleIndex = await r.json();
      return _bundleIndex;
    } catch (e) {
      console.warn('[KB] bundle index 加载异常:', e.message);
      _bundleIndex = {};
      return _bundleIndex;
    }
  })();
  return _bundleIndexPromise;
}

// 内部：按 key 列表加载（跳过已加载的）
// v2.0.2: 先用 bundle index 合并 key → bundle,再并发拉所有需要的 bundle
async function _loadKBByKeys(keys) {
  const toLoad = keys.filter(k => !_kb[k] && KB_PATHS[k]);
  if (toLoad.length === 0) return;

  // 取 bundle index(若失败则降级逐个 fetch)
  const idx = await _loadBundleIndex();
  const useBundle = Object.keys(idx).length > 0;

  if (useBundle) {
    // 1) 找 toLoad 中每个 key 在哪个 bundle
    const bundleToKeys = {};
    for (const k of toLoad) {
      const bundle = idx[k];
      if (bundle) {
        if (!bundleToKeys[bundle]) bundleToKeys[bundle] = [];
        bundleToKeys[bundle].push(k);
      } else {
        // 索引没有 → 逐个 fetch(罕见:新增 KB 未打包)
        bundleToKeys[`__single__${k}`] = [k];
      }
    }
    // 2) 拉所有需要的 bundle
    const fetchPromises = Object.entries(bundleToKeys).map(async ([bundle, kList]) => {
      if (bundle.startsWith('__single__')) {
        // 单文件 fallback
        const k = kList[0];
        try {
          const r = await fetch(KB_PATHS[k]);
          if (r.ok) return [k, await r.json()];
        } catch {}
        return [k, {}];
      }
      if (!_bundleCache[bundle]) {
        try {
          const r = await fetch(`kb_data/_bundles/${bundle}`);
          if (r.ok) _bundleCache[bundle] = await r.json();
          else _bundleCache[bundle] = {};
        } catch { _bundleCache[bundle] = {}; }
      }
      const data = _bundleCache[bundle];
      const out = {};
      for (const k of kList) {
        if (data[k] !== undefined) out[k] = data[k];
      }
      return kList.map(k => [k, out[k] || {}]);
    });
    const results = await Promise.all(fetchPromises);
    const flat = results.flat();
    Object.assign(_kb, Object.fromEntries(flat));
  } else {
    // 降级: 逐个 fetch (v1.x 行为)
    const entries = await Promise.all(
      toLoad.map(async k => {
        try {
          const r = await fetch(KB_PATHS[k]);
          if (!r.ok) return [k, {}];
          return [k, await r.json()];
        } catch { return [k, {}]; }
      })
    );
    Object.assign(_kb, Object.fromEntries(entries));
  }
}

// 加载 core 组（首屏必调）
async function ensureCoreKB() {
  if (_loadedKBGroups.has('core')) return;
  await _loadKBByKeys(KB_GROUPS.core);
  _loadedKBGroups.add('core');
}

// 加载指定组（按需）
async function loadKBGroup(groupName) {
  if (_loadedKBGroups.has(groupName)) return;
  const keys = KB_GROUPS[groupName];
  if (!keys) return;
  await _loadKBByKeys(keys);
  _loadedKBGroups.add(groupName);
}

// 加载多组（用于三术同参等）
async function loadKBGroups(groups) {
  await Promise.all(groups.map(g => loadKBGroup(g)));
}

// ========== v1.3.0 KB 3 级权重加载 ==========
// 加载 domain 的 primary KB（模块核心）
async function loadPrimaryKbs(domain) {
  const keys = KB_TIERS.primary[domain] || [];
  await _loadKBByKeys(keys);
}

// 按用户问题加载 extended KB（关键词触发）
async function loadExtendedKbsByQuestion(domain, question) {
  if (!question) return;
  const rules = KB_TRIGGER_RULES[domain] || [];
  const libs = new Set();
  for (const rule of rules) {
    if (rule.re.test(String(question))) {
      for (const k of rule.libs) libs.add(k);
    }
  }
  if (libs.size === 0) return;
  await _loadKBByKeys(Array.from(libs));
}

// 综合加载：primary 必加载 + extended 按问题触发
async function loadKbsForQuestion(domain, question) {
  await loadPrimaryKbs(domain);
  await loadExtendedKbsByQuestion(domain, question);
}

// 返回 domain primary KB 的注入字符串（自动含倪海厦学派基础）
function kbPrimary(domain) {
  let s = '';
  // 倪海厦学派是所有模块的理论基础
  s += kbNihaiXia();
  // domain 专属 primary KB
  const keys = KB_TIERS.primary[domain] || [];
  for (const k of keys) {
    const fn = window['kb_' + k.charAt(0).toUpperCase() + k.slice(1).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())];
    if (typeof fn === 'function') s += fn();
  }
  return s;
}

// 返回 domain extended KB 按问题触发的注入字符串
function kbExtended(domain, question) {
  if (!question) return '';
  const rules = KB_TRIGGER_RULES[domain] || [];
  const libs = new Set();
  for (const rule of rules) {
    if (rule.re.test(String(question))) {
      for (const k of rule.libs) libs.add(k);
    }
  }
  if (libs.size === 0) return '';
  let s = '\n\n【扩展知识库·按问题关键词加载】';
  for (const k of libs) {
    const fn = window['kb_' + k.charAt(0).toUpperCase() + k.slice(1).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())];
    if (typeof fn === 'function') s += fn();
  }
  return s;
}

// 向后兼容：原 ensureKB 调用 → 等同于 ensureCoreKB（保持 API 兼容）
async function ensureKB() {
  await ensureCoreKB();
}

var WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水',
             '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };

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
  s += kbBaziDayun();
  s += kbWannianli();
  s += kbBaziShensha2();
  s += kbBaziShishen();
  s += kbBaziHehun();
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
  s += kbLiuyaoNajia();
  s += kbWannianli();
  s += kbLiuyaoCases();
  s += kbLiuyaoLiuqin();
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
  s += kbWannianli();
  s += kbQimenPaipan();
  s += kbQimenYongshen();
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
  s += kbShouxiangWenli();
  return s;
}

function kbZiwei(chart) {
  const k = _kb?.ziwei || {};
  const mainStars = chart.mingGong?.stars?.filter(s => s.type === 'main').map(s => s.name) || [];
  let s = '\n\n【知识库参考】';
  for (const star of mainStars) { if (k.main_stars?.[star]) s += `\n· ${star}：${k.main_stars[star]}`; }
  for (const [, v] of Object.entries(chart.siHua || {})) { if (k.si_hua?.[v]) s += `\n· ${v}：${k.si_hua[v]}`; }
  if (k.palaces?.[chart.mingGong?.name]) s += `\n· ${chart.mingGong.name}：${k.palaces[chart.mingGong.name]}`;
  s += kbZiweiGongwei();
  s += kbWannianli();
  s += kbZiweiDaxian2();
  s += kbZiweiZuhe();
  s += kbZiweiSihua();
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

function kbLiuyaoLiushen() {
  const k = _kb?.liuyao_liushen || {};
  let s = '\n\n【扩展知识库·六爻六神】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}，${item.nature}）：${item.content}`;
      if (item.yao_effect) s += ` 临爻：${item.yao_effect}`;
      if (item.combo) s += ` 组合：${item.combo}`;
      if (item.usage) s += ` 用途：${item.usage}`;
    }
  }
  return s;
}

function kbLiuyaoXunkong() {
  const k = _kb?.liuyao_xunkong || {};
  let s = '\n\n【扩展知识库·六爻旬空月破】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.method) s += ` 方法：${item.method}`;
      if (item.check) s += ` 查法：${item.check}`;
    }
  }
  return s;
}

function kbLiuyaoJintui() {
  const k = _kb?.liuyao_jintui || {};
  let s = '\n\n【扩展知识库·六爻进神退神反吟伏吟】';
  if (k.entries) {
    const items = k.entries.slice(0, 15);
    for (const item of items) {
      s += `\n· ${item.title}（${item.category}）：${item.content}`;
      if (item.detail) s += ` 详情：${item.detail}`;
      if (item.effect) s += ` 效应：${item.effect}`;
      if (item.method) s += ` 方法：${item.method}`;
      if (item.check) s += ` 查法：${item.check}`;
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
  s += kbMeihuaLeiXiang();
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

function kbGuxiang() {
  const k = _kb?.guxiang;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·骨相学】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbShengxiang() {
  const k = _kb?.shengxiang;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·声相与行相】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbQise() {
  const k = _kb?.qise;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·气色流年】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  s += kbMianxiangQise();
  s += kbMianxiangQise2();
  return s;
}

function kbBuddhismMantra() {
  const k = _kb?.buddhism_mantra;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·佛教经典咒语】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

function kbBuddhismDivine() {
  const k = _kb?.buddhism_divine;
  if (!k?.entries) return '';
  let s = '\n\n【知识库·佛教占卜法门】';
  for (const e of k.entries.slice(0, 15)) {
    s += `\n· ${e.title}：${e.content}`;
  }
  return s;
}

// ========== 道教知识库注入（v1.2.14 接入） ==========
function kbDaoismFuzhou() {
  const k = _kb?.daoism_fuzhou;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教符咒】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.function) s += ` 作用：${item.function}`;
    if (item.target) s += ` 适用：${item.target}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismZhoushu() {
  const k = _kb?.daoism_zhoushu;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教咒语】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismShoujue() {
  const k = _kb?.daoism_shoujue;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教手诀】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n· ${item.title}（${item.category}）：${item.content}`;
    if (item.usage) s += ` 用法：${item.usage}`;
  }
  return s;
}

function kbDaoismJiuhuo() {
  const k = _kb?.daoism_jiuhuo;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教化解场景库（30场景）】';
  for (const item of k.entries) {
    s += `\n【${item.title}】\n  场景：${item.scenario || ''}\n  组合：${item.combination || ''}\n  用法：${item.usage || ''}\n  时机：${item.timing || ''}`;
  }
  return s;
}

function kbBaziDayun() {
  const k = _kb?.bazi_dayun;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字大运流年详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiGongwei() {
  const k = _kb?.ziwei_gongwei;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微十二宫详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbShouxiangWenli() {
  const k = _kb?.shouxiang_wenli;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·手相掌纹详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbWannianli() {
  const k = _kb?.wannianli;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·万年历与节气详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoNajia() {
  const k = _kb?.liuyao_najia;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻纳甲装卦详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbFengshuiBase() {
  const k = _kb?.fengshui_base;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·风水基础理论详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbXingshiCases() {
  const k = _kb?.xingshi_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·姓名学实战案例库】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbMianxiangQise() {
  const k = _kb?.mianxiang_qise;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·面相气色详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbMeihuaLeiXiang() {
  const k = _kb?.meihua_lei_xiang;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·梅花易数万物类象】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbDaoismZhaijiao() {
  const k = _kb?.daoism_zhaijiao;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·道教斋醮科仪详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiDaxian2() {
  const k = _kb?.ziwei_daxian2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数大限流年详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziShensha2() {
  const k = _kb?.bazi_shensha2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字神煞详解（扩展）】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbQimenPaipan() {
  const k = _kb?.qimen_paipan;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·奇门遁甲排盘详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoCases() {
  const k = _kb?.liuyao_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻断卦实例】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiZuhe() {
  const k = _kb?.ziwei_zuhe;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数星曜组合详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziShishen() {
  const k = _kb?.bazi_shishen;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字十神关系详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbFengshuiLuopan() {
  const k = _kb?.fengshui_luopan;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·风水罗盘详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZeriJixiong() {
  // v1.2.26 合并输出：择日通书扩展 + 择日吉神凶煞
  const k1 = _kb?.zeri_ext;
  const k2 = _kb?.zeri_jixiong;
  if (!k1?.entries && !k2?.entries) return '';
  let s = '\n\n【扩展知识库·择日通书+吉神凶煞（双库合并）】';
  if (k1?.entries) {
    s += '\n\n--- 择日通书扩展 ---';
    for (const item of k1.entries.slice(0, 12)) {
      s += `\n【${item.title}】${item.content}`;
    }
  }
  if (k2?.entries) {
    s += '\n\n--- 择日吉神凶煞 ---';
    for (const item of k2.entries.slice(0, 12)) {
      s += `\n【${item.title}】${item.content}`;
    }
  }
  return s;
}

function kbMianxiangQise2() {
  const k = _kb?.mianxiang_qise2;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·面相气色详解（扩展）】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbXingshiCases() {
  const k = _kb?.xingshi_cases;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·姓名学案例】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbLiuyaoLiuqin() {
  const k = _kb?.liuyao_liuqin;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·六爻六亲详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbQimenYongshen() {
  const k = _kb?.qimen_yongshen;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·奇门遁甲用神详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbZiweiSihua() {
  const k = _kb?.ziwei_sihua;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·紫微斗数四化飞星详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

function kbBaziHehun() {
  const k = _kb?.bazi_hehun;
  if (!k?.entries) return '';
  let s = '\n\n【扩展知识库·八字合婚详解】';
  for (const item of k.entries.slice(0, 15)) {
    s += `\n【${item.title}】${item.content}`;
  }
  return s;
}

// ========== 道佛知识库按需注入（v1.2.14） ==========
// 根据用户问题关键词动态加载道佛知识库，避免无关 token 浪费
// 同时支持负向关键词触发：用户问"病/灾/破财/失意"等时预载化解知识
function kbDaoismBuddhismOnDemand(question) {
  if (!question) return '';
  const q = String(question);
  // 关键词规则：每条匹配后注入对应知识库
  const triggers = [
    // 化解类：符咒+咒语
    { re: /化解|驱邪|镇宅|阴|邪气|噩梦|鬼|冲撞|太岁符|平安符|化煞|辟邪|护身符|流年不利|犯太岁|太岁/, libs: ['daoism_fuzhou', 'daoism_zhoushu'] },
    // 诵经念佛类：佛教咒语+道教咒语
    { re: /超度|放生|供养|诵经|念佛|念咒|回向|业障|阴宅|阳宅不安|噩梦|失眠|焦虑/, libs: ['buddhism_mantra', 'daoism_zhoushu'] },
    // 求签抽签类
    { re: /求签|抽签|灵签|观音签|地藏签|菩萨签|佛珠占|佛经占|心诚则灵/, libs: ['buddhism_divine'] },
    // 道场法事类
    { re: /道场|法事|科仪|斋醮|手诀|法印|掐诀|踏罡|步斗/, libs: ['daoism_shoujue', 'daoism_zhaijiao'] },
    // 佛教经典直接提及
    { re: /心经|大悲咒|准提|金刚经|楞严|药师|地藏|往生咒|普门品|观音菩萨|阿弥陀/, libs: ['buddhism_mantra'] },
    // 道教经典直接提及
    { re: /金光神咒|净心咒|净口咒|净身咒|八大神咒|祝香|玄蕴|太上老君|天尊/, libs: ['daoism_zhoushu'] },
    // 负向结果主动求助：注入化解+咒语
    { re: /怎么办|如何化解|怎么解决|有何建议|怎么改善|能化解吗|可破吗/, libs: ['daoism_fuzhou', 'buddhism_mantra'] }
  ];
  const libs = new Set();
  for (const t of triggers) {
    if (t.re.test(q)) for (const lib of t.libs) libs.add(lib);
  }
  if (libs.size === 0) return '';
  let s = '\n\n【道佛化解知识库·按问题关键词加载】';
  if (libs.has('daoism_fuzhou')) s += kbDaoismFuzhou();
  if (libs.has('daoism_zhoushu')) s += kbDaoismZhoushu();
  if (libs.has('daoism_shoujue')) s += kbDaoismShoujue();
  if (libs.has('daoism_zhaijiao')) s += kbDaoismZhaijiao();
  if (libs.has('buddhism_mantra')) s += kbBuddhismMantra();
  if (libs.has('buddhism_divine')) s += kbBuddhismDivine();
  s += '\n\n【化解建议指引】如解读发现负向结论（凶/衰/空破/被克/犯煞/病/灾/破财/失意等），请基于上述知识库在末尾【化解建议】区块给出 1-3 条化解方案（每条含方法、频次、注意事项）。';
  return s;
}

// ========== AI 调用 ==========

/**
 * 读取 ABTest 当前配置,带 fallback(无 active test 时返回默认)。
 * 设计: prompt_v1 (fewshot + chainOfThought, 默认开启) 是基线;
 *        prompt_v2 (量化评分) / rag_v1 (topK=8) / rag_v2 (topK=12) 可叠加。
 * @returns {{ topK:number, maxChars:number, useFewshot:boolean, useChainOfThought:boolean, scoreEnabled:boolean, variant:string|null }}
 */
function getActiveABConfig() {
  const fallback = {
    topK: 10,
    maxChars: 2500,
    useFewshot: true,            // 默认开启 fewshot(对齐 prompt_v1 设计意图)
    useChainOfThought: true,
    scoreEnabled: false,
    variant: null,
  };
  try {
    if (!window.ABTest) return fallback;
    const cfg = window.ABTest.getConfig();
    if (!cfg || !cfg.config) return fallback;

    return {
      topK:       cfg.config.topK       ?? fallback.topK,
      maxChars:   cfg.config.maxChars   ?? fallback.maxChars,
      useFewshot: cfg.config.fewshot    ?? fallback.useFewshot,
      useChainOfThought: cfg.config.chainOfThought ?? fallback.useChainOfThought,
      scoreEnabled: cfg.config.scoreEnabled ?? fallback.scoreEnabled,
      variant:    cfg.variant || null,
    };
  } catch (e) {
    console.warn('[ABConfig] fallback:', e);
    return fallback;
  }
}

// v1.4 流式输出控制: 当前活跃流的 AbortController + 状态指示器
let _currentStreamAbort = null;
let _streamIndicator = null;
function stopCurrentStream() {
  if (_currentStreamAbort) {
    _currentStreamAbort.abort();
    _currentStreamAbort = null;
    console.log('[Stream] 已停止');
    if (typeof showToast === 'function') showToast('已停止生成', 'warning');
  }
  hideStreamIndicator();
}
window.stopCurrentStream = stopCurrentStream;

function showStreamIndicator() {
  if (_streamIndicator) return;
  _streamIndicator = document.createElement('div');
  _streamIndicator.id = 'streamIndicator';
  _streamIndicator.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(20,18,16,0.95);color:var(--accent-gold);padding:0.5rem 1rem;border-radius:20px;border:1px solid var(--accent-gold);font-size:0.8rem;display:flex;align-items:center;gap:0.6rem;box-shadow:0 2px 12px rgba(0,0,0,0.5);';
  _streamIndicator.innerHTML = `
    <span style="display:inline-flex;gap:2px;">
      <span style="width:6px;height:6px;background:var(--accent-gold);border-radius:50%;animation:streamDot 1.4s infinite;"></span>
      <span style="width:6px;height:6px;background:var(--accent-gold);border-radius:50%;animation:streamDot 1.4s 0.2s infinite;"></span>
      <span style="width:6px;height:6px;background:var(--accent-gold);border-radius:50%;animation:streamDot 1.4s 0.4s infinite;"></span>
    </span>
    <span>正在生成...</span>
    <button onclick="stopCurrentStream()" style="background:var(--accent-red);color:#fff;border:none;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.7rem;cursor:pointer;">⏹ 停止</button>
  `;
  document.body.appendChild(_streamIndicator);
  // 注入 CSS 动画
  if (!document.getElementById('streamIndicatorCSS')) {
    const s = document.createElement('style');
    s.id = 'streamIndicatorCSS';
    s.textContent = '@keyframes streamDot{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}';
    document.head.appendChild(s);
  }
}

function hideStreamIndicator() {
  if (_streamIndicator) {
    _streamIndicator.remove();
    _streamIndicator = null;
  }
}

async function callDeepSeek(prompt, system, onChunk, opts = {}) {
  const { temperature = 0.15, model: optModel, signal: externalSignal } = opts;
  const useLocal = localStorage.getItem('use_local_model') === '1';
  // v1.4 流式控制: 用外部 signal (如果有) + 内部 timeout signal
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
      // v1.4 流式控制: 外部停止时也 abort
      if (externalAbort) externalAbort.addEventListener('abort', () => ctrl.abort());
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
  // v1.3.1 安全修复: 不再 fallback 到硬编码 DEFAULT_API_KEY (已设为空)
  if (!key) throw new Error('请先在设置页配置 DeepSeek API Key,或启动本地模型 (LM Studio / Ollama)');
  const model = optModel || localStorage.getItem('ds_model') || 'deepseek-chat';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLOUD_TIMEOUT);
  // v1.4 流式控制: 外部停止时也 abort
  if (externalAbort) externalAbort.addEventListener('abort', () => ctrl.abort());
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








function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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


// ========== v1.3.3 智能问事（按问题自动路由模块） ==========
// 按关键词判断该走哪个术数，并预填问题跳转
function smartRoute() {
  const q = document.getElementById('smartQuestionInput')?.value?.trim();
  if (!q) { showToast('请输入您的问题', 'error'); return; }

  // 关键词 → 模块映射（含二级关键词细判）
  const routeRules = [
    { mod: 'fengshui', page: 'fengshui', score: 0,
      re: /风水|户型|住宅|罗盘|玄空|八宅|明堂|朝向|三煞|五黄|化煞|财位|桃花位|办公室风水|住宅风水|店面|店铺/ },
    { mod: 'fengshui', page: 'fengshui', score: 1,
      re: /择日|吉日|黄道|建除|良辰|开业|入伙|搬家|结婚日|动土/ },
    { mod: 'xingshi', page: 'xingshi', score: 0,
      re: /起名|改名|姓名|名字|五格|三才|公司名|商标|品牌/ },
    { mod: 'shouxiang', page: 'shouxiang', score: 0,
      re: /手相|掌纹|手掌|指纹|生命线|智慧线|感情线|事业线|丘/ },
    { mod: 'liuyao', page: 'liuyao', score: 0,
      re: /六爻|起卦|摇钱|占卜|占事|测一测|灵签|签文|世应|动爻|卦象/ },
    { mod: 'liuyao', page: 'liuyao', score: 1,
      re: /失物|找东西|找不到|丢了/ },
    { mod: 'qimen', page: 'qimen', score: 0,
      re: /奇门|遁甲|择日|起局|值符|值使|八门|九星/ },
    { mod: 'qimen', page: 'qimen', score: 1,
      re: /预测|决策|谈判|签约|出行/ },
    { mod: 'ziwei', page: 'ziwei', score: 0,
      re: /紫微|命宫|主星|四化|化禄|化忌|紫府同宫|杀破狼|机月同梁/ },
    { mod: 'ziwei', page: 'ziwei', score: 1,
      re: /大限|流年|本命年/ },
    { mod: 'bazi', page: 'bazi', score: 1,
      re: /八字|日主|四柱|天干|地支|十神|比肩|劫财|食神|伤官|七杀|正官|偏印|正印/ },
    { mod: 'bazi', page: 'bazi', score: 0,
      re: /事业|工作|财运|婚姻|感情|学业|考试|健康|流年|大运|合婚|配偶|父母|子女|朋友|人际|运势|运气|命/ }
  ];

  // 评分排序
  const scores = {};
  for (const rule of routeRules) {
    if (rule.re.test(q)) {
      scores[rule.mod] = (scores[rule.mod] || 0) + (rule.score === 1 ? 2 : 1);
    }
  }
  // 选最高分
  let bestMod = 'bazi', bestScore = 0;
  for (const [m, s] of Object.entries(scores)) {
    if (s > bestScore) { bestMod = m; bestScore = s; }
  }

  // 特殊场景：化解类/求签类→ 跳转化解页
  if (/化解|噩梦|失眠|太岁|破财|压床|求签|灵签|抽签/.test(q)) {
    bestMod = 'daofobuddhism';
  }

  const pageMap = {
    bazi: { page: 'bazi', qField: 'baziQuestion' },
    ziwei: { page: 'ziwei', qField: 'zwQuestion' },
    liuyao: { page: 'liuyao', qField: 'lyQuestion' },
    qimen: { page: 'qimen', qField: 'qmQuestion' },
    fengshui: { page: 'fengshui', qField: 'fsQuestion' },
    shouxiang: { page: 'shouxiang', qField: null },
    xingshi: { page: 'xingshi', qField: 'xsQuestion' },
    daofobuddhism: { page: 'daofobuddhism', qField: 'aiHuaJieInput' }
  };
  const target = pageMap[bestMod] || pageMap.bazi;

  // 显示推荐结果
  const modNames = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门', fengshui: '风水', shouxiang: '手相', xingshi: '姓名学', daofobuddhism: '化解页' };
  const modIcons = { bazi: '📅', ziwei: '⭐', liuyao: '☯', qimen: '🔮', fengshui: '🧭', shouxiang: '✋', xingshi: '👤', daofobuddhism: '🙏' };
  const resultEl = document.getElementById('smartResult');
  const allScores = Object.entries(scores).map(([m, s]) => `${modIcons[m]||''}${modNames[m]||m}=${s}`).join(' ');
  resultEl.innerHTML = `<div style="background:var(--bg-card);padding:0.5rem;border-radius:6px;margin-top:0.4rem;">
    <div style="color:var(--accent-gold);font-weight:bold;">${modIcons[bestMod]||''} 推荐：${modNames[bestMod]||bestMod}</div>
    <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;">评分：${allScores || '无匹配，默认八字'}</div>
  </div>`;

  // 跳转并预填
  switchPage(target.page);
  setTimeout(() => {
    if (target.qField) {
      const el = document.getElementById(target.qField);
      if (el) {
        el.value = q;
        el.focus();
        showToast(`已跳转到${modNames[bestMod]}并预填问题`, 'success');
      } else {
        showToast(`已跳转到${modNames[bestMod]}`, 'success');
      }
    } else {
      showToast(`已跳转到${modNames[bestMod]}（请手动输入问题）`, 'success');
    }
  }, 200);
}
window.smartRoute = smartRoute;

