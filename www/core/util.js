/**
 * 工具函数 — 从 app.js 拆出
 * escapeHtml / WX 五行映射 / 旺衰判断 / 日期初始化
 */
(function () {
  if (typeof window === 'undefined') return;

  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 五行映射
  const WX = {
    '甲': '木', '乙': '木', '寅': '木', '卯': '木',
    '丙': '火', '丁': '火', '巳': '火', '午': '火',
    '戊': '土', '己': '土', '辰': '土', '戌': '土', '丑': '土', '未': '土',
    '庚': '金', '辛': '金', '申': '金', '酉': '金',
    '壬': '水', '癸': '水', '亥': '水', '子': '水',
  };

  // 五行生克
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  function judgeWangShuai(dayGan, gz) {
    if (!dayGan || !gz) return { wang: 3, shuai: 0, level: '中和' };
    const dayWx = WX[dayGan];
    if (!dayWx) return { wang: 3, shuai: 0, level: '中和' };
    let wangScore = 0;
    let total = 0;
    const allChars = [gz.year, gz.month, gz.day, gz.time].filter(Boolean);
    for (const pillar of allChars) {
      for (const ch of pillar) {
        total += 1;
        const wx = WX[ch];
        if (wx === dayWx) wangScore += 2;
        else if (SHENG[wx] === dayWx) wangScore += 1;
        else if (KE[dayWx] === wx) wangScore += 0.5;
        else if (KE[wx] === dayWx) wangScore -= 0.5;
      }
    }
    const monthWx = WX[gz.month?.[0] || gz.month?.[1]] || '';
    let monthBonus = 0;
    if (monthWx === dayWx) monthBonus = 2;
    else if (SHENG[monthWx] === dayWx) monthBonus = 1;
    wangScore += monthBonus;
    let level = '中和';
    if (wangScore >= 5) level = '身旺';
    else if (wangScore <= 1) level = '身弱';
    return { score: wangScore, total, level, monthBonus };
  }

  function initDateInputs() {
    const y = document.getElementById('baziYear');
    if (y && !y.value) y.value = new Date().getFullYear();
  }

  function selCal(domain, val) {
    if (window.state) window.state[domain].cal = val;
  }
  function selLeap(domain, val) {
    if (window.state) window.state[domain].leap = val;
  }
  function selGender(domain, val) {
    if (window.state) window.state[domain].gender = val;
  }

  window.Core = window.Core || {};
  window.Core.Util = { escapeHtml, WX, SHENG, KE, judgeWangShuai, initDateInputs, selCal, selLeap, selGender };
})();
