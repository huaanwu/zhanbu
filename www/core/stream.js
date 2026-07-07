/**
 * Stream indicator — 从 app.js 拆出
 * 全局流式状态指示器
 */
(function () {
  if (typeof window === 'undefined') return;

  let _streamIndicator = null;

  function stopCurrentStream() {
    const abort = window.Core?.AI?.getCurrentStreamAbort?.();
    if (abort) {
      try { abort.abort(); } catch (e) { /* noop */ }
      window.Core?.AI?.clearCurrentStreamAbort?.();
    }
    hideStreamIndicator();
    const showToast = window.Core?.Toast?.showToast || function () {};
    showToast('已停止生成', 'info');
  }

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

  window.Core = window.Core || {};
  window.Core.Stream = { stopCurrentStream, showStreamIndicator, hideStreamIndicator };
})();
