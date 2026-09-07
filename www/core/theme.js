/**
 * 智能问事路由 + 夜间模式 + AI Stream UX — 从 app.js 拆出
 *
 * 依赖:
 *   - Core.Toast.showToast
 *   - Core.Router.switchPage
 *   - window.EventBus (event-bus.js)
 *   - window.CoreEvents (event-bus.js)
 *   - setupSxDragDrop (shouxiang.js, 定义在 app/shouxiang.js)
 */
(function () {
  if (typeof window === 'undefined') return;

  const showToast = (msg, type) => window.Core && window.Core.Toast && window.Core.Toast.showToast(msg, type);
  const switchPage = () => window.Core && window.Core.Router && window.Core.Router.switchPage;

  // ========== v1.3.3 智能问事（按问题自动路由模块） ==========
  function smartRoute() {
    const q = document.getElementById('smartQuestionInput')?.value?.trim();
    if (!q) { showToast('请输入您的问题', 'error'); return; }

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

    const scores = {};
    for (const rule of routeRules) {
      if (rule.re.test(q)) {
        scores[rule.mod] = (scores[rule.mod] || 0) + (rule.score === 1 ? 2 : 1);
      }
    }
    let bestMod = 'bazi', bestScore = 0;
    for (const [m, s] of Object.entries(scores)) {
      if (s > bestScore) { bestMod = m; bestScore = s; }
    }

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

    const modNames = { bazi: '八字', ziwei: '紫微', liuyao: '六爻', qimen: '奇门', fengshui: '风水', shouxiang: '手相', xingshi: '姓名学', daofobuddhism: '化解页' };
    const modIcons = { bazi: '📅', ziwei: '⭐', liuyao: '☯', qimen: '🔮', fengshui: '🧭', shouxiang: '✋', xingshi: '👤', daofobuddhism: '🙏' };
    const resultEl = document.getElementById('smartResult');
    const allScores = Object.entries(scores).map(([m, s]) => `${modIcons[m] || ''}${modNames[m] || m}=${s}`).join(' ');
    resultEl.innerHTML = `<div style="background:var(--bg-card);padding:0.5rem;border-radius:6px;margin-top:0.4rem;">
      <div style="color:var(--accent-gold);font-weight:bold;">${modIcons[bestMod] || ''} 推荐：${modNames[bestMod] || bestMod}</div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;">评分：${allScores || '无匹配，默认八字'}</div>
    </div>`;

    switchPage()(target.page);
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

  // ========== 夜间模式切换 ==========
  function toggleNightMode() {
    const isNight = document.body.classList.toggle('night-mode');
    localStorage.setItem('night_mode', isNight ? '1' : '0');
    const btn = document.getElementById('nightToggleBtn');
    if (btn) btn.textContent = isNight ? '☀️' : '🌙';
    showToast(isNight ? '已切换至夜间模式(烛火玄学)' : '已切换至日间模式(古籍淡雅)', 'success');
  }

  function restoreNightMode() {
    if (localStorage.getItem('night_mode') === '1') {
      document.body.classList.add('night-mode');
      document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('nightToggleBtn');
        if (btn) btn.textContent = '☀️';
      });
    }
  }

  // AI 解读流式 cursor + loading 按钮态
  function setupStreamUX() {
    if (!window.EventBus) return;
    const bus = window.EventBus;
    const events = window.CoreEvents || {};

    bus.addEventListener(events.AI_START || 'ai:start', () => {
      document.querySelectorAll('.divine-btn').forEach(b => b.classList.add('loading'));
      document.querySelectorAll('.ai-content').forEach(el => el.classList.add('streaming'));
      document.querySelectorAll('.divine-result').forEach(el => el.classList.add('loading'));
    });
    bus.addEventListener(events.AI_COMPLETE || 'ai:complete', () => {
      setTimeout(() => {
        document.querySelectorAll('.divine-btn').forEach(b => b.classList.remove('loading'));
        document.querySelectorAll('.ai-content').forEach(el => el.classList.remove('streaming'));
        document.querySelectorAll('.divine-result').forEach(el => el.classList.remove('loading'));
      }, 200);
    });
    bus.addEventListener(events.AI_ERROR || 'ai:error', () => {
      document.querySelectorAll('.divine-btn').forEach(b => b.classList.remove('loading'));
      document.querySelectorAll('.ai-content').forEach(el => el.classList.remove('streaming'));
      document.querySelectorAll('.divine-result').forEach(el => el.classList.remove('loading'));
    });
  }

  // DOMContentLoaded 监听器: 兜底用 addEventListener 绑定所有导航按钮(兼容 WebView)
  function setupNavFallback() {
    const sp = switchPage();
    if (!sp) return;
    const navMap = {
      'navMingli': () => sp('mingli'),
      'navZhangua': () => sp('zhangua'),
      'navBazi': () => sp('bazi'),
      'navZiwei': () => sp('ziwei'),
      'navLiuyao': () => sp('liuyao'),
      'navQimen': () => sp('qimen'),
      'navShouxiang': () => sp('shouxiang'),
      'navXingshi': () => sp('xingshi'),
      'navCross': () => sp('cross'),
      'navFengshui': () => sp('fengshui'),
      'navSettings': () => sp('settings')
    };
    for (const [id, fn] of Object.entries(navMap)) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', fn);
        el.addEventListener('touchend', function(e) { e.preventDefault(); fn(); });
      }
    }
    document.querySelectorAll('button, .toggle-btn, .divine-btn, .save-btn').forEach(el => {
      el.addEventListener('touchstart', () => {}, { passive: true });
      el.style.cursor = 'pointer';
    });
  }

  window.Core = window.Core || {};
  window.Core.Theme = { smartRoute, toggleNightMode, restoreNightMode, setupStreamUX, setupNavFallback };
  // HTML onclick 兼容
  window.smartRoute = smartRoute;
  window.toggleNightMode = toggleNightMode;
})();