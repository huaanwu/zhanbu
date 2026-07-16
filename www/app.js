/**
 * AI 占卜大师 - 主应用逻辑 (v2.0)
 * v2.0.1: 从 index.html 拆出 4770 行 inline JS
 * v3.0.5: 拆分到 www/core/ 7 个模块 + 按域 app/*.js
 * 包含: 页面切换、状态管理、8 大流派的 UI 绑定 + AI 解读调用
 *
 * 设计原则:
 *   - 全局函数暴露 window.X = X 以兼容 HTML onclick 处理器
 *   - 不使用 ES module (避免 onclick 失效)
 *   - 按流派/特性分组,后续可拆分为 ui-bazi.js / ui-ziwei.js ...
 */

// ========== 兼容层: HTML onclick 调用,需在所有 IIFE 之前设置 ==========
// core/*.js 已在 app.js 之前加载,这里把 Core.* 重新挂到 window 上以匹配 onclick 属性
// 以及 app/*.js 中的 bare 调用(callDeepSeek/getLocalServerUrl/stripThinking 等)
var switchPage = Core.Router.switchPage;
var showToast = Core.Toast.showToast;
var initDateInputs = Core.Util.initDateInputs;
var selCal = Core.Util.selCal;
var selLeap = Core.Util.selLeap;
var selGender = Core.Util.selGender;
var stopCurrentStream = Core.Stream.stopCurrentStream;
var escapeHtml = Core.Util.escapeHtml;
var safeHTML = Core.Util.safeHTML;
var judgeWangShuai = Core.Util.judgeWangShuai;
var stripThinking = Core.AI.stripThinking;
window.WX = Core.Util.WX;
var callDeepSeek = Core.AI.callDeepSeek;
var readSSE = Core.AI.readSSE;
var getLocalServerUrl = Core.AI.getLocalServerUrl;
var getLocalServerIp = Core.AI.getLocalServerIp;
var getLocalServerPort = Core.AI.getLocalServerPort;

// 知识库入口兼容(core/kb.js 已加载)
window.ensureCoreKB = Core.KB.ensureCoreKB;
window.loadKBGroups = Core.KB.loadKBGroups;
window.loadKBGroup = Core.KB.loadKBGroup;
window.kbPrimary = Core.KB.kbPrimary;
window.kbExtended = Core.KB.kbExtended;
window.kbDaoismBuddhismOnDemand = Core.KB.kbDaoismBuddhismOnDemand;

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

var APP_VERSION = 'v3.0.5';
var APP_BUILD_DATE = '2026-07-07';

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



// ========== 全局状态(已搬到 core/state.js,通过 window.* 引用) ==========

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

// initDateInputs / selCal / selLeap / selGender 已搬到 core/util.js
// 通过顶部 compat shim 在 window 上暴露,保持 HTML onclick 兼容

// ========== 设置 ==========
function loadSettings() {
  const key = localStorage.getItem('ds_api_key') || '';
  const model = localStorage.getItem('ds_model') || 'deepseek-chat';
  const useLocal = localStorage.getItem('use_local_model') === '1';
  const vKey = localStorage.getItem('vision_api_key') || '';
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
  const savedModelName = localStorage.getItem('local_model_name');
  document.getElementById('localModelNameInput').value = savedModelName || 'default';
  updateApiStatus(key);
  // 版本号显示
  const verEl = document.getElementById('versionInfo');
  if (verEl) verEl.textContent = `版本: ${APP_VERSION} (${APP_BUILD_DATE})`;
  
  // 尝试用WebRTC获取本机IP，如果还没保存过则更新显示
  if (!savedIp) {
    // 优先检测本机 Ollama (默认 11434)
    fetch('http://localhost:11434/').then(() => {
      document.getElementById('localServerIpInput').value = 'localhost';
      document.getElementById('localServerPortInput').value = '8082';
    }).catch(() => {
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
    }).catch(() => {});
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
    const localModelName = document.getElementById('localModelNameInput').value.trim() || 'default';
  localStorage.setItem('ds_api_key', key);
  localStorage.setItem('ds_model', model);
  localStorage.setItem('use_local_model', useLocal ? '1' : '0');
  localStorage.setItem('vision_api_key', vKey);
  localStorage.setItem('vision_model', vModel);
  localStorage.setItem('local_server_ip', localIp);
  localStorage.setItem('local_server_port', localPort);
    localStorage.setItem('local_model_name', localModelName);
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

// [MIGRATED] getLocalServerIp/Port/Url → core/ai-service.js (compat shim at top)

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
        xhr.onload = () => resolve(xhr.status === 200 || xhr.status === 502 || xhr.status === 503 ? ip : null);
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
window.autoDiscoverServer = autoDiscoverServer;

// 一键测试本地模型连接
async function testLocalModel() {
  const statusEl = document.getElementById('discoverStatus');
  const ip = (document.getElementById('localServerIpInput')?.value || getLocalServerIp()).replace(/\/$/, '');
  const port = document.getElementById('localServerPortInput')?.value || getLocalServerPort();
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
      document.getElementById('localModelCheck').checked = true;
      saveSettings();
      return;
    }
  } catch (e) { console.warn('[LocalModelTest] /v1/models 测试失败:', e); }

  // 测试2: /v1/chat/completions 直接发一条测试消息
  try {
    const res = await fetch(`http://${ip}:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: (document.getElementById('localModelNameInput')?.value || 'default'), messages: [{role:'user',content:'hi'}], max_tokens: 1 })
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
window.testLocalModel = testLocalModel;

// ========== 知识库按需加载（v1.2.15） ==========
// 38 个 KB 分 9 组：首屏仅加载 core（120KB），切页时按需加载对应领域
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

