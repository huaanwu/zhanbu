/**
 * Toast 通知 — 从 app.js 拆分
 * 提供统一的 toast 提示
 */
(function () {
  if (typeof window === 'undefined') return;

  function showToast(msg, type) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;padding:0.6rem 1.2rem;border-radius:6px;font-size:0.9rem;pointer-events:none;transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    const colors = {
      error: 'background:#c33;color:#fff;',
      success: 'background:#2a7;color:#fff;',
      info: 'background:#345;color:#fff;',
    };
    toast.style.cssText += colors[type] || colors.info;
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  window.Core = window.Core || {};
  window.Core.Toast = { showToast };
})();
