/**
 * 工具函数 — 从 app.js 拆出
 * escapeHtml / WX 五行映射 / 旺衰判断 / 日期初始化 / selCal-Leap-Gender
 *
 * 注意: selCal/selLeap/selGender 保留 (btn, prefix) 签名,匹配 HTML onclick
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

  // tagged template: auto-escape all interpolated values
  function safeHTML(strings, ...values) {
    return strings.reduce((acc, s, i) => {
      let v = values[i];
      if (v == null) v = '';
      else if (typeof v === 'object' && v && v.__safeHTML) v = v.html;
      else if (typeof v !== 'string') v = String(v);
      else v = escapeHtml(v);
      return acc + s + v;
    }, '');
  }

  // mark a pre-rendered HTML string as safe for safeHTML composition
  safeHTML.raw = function(html) {
    return { __safeHTML: true, html: String(html) };
  };


  // 五行映射:10 天干 + 12 地支
  const WX = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水',
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
  };

  // 五行生克/天干五行/地支五行 — 来自 Expert 单一来源 (expert/tables.js)
  // 注: util.js 在 Expert 之前加载,函数内调用时 Expert.SHENG/WX 已有值

  // v1.2.x 12 令旺衰判断:基于月令 + 根 + 比劫
  function judgeWangShuai(dayGan, gz) {
    if (!dayGan || !gz || !gz.month) return '中和';
    const wuXing = WX[dayGan];
    if (!wuXing) return '中和';
    const monthZhi = gz.month[1];
    const lingWang = {
      '木': ['寅', '卯'], '火': ['巳', '午'], '土': ['辰', '戌', '丑', '未'],
      '金': ['申', '酉'], '水': ['亥', '子'],
    };
    // 相 = 生我者之月令; 休 = 我生者; 囚 = 我克者; 死 = 克我者
    const lingXiang = {
      '木': ['亥', '子'], '火': ['寅', '卯'], '土': ['巳', '午'],
      '金': ['辰', '戌', '丑', '未'], '水': ['申', '酉'],
    };
    const lingXiu = {
      '木': ['巳', '午'], '火': ['申', '酉'], '土': ['寅', '卯'],
      '金': ['亥', '子'], '水': ['辰', '戌', '丑', '未'],
    };
    const lingQiu = {
      '木': ['辰', '戌', '丑', '未'], '火': ['亥', '子'], '土': ['申', '酉'],
      '金': ['巳', '午'], '水': ['寅', '卯'],
    };
    const lingJue = {
      '木': ['申', '酉'], '火': ['辰', '戌', '丑', '未'], '土': ['亥', '子'],
      '金': ['寅', '卯'], '水': ['巳', '午'],
    };
    let score = 0;
    if (lingWang[wuXing].includes(monthZhi)) score += 3;
    else if (lingXiang[wuXing].includes(monthZhi)) score += 2;
    else if (lingXiu[wuXing].includes(monthZhi)) score += 0;
    else if (lingQiu[wuXing].includes(monthZhi)) score -= 1;
    else if (lingJue[wuXing].includes(monthZhi)) score -= 2;

    const roots = {
      '木': ['寅', '卯'], '火': ['巳', '午'], '土': ['辰', '戌', '丑', '未'],
      '金': ['申', '酉'], '水': ['亥', '子'],
    };
    for (const k of ['year', 'month', 'hour']) {
      if (roots[wuXing].includes(gz[k]?.[1])) score += 1;
    }
    const biJie = {
      '甲': ['甲', '乙'], '乙': ['甲', '乙'], '丙': ['丙', '丁'], '丁': ['丙', '丁'],
      '戊': ['戊', '己'], '己': ['戊', '己'], '庚': ['庚', '辛'], '辛': ['庚', '辛'],
      '壬': ['壬', '癸'], '癸': ['壬', '癸'],
    };
    for (const k of ['year', 'month', 'hour']) {
      if (biJie[dayGan].includes(gz[k]?.[0])) score += 1;
    }
    return score >= 3 ? '身强' : '身弱';
  }

  function initDateInputs() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const h = now.getHours();
    const zhiIdx = Math.floor((h + 1) / 2) % 12;

    const baziY = document.getElementById('baziYear');
    const baziM = document.getElementById('baziMonth');
    const baziD = document.getElementById('baziDay');
    const baziH = document.getElementById('baziHour');
    if (baziY) { baziY.value = y; baziM.value = m; baziD.value = d; baziH.value = h; }

    const zwY = document.getElementById('zwYear');
    const zwM = document.getElementById('zwMonth');
    const zwD = document.getElementById('zwDay');
    const zwH = document.getElementById('zwHour');
    if (zwY) { zwY.value = y; zwM.value = m; zwD.value = d; }
    if (zwH) zwH.value = zhiIdx;

    const qmY = document.getElementById('qmYear');
    const qmM = document.getElementById('qmMonth');
    const qmD = document.getElementById('qmDay');
    const qmH = document.getElementById('qmHour');
    if (qmY) { qmY.value = y; qmM.value = m; qmD.value = d; qmH.value = h; }

    const cxY = document.getElementById('cxYear');
    const cxM = document.getElementById('cxMonth');
    const cxD = document.getElementById('cxDay');
    const cxH = document.getElementById('cxHour');
    if (cxY) { cxY.value = y; cxM.value = m; cxD.value = d; cxH.value = h; }
  }

  // 兼容 HTML onclick: selCal(this,'bazi') / selLeap(this,'bazi') / selGender(this,'zw')
  // 仅服务于八字(bazi)+ 紫微(zw) 两个页面,与原 app.js 行为一致
  function selCal(btn, prefix) {
    document.querySelectorAll(`[data-cal]`).forEach(b => {
      if (b.closest('#page' + (prefix === 'bazi' ? 'Bazi' : 'Ziwei'))) b.classList.remove('active');
    });
    btn.classList.add('active');
    if (window.state && window.state[prefix]) window.state[prefix].cal = btn.dataset.cal;
    const wrap = document.getElementById(prefix + 'LeapWrap');
    if (wrap) wrap.style.display = btn.dataset.cal === 'lunar' ? 'block' : 'none';
  }
  function selLeap(btn, prefix) {
    document.querySelectorAll(`[data-leap]`).forEach(b => {
      if (b.closest('#page' + (prefix === 'bazi' ? 'Bazi' : 'Ziwei'))) b.classList.remove('active');
    });
    btn.classList.add('active');
    if (window.state && window.state[prefix]) window.state[prefix].leap = btn.dataset.leap === 'true';
  }
  function selGender(btn, prefix) {
    document.querySelectorAll(`[data-gender]`).forEach(b => {
      if (b.closest('#page' + (prefix === 'bazi' ? 'Bazi' : 'Ziwei'))) b.classList.remove('active');
    });
    btn.classList.add('active');
    if (window.state && window.state[prefix]) window.state[prefix].gender = btn.dataset.gender;
  }

  window.Core = window.Core || {};
  window.Core.Util = { escapeHtml, safeHTML, WX, judgeWangShuai, initDateInputs, selCal, selLeap, selGender };
})();