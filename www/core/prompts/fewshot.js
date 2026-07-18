/**
 * Few-shot 动态抽取(任务 #26)
 *
 * 从知识库的 cases KB 动态选 2-3 条最相关的经典案例,做 in-context 学习。
 * 与 expert/chain.js 的静态 fewshot 互补:静态保证基本风格,动态保证场景贴合。
 */

(function () {
  'use strict';

  // cases KB 索引:domain → KB 文件名
  const CASES_KB_MAP = {
    liuyao: 'liuyao_cases_kb.json',
    bazi:   'bazi_kb.json',         // 八字基础 KB 包含经典格局案例
    ziwei:  'ziwei_kb.json',
    qimen:  'qimen_zhanji_kb.json', // 奇门占吉案例
    cross:  null
  };

  // 抽取 N 条最相关案例(简单关键词命中)
  function pickRelevant(items, query, n = 2) {
    if (!query || !items || items.length === 0) return items?.slice(0, n) || [];
    const tokens = new Set(query.replace(/[，。？！、]/g, ' ').split(/\s+/).filter(Boolean));
    const scored = items.map(it => {
      const text = ((it.title || '') + ' ' + (it.content || it.summary || '') + ' ' + (it.tags || []).join(' ')).toLowerCase();
      let score = 0;
      tokens.forEach(t => { if (text.includes(t.toLowerCase())) score++; });
      return { it, score };
    }).filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(s => s.it);
    return scored.length > 0 ? scored : items.slice(0, n);
  }

  /**
   * 获取该 domain 的 few-shot(优先动态案例,fallback 静态)
   * @param {string} domain
   * @param {string} question 用户问题(用于相关性匹配)
   * @returns {string} 提示词片段
   */
  function getFewshot(domain, question) {
    const kbFile = CASES_KB_MAP[domain];
    if (!kbFile) return '';

    let cases = [];
    try {
      // 优先用 window.KB.loadAll() 或 window.Core.KB
      const KB = window.Core?.KB || window.KB;
      if (KB && typeof KB.get === 'function') {
        cases = KB.get(kbFile) || [];
      } else if (window.RAG?.KB?.all) {
        cases = window.RAG.KB.all[kbFile] || [];
      }
    } catch (e) {
      console.warn('[Fewshot] 加载 KB 失败:', e);
      return '';
    }

    // 提取案例字段(知识库 schema 不一定统一)
    const items = cases.filter(c => c.case || c.example || c.title).map(c => ({
      title: c.title || c.name,
      content: c.content || c.summary || c.case || c.example,
      tags: c.tags || []
    })).filter(c => c.content);

    if (items.length === 0) return '';

    const picked = pickRelevant(items, question || '', 2);
    if (picked.length === 0) return '';

    const lines = ['【Few-shot 经典案例参考】'];
    picked.forEach((c, i) => {
      lines.push(`\n案例 ${i + 1}: ${c.title || '(无标题)'}`);
      lines.push(c.content.slice(0, 300) + (c.content.length > 300 ? '...' : ''));
    });
    lines.push('\n请参考上述案例的解读风格(分章、条理、可操作),但不要照抄具体结论。\n');
    return lines.join('\n');
  }

  window.CorePromptsFewshot = { getFewshot, pickRelevant, CASES_KB_MAP };
})();