/**
 * 全局状态 — 从 app.js 拆出
 * state 对象 + 各流派 current* 变量 + API key 默认值
 */
(function () {
  if (typeof window === 'undefined') return;

  window.state = {
    bazi: { cal: 'solar', leap: false, gender: 'male' },
    zw:   { cal: 'solar', leap: false, gender: 'male' },
    liuyao: { method: 'time', mode: 'normal' },
    xiaoliuren: { method: 'time' },
    meihua: { method: 'time' },
    daliuren: {},
    chenggu: {},
    lingqian: { kind: 'guanyin' },
  };

  window.currentBazi = null; window.currentBaziPrompt = '';
  window.currentZw = null; window.currentZwPrompt = '';
  window.currentLy = null; window.currentLyPrompt = '';
  window.currentXlr = null; window.currentXlrPrompt = '';
  window.currentMh = null; window.currentMhPrompt = '';
  window.currentDlr = null; window.currentDlrPrompt = '';
  window.currentCg = null; window.currentCgPrompt = '';
  window.currentLq = null; window.currentLqPrompt = '';
  window.currentQm = null; window.currentQmPrompt = '';
  window.currentXs = null; window.currentXsPrompt = '';
  window.currentCross = null; window.currentCrossPrompt = '';
  window.currentFs = null; window.currentFsPrompt = '';
  window.currentMx = null; window.currentMxPrompt = '';
  window.currentSx = null; window.currentSxPrompt = '';
  window.currentDf = null; window.currentDfPrompt = '';

  window._followUpPrefix = '';

  // v1.3.1: API Key 必须运行时由用户输入,禁止硬编码
  window.DEFAULT_API_KEY = '';

  window.Core = window.Core || {};
  window.Core.State = { get: () => window.state, set: (s) => { window.state = s; } };
})();
