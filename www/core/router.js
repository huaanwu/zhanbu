/**
 * 路由 — 从 app.js 拆出
 * switchPage 处理页面切换
 */
(function () {
  if (typeof window === 'undefined') return;

  function switchPage(name) {
    const cap = name[0].toUpperCase() + name.slice(1);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    const pageEl = document.getElementById('page' + cap);
    const navEl = document.getElementById('nav' + cap);
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    if (window.ensureCoreKB) window.ensureCoreKB().catch(e => console.warn('core KB fail:', e));
    if (window.PAGE_KB_GROUPS && window.PAGE_KB_GROUPS[name] && window.loadKBGroups) {
      window.loadKBGroups(window.PAGE_KB_GROUPS[name]).catch(e => console.warn('KB group preload fail:', e));
    }
    if (name === 'settings' && window.renderHistory) window.renderHistory();
  }

  window.Core = window.Core || {};
  window.Core.Router = { switchPage };
})();
