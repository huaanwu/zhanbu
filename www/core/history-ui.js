/**
 * 历史记录 + 用户反馈 UI + 追问 + 二次校验 — 从 app.js 拆出
 *
 * 依赖:
 *   - Core.Toast.showToast
 *   - window.History (history.js)
 *   - window.Crypto (crypto.js)
 *   - window.ChatSession (chat.js)
 *   - window.Core.AI.callDeepSeek
 *   - 顶层全局 currentBazi/currentZw/currentLy/currentQm/currentCross/currentFs
 *     和 buildBaziPrompt/buildZiweiPrompt/buildLiuyaoPrompt/buildQimenPrompt/
 *     buildCrossPrompt/buildFengshuiPrompt/doAIBazi/doAIZiwei/doAILiuyao/
 *     doAIQimen/doAICross/doAIFengshui (各 app/*.js)
 *   - 顶层 _followUpPrefix (app.js)
 */
(function () {
  if (typeof window === 'undefined') return;

  const showToast = (msg, type) => window.Core && window.Core.Toast && window.Core.Toast.showToast(msg, type);
  const callDeepSeek = () => window.Core && window.Core.AI && window.Core.AI.callDeepSeek;

  // ===== 保存历史 =====
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
    } catch (e) { console.warn('[history-ui] saveHistory fail:', e); }
  }

  // ===== 用户反馈 UI =====
  function addFeedbackUI(domain, contentEl, outputText, prompt, system) {
    if (contentEl) contentEl.style.display = 'block';
    if (!outputText || outputText.length < 5) {
      if (contentEl) contentEl.textContent = '⚠️ AI 未返回内容（可能被超时/中断）。请检查网络后重试。';
    }

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
    contentEl.parentNode.querySelectorAll('.feedback-bar').forEach(el => el.remove());
    if (contentEl.nextSibling) {
      contentEl.parentNode.insertBefore(div, contentEl.nextSibling);
    } else {
      contentEl.parentNode.appendChild(div);
    }
    setTimeout(() => div.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);

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

    addFollowUpUI(domain, contentEl);
  }

  // ===== 历史记录页面 =====
  var DOMAIN_LABELS = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门', xingshi: '姓名学', cross: '三术同参', fengshui: '风水' };

  function formatHistoryDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function renderHistory() {
    if (!window.History) return;
    const domain = document.getElementById('historyFilterDomain')?.value || 'all';
    const days = document.getElementById('historyFilterDays')?.value || 'all';
    const keyword = document.getElementById('historyFilterKeyword')?.value?.trim() || '';
    const feedback = document.getElementById('historyFilterFeedback')?.value || '';

    window.History.searchDecrypted({ domain, days: days === 'all' ? 'all' : +days, keyword, feedback })
      .then(items => {
        _renderHistoryList(items);
        _renderHistoryStats(items);
      })
      .catch(e => {
        console.warn('[history-ui] renderHistory 解密失败:', e);
        const items = window.History.search({ domain, days: days === 'all' ? 'all' : +days, keyword, feedback });
        _renderHistoryList(items);
        _renderHistoryStats(items);
      });
  }

  function _renderHistoryStats(items) {
    const stats = document.getElementById('historyStats');
    if (!stats) return;
    const s = window.History.stats();
    const fbTotal = s.feedbacks.good + s.feedbacks.partial + s.feedbacks.bad;
    const fbRate = fbTotal > 0 ? Math.round((s.feedbacks.good / fbTotal) * 100) : 0;
    const topDomains = Object.entries(s.domains).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${DOMAIN_LABELS[k] || k} ${v}`).join(' / ') || '无';
    stats.innerHTML = `共 <b>${s.total}</b> 条` + (items.length !== s.total ? ` · 筛选 <b>${items.length}</b>` : '')
      + ` · 反馈率 <b style="color:${fbRate >= 70 ? 'var(--accent-green)' : fbRate >= 40 ? 'var(--accent-gold)' : 'var(--accent-red)'};">${fbRate}%</b>`
      + ` <span style="color:var(--text-muted);">（✓${s.feedbacks.good} ≈${s.feedbacks.partial} ✗${s.feedbacks.bad} ○${s.feedbacks.none}）</span>`
      + `<br><span style="color:var(--text-muted);">常用：${topDomains}</span>`;
  }

  function _renderHistoryList(items) {
    const list = document.getElementById('historyList');
    if (!list) return;
    if (items.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.85rem;">暂无记录</div>';
      return;
    }

    const escapeHtml = window.Core && window.Core.Util && window.Core.Util.escapeHtml;
    const esc = escapeHtml || (s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));

    let html = '';
    for (const item of items.slice(0, 50)) {
      const label = DOMAIN_LABELS[item.domain] || item.domain;
      const fbIcon = item.feedback === 'good' ? '✓' : item.feedback === 'partial' ? '≈' : item.feedback === 'bad' ? '✗' : '○';
      const fbColor = item.feedback === 'good' ? 'var(--accent-green)' : item.feedback === 'partial' ? 'var(--accent-gold)' : item.feedback === 'bad' ? 'var(--accent-red)' : 'var(--text-muted)';
      const isEncrypted = typeof item.output === 'string' && item.output.startsWith('enc:v1:');
      const outputText = isEncrypted ? '⚠️ 解密失败,可能是历史密钥已更换' : (item.output || '');
      const summary = (outputText || '').slice(0, 80).replace(/\n/g, ' ');
      html += `
        <div class="history-item" style="border-bottom:1px solid var(--border);padding:0.6rem 0;"
            data-id="${item.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;cursor:pointer;"
               onclick="toggleHistoryDetail('${item.id}')">
            <div style="flex:1;min-width:0;">
              <span style="display:inline-block;background:var(--bg-inner);color:var(--accent-gold);font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:4px;margin-right:0.3rem;">${label}</span>
              <span style="font-size:0.8rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70vw;display:inline-block;vertical-align:middle;">${esc(item.question || '无问题')}</span>
              <span style="font-size:0.75rem;color:${fbColor};margin-left:0.3rem;">${fbIcon}</span>
            </div>
            <span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;">${formatHistoryDate(item.ts)}</span>
          </div>
          <div class="history-summary" style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;"
               onclick="toggleHistoryDetail('${item.id}')">
            ${esc(summary)}${outputText.length > 80 ? '...' : ''}
          </div>
          <div class="history-detail" id="hd-${item.id}" style="display:none;margin-top:0.5rem;padding:0.5rem;background:var(--bg-inner);border-radius:6px;font-size:0.8rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.6;max-height:40vh;overflow-y:auto;">
            ${esc(outputText)}
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

  async function copyHistoryText(id) {
    if (!window.History) return;
    const items = window.History.load();
    const item = items.find(i => i.id === id);
    if (!item) return;
    const decrypted = await window.History.decryptItem(item);
    const text = `[${DOMAIN_LABELS[decrypted.domain] || decrypted.domain}] ${decrypted.question || ''}\n\n${decrypted.output || ''}`;
    navigator.clipboard.writeText(text).then(() => showToast('已复制', 'success')).catch(() => showToast('复制失败', 'error'));
  }

  async function exportHistoryItem(id) {
    if (!window.History) return;
    const items = window.History.load();
    const item = items.find(i => i.id === id);
    if (!item) return;
    const decrypted = await window.History.decryptItem(item);
    const label = DOMAIN_LABELS[decrypted.domain] || decrypted.domain;
    const date = new Date(decrypted.ts);
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const fbMap = { good: '✓ 准确', partial: '≈ 部分准', bad: '✗ 不准' };
    const fb = fbMap[decrypted.feedback] || '○ 未评';
    const isEncrypted = typeof decrypted.output === 'string' && decrypted.output.startsWith('enc:v1:');
    const outputText = isEncrypted ? '⚠️ 解密失败' : (decrypted.output || '');
    const text = `# 倪海厦占卜·${label}\n\n` +
      `时间：${dateStr}\n` +
      `类型：${label}\n` +
      `问题：${decrypted.question || '（无）'}\n` +
      `信号：${decrypted.signal || ''}\n` +
      `反馈：${fb}\n` +
      `\n--- 解读 ---\n\n${outputText}\n`;
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
  function clearAllData() {
    if (!confirm('⚠️ 即将清除所有数据:\n• API Key / 模型配置\n• 历史记录 / 反馈\n• 缓存 / AB 测试\n• 加密密钥\n\n确定继续?(不可恢复)')) return;
    if (!confirm('再次确认: 清除后需要重新配置 API Key 才能使用 AI 解读')) return;

    try {
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
      if (window.Crypto) window.Crypto.clearKey();
      console.log('[history-ui] clearAllData 已清除', keysToRemove.length, '个 localStorage key');
      alert('✅ 所有数据已清除,即将重新加载...');
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      console.error('[history-ui] clearAllData 失败:', e);
      alert('清除失败: ' + e.message + '\n请手动清除浏览器数据。');
    }
  }

  // ===== 追问 UI =====
  // v1.4 增强: 1) 累积多轮对话到 ChatSession 2) "新建对话"按钮重置上下文
  function addFollowUpUI(domain, contentEl) {
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
        bazi: () => { window.currentBazi.question = q; window.currentBaziPrompt = window.buildBaziPrompt(window.currentBazi); window._followUpPrefix = saved; window.doAIBazi(); },
        ziwei: () => { window.currentZw.question = q; window.currentZwPrompt = window.buildZiweiPrompt(window.currentZw, q); window._followUpPrefix = saved; window.doAIZiwei(); },
        liuyao: () => { window.currentLy.question = q; window.currentLyPrompt = window.buildLiuyaoPrompt(window.currentLy, q); window._followUpPrefix = saved; window.doAILiuyao(); },
        qimen: () => { window.currentQm.question = q; window.currentQmPrompt = window.buildQimenPrompt(window.currentQm, q); window._followUpPrefix = saved; window.doAIQimen(); },
        cross: () => { window.currentCross.question = q; window.currentCrossPrompt = window.buildCrossPrompt(window.currentCross); window._followUpPrefix = saved; window.doAICross(); },
        fengshui: () => { window.currentFs.question = q; window.currentFsPrompt = window.buildFengshuiPrompt(window.currentFs, q); window._followUpPrefix = saved; window.doAIFengshui(); },
      };

      if (updaters[domain]) {
        if (window.ChatSession && saved) {
          window.ChatSession.push(domain, window._lastQuestionFor(domain) || '前次问题', saved);
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

  // ===== 二次校验 =====
  async function doRecheck(domain, contentEl, prompt, system) {
    const statusEl = contentEl.parentNode.querySelector('.fb-status');
    if (statusEl) statusEl.textContent = '二次校验中（切换推理策略）...';

    const aiCall = callDeepSeek();
    if (!aiCall) {
      showToast('AI 服务未加载', 'error');
      return;
    }

    let fullText = '';
    try {
      const text = await aiCall(prompt, system, (delta, full) => {
        fullText = full;
        contentEl.textContent = '\n【二次校验结果】\n\n' + full;
      }, { temperature: 0.7 });

      saveHistory(domain + '_recheck', 'recheck', '二次校验', fullText || text);

      if (statusEl) statusEl.textContent = '✓ 二次校验完成，请对比两次结果';
      showToast('二次校验完成，请对比两次结果差异', 'success');
    } catch (e) {
      if (statusEl) statusEl.textContent = '✗ 二次校验失败: ' + e.message;
      showToast('二次校验失败: ' + e.message, 'error');
    }
  }

  // ===== 相似历史查询 =====
  async function getSimilarHistoryPrompt(domain, signal, question) {
    if (!window.History) return '';
    return await window.History.formatSimilarForPrompt(domain, signal, question, 3);
  }

  // ===== 暴露 =====
  window.Core = window.Core || {};
  window.Core.HistoryUI = {
    saveHistory, addFeedbackUI, renderHistory, toggleHistoryDetail,
    copyHistoryText, exportHistoryItem, deleteHistoryItem,
    clearAllHistory, clearAllData,
    addFollowUpUI, doRecheck, getSimilarHistoryPrompt,
    _recordCurrentQuestion, _lastQuestionFor,
    DOMAIN_LABELS
  };
  // HTML onclick 兼容
  window.saveHistory = saveHistory;
  window.addFeedbackUI = addFeedbackUI;
  window.renderHistory = renderHistory;
  window.toggleHistoryDetail = toggleHistoryDetail;
  window.copyHistoryText = copyHistoryText;
  window.exportHistoryItem = exportHistoryItem;
  window.deleteHistoryItem = deleteHistoryItem;
  window.clearAllHistory = clearAllHistory;
  window.clearAllData = clearAllData;
  window.addFollowUpUI = addFollowUpUI;
  window.doRecheck = doRecheck;
  window.getSimilarHistoryPrompt = getSimilarHistoryPrompt;
  window._recordCurrentQuestion = _recordCurrentQuestion;
  window._lastQuestionFor = _lastQuestionFor;
})();