/**
 * Core event bus — 解耦模块间通信,消除循环依赖
 * 用法: BUS.dispatchEvent(new CustomEvent(EVT.AI_COMPLETE, { detail: {...} }))
 *       BUS.addEventListener(EVT.AI_COMPLETE, e => handleEvent(e.detail))
 */
(function () {
  if (typeof window === 'undefined') return;

  // v3.0.4 event bus 初始化
  window.EventBus = window.EventBus || new EventTarget();
  window.CoreEvents = Object.freeze({
    AI_START: 'ai:start',          // detail: { domain }
    AI_CHUNK: 'ai:chunk',          // detail: { domain, text, full }
    AI_COMPLETE: 'ai:complete',    // detail: { domain, outputText, prompt, system, contentEl }
    AI_ERROR: 'ai:error',          // detail: { domain, error }
    FOLLOWUP: 'ai:followup',       // detail: { domain, question }
    FOLLOWUP_CLEAR: 'ai:followup:clear', // detail: { domain }
    FEEDBACK: 'ai:feedback',       // detail: { domain, rating, comment }
  });
})();
