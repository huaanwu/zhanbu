/**
 * 结果导出工具 — 从 app.js 拆出
 * 包含: copyResult / saveResult / showResultActions
 *
 * 依赖: Core.Toast.showToast
 */
(function () {
  if (typeof window === 'undefined') return;

  function copyResult(contentId) {
    const el = document.getElementById(contentId);
    if (!el) return;
    const text = el.textContent || '';
    window.Core.Toast.showToast && window.Core.Toast.showToast(text ? '已复制到剪贴板' : '复制失败', text ? 'success' : 'error');
    if (!text) return;
    const cb = navigator.clipboard;
    if (cb && cb.writeText) cb.writeText(text).catch(() => {});
  }

  function saveResult(contentId, filename) {
    const el = document.getElementById(contentId);
    if (!el) return;
    const text = el.textContent || '';
    if (!text.trim()) {
      window.Core.Toast.showToast && window.Core.Toast.showToast('没有内容可保存', 'warning');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.download = `${filename}_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.Core.Toast.showToast && window.Core.Toast.showToast('已保存为文本文件', 'success');
  }

  function showResultActions(contentId, actionsId) {
    const content = document.getElementById(contentId);
    const actions = document.getElementById(actionsId);
    if (content && actions) {
      const hasText = (content.textContent || '').trim().length > 0;
      actions.classList.toggle('visible', hasText);
    }
  }

  window.Core = window.Core || {};
  window.Core.Result = { copyResult, saveResult, showResultActions };
  // HTML onclick 兼容
  window.copyResult = copyResult;
  window.saveResult = saveResult;
  window.showResultActions = showResultActions;
})();