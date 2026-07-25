/**
 * 路由 — 从 app.js 拆出
 * switchPage 处理页面切换
 */
(function () {
  if (typeof window === 'undefined') return;

  // 分组页映射: 子页面切换时高亮所属分组的导航按钮(命理/占卦)
  const PAGE_TO_NAV = {
    bazi: 'mingli', ziwei: 'mingli', qimen: 'mingli', chenggu: 'mingli',
    liuyao: 'zhangua', xiaoliuren: 'zhangua', meihua: 'zhangua', daliuren: 'zhangua', lingqian: 'zhangua',
    // v3.0.8:手相 + 面相合并入口,nav 仍叫 'shouxiang'(人相),tab 由 #renxiangPaneHand/Face 决定内容
    shouxiang: 'shouxiang', mianxiang: 'shouxiang'  // mianxiang 已并入 pageShouxiang,路由保留兼容
  };

  function switchPage(name) {
    const cap = name[0].toUpperCase() + name.slice(1);
    const navCapName = PAGE_TO_NAV[name] || name;
    const navCap = navCapName[0].toUpperCase() + navCapName.slice(1);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    const pageEl = document.getElementById('page' + cap);
    const navEl = document.getElementById('nav' + navCap);
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
