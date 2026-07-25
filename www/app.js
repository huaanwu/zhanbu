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

var APP_VERSION = 'v3.1.0';
var APP_BUILD_DATE = '2026-07-26';

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


// initDateInputs / selCal / selLeap / selGender 已搬到 core/util.js
// 通过顶部 compat shim 在 window 上暴露,保持 HTML onclick 兼容

// ========== AB Test 配置 (compat: 暴露到 window 供 ai-service.js 调用) ==========
function getActiveABConfig() {
  const fallback = {
    topK: 10,
    maxChars: 2500,
    useFewshot: true,
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
window.getActiveABConfig = getActiveABConfig;










// DOMContentLoaded 兜底绑定导航已搬到 core/theme.js (setupNavFallback)
// 手相拖拽初始化 (setupSxDragDrop 定义在 app/shouxiang.js)
// 注意:v3.0.5 手相改 4 张图(先天/后天 × 掌心/手背),ID 已拆成 LeftPalm/LeftBack/RightPalm/RightBack
// setupSxDragDrop 现在的签名是 (areaId, inputId, hand, side),缺 side 会让 onSxFileSelect 拿到 undefined
function _initOnDOMReady() {
  if (typeof setupSxDragDrop === 'function') {
    setupSxDragDrop('sxUploadAreaLeftPalm',  'sxFileInputLeftPalm',  'left',  'palm');
    setupSxDragDrop('sxUploadAreaLeftBack',  'sxFileInputLeftBack',  'left',  'back');
    setupSxDragDrop('sxUploadAreaRightPalm', 'sxFileInputRightPalm', 'right', 'palm');
    setupSxDragDrop('sxUploadAreaRightBack', 'sxFileInputRightBack', 'right', 'back');
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initOnDOMReady);
} else {
  _initOnDOMReady();
}

// 初始化
loadSettings();
initDateInputs();
switchPage('mingli');


