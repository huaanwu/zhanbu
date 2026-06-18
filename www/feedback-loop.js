/**
 * 反馈闭环系统
 * 将用户反馈自动回流到 AI 解读流程，形成闭环优化
 *
 * 闭环链路：
 *   用户反馈 → 模式分析 → Prompt 校准 → 解读质量提升 → 新一轮反馈
 */

const FeedbackLoop = {
  // ===== 配置 =====
  CONFIG: {
    // 准确度低于此阈值时触发校准提醒
    ACCURACY_THRESHOLD: 65,
    // 低质量反馈中至少包含此条才生成提醒
    MIN_LOW_QUALITY: 3,
    // 最大校准提示行数（防止 prompt 过长）
    MAX_CALIBRATION_LINES: 5,
    // 用户修正汇总最大条数
    MAX_CORRECTIONS: 2,
    // 风险提醒阈值（相似问题中差评数）
    RISK_BAD_COUNT: 2
  },

  // ===== 领域关键词（用于错误模式提取） =====
  DOMAIN_KEYWORDS: {
    bazi: ['旺衰', '用神', '喜忌', '十神', '大运', '流年', '格局', '神煞', '纳音', '旬空', '刑冲', '合会', '太岁'],
    liuyao: ['用神', '世爻', '应爻', '动爻', '变爻', '六亲', '伏神', '旬空', '月破', '日辰', '三合', '六合', '反吟', '伏吟'],
    qimen: ['值符', '值使', '日干', '时干', '吉格', '凶格', '门迫', '入墓', '八门', '九星', '八神', '三奇', '六仪'],
    ziwei: ['命宫', '主星', '四化', '大限', '流年', '三方四正', '庙旺', '利陷', '双星', '身宫', '禄权科忌'],
    xingshi: ['五格', '三才', '人格', '地格', '天格', '总格', '外格', '数理', '吉凶'],
    shouxiang: ['生命线', '智慧线', '感情线', '事业线', '太阳线', '婚姻线', '财运线', '掌丘', '手型']
  },

  // ===== 分析反馈数据，生成校准提示 =====
  analyze(domain) {
    if (!window.Feedback || !window.History) return '';

    const allFeedback = window.Feedback.getAll();
    const domainFeedback = domain ? allFeedback.filter(f => f.domain === domain) : allFeedback;
    const historyItems = window.History.load().filter(h =>
      (!domain || h.domain === domain) && h.feedback
    );

    if (domainFeedback.length < this.CONFIG.MIN_LOW_QUALITY) return '';

    const calibrations = [];

    // 1. 准确度统计校准
    const stats = this._calcStats(domainFeedback);
    if (stats.inaccurateRate > (100 - this.CONFIG.ACCURACY_THRESHOLD)) {
      calibrations.push(
        `【校准·整体准确度】该领域近期用户反馈：准确${stats.accurateRate}% / 部分准${stats.partialRate}% / 不准确${stats.inaccurateRate}%。` +
        `不准确率偏高，请严格依据"确定事实"推理，禁止自由发挥。`
      );
    }

    // 2. 提取高频错误模式
    const errorPatterns = this._extractErrorPatterns(domainFeedback);
    for (const pattern of errorPatterns.slice(0, 3)) {
      calibrations.push(`【校准·常见错误】用户多次反馈"${pattern}"相关判断出错，请重点核实。`);
    }

    // 3. 用户修正汇总（最有价值的反馈）
    const corrections = domainFeedback
      .filter(f => f.userCorrection && f.userCorrection.trim().length > 5)
      .map(f => f.userCorrection.trim());
    if (corrections.length > 0) {
      const unique = [...new Set(corrections)]; // 去重
      const sample = unique.slice(0, this.CONFIG.MAX_CORRECTIONS);
      calibrations.push(`【校准·用户修正参考】${sample.join('；')}`);
    }

    // 4. 好评强化（用户认可的模式，继续保持）
    const goodPatterns = this._extractGoodPatterns(domainFeedback);
    if (goodPatterns.length > 0 && calibrations.length < this.CONFIG.MAX_CALIBRATION_LINES) {
      calibrations.push(`【校准·用户认可】${goodPatterns[0]}方面的分析获得用户认可，继续保持此深度。`);
    }

    return calibrations.slice(0, this.CONFIG.MAX_CALIBRATION_LINES).join('\n');
  },

  // ===== 生成 Prompt 校准注入文本 =====
  getCalibrationPrompt(domain) {
    const calibration = this.analyze(domain);
    if (!calibration) return '';

    const historyCount = window.History
      ? window.History.load().filter(h => h.domain === domain && h.feedback).length
      : 0;

    return `【反馈闭环校准·基于${historyCount}条用户反馈】\n${calibration}\n`;
  },

  // ===== 针对具体问题的风险提醒 =====
  getRiskPrompt(domain, question) {
    if (!window.History || !question) return '';

    // 查找相似问题的反馈历史
    const similar = window.History.findSimilar(domain, '', question, 5);
    const badOnes = similar.filter(s => s.item.feedback === 'bad');
    const partialOnes = similar.filter(s => s.item.feedback === 'partial');

    const risks = [];

    if (badOnes.length >= this.CONFIG.RISK_BAD_COUNT) {
      risks.push(`此前有 ${badOnes.length} 个类似问题的解读被标记为"不准"`);
    }
    if (partialOnes.length >= this.CONFIG.RISK_BAD_COUNT) {
      risks.push(`有 ${partialOnes.length} 个类似问题被标记为"部分准"`);
    }

    if (risks.length === 0) return '';

    return `【风险提示】${risks.join('，')}。请格外谨慎，多维度验证"确定事实"后再下结论，避免重复此前错误。`;
  },

  // ===== 获取知识库改进建议（供人工审核） =====
  getKnowledgeBaseSuggestions(domain) {
    if (!window.Feedback) return [];

    const all = window.Feedback.getAll();
    const domainFb = domain ? all.filter(f => f.domain === domain) : all;
    const lowQuality = domainFb.filter(f => f.rating <= 2 || f.accuracy === '不准确');

    const suggestions = [];

    // 按关键词聚合错误
    const keywordGroups = this._groupByKeyword(lowQuality);
    for (const [keyword, items] of Object.entries(keywordGroups)) {
      if (items.length >= 2) {
        const corrections = items
          .filter(i => i.userCorrection)
          .map(i => i.userCorrection);
        suggestions.push({
          domain: items[0].domain,
          keyword,
          errorCount: items.length,
          sampleCorrections: corrections.slice(0, 3),
          suggestion: `知识库中"${keyword}"相关解释可能需要修正，用户${items.length}次反馈出错` +
            (corrections.length > 0 ? `，参考修正：${corrections[0]}` : '')
        });
      }
    }

    return suggestions.sort((a, b) => b.errorCount - a.errorCount);
  },

  // ===== 生成反馈闭环报告（可定期导出/发送） =====
  generateReport() {
    if (!window.Feedback || !window.History) return null;

    const allFeedback = window.Feedback.getAll();
    const allHistory = window.History.load();

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalFeedback: allFeedback.length,
        totalHistory: allHistory.length,
        feedbackRate: allHistory.length > 0
          ? Math.round(allHistory.filter(h => h.feedback).length / allHistory.length * 100)
          : 0
      },
      byDomain: {}
    };

    const domains = ['bazi', 'ziwei', 'liuyao', 'qimen', 'xingshi', 'shouxiang', 'cross'];
    for (const d of domains) {
      const domainFb = allFeedback.filter(f => f.domain === d);
      const domainHist = allHistory.filter(h => h.domain === d);
      if (domainFb.length === 0 && domainHist.length === 0) continue;

      const stats = this._calcStats(domainFb);
      report.byDomain[d] = {
        feedbackCount: domainFb.length,
        historyCount: domainHist.length,
        avgRating: stats.avgRating,
        accurateRate: stats.accurateRate,
        partialRate: stats.partialRate,
        inaccurateRate: stats.inaccurateRate,
        topErrorPatterns: this._extractErrorPatterns(domainFb).slice(0, 3),
        knowledgeSuggestions: this.getKnowledgeBaseSuggestions(d).slice(0, 3)
      };
    }

    return report;
  },

  // ===== 私有方法：计算统计 =====
  _calcStats(feedbackList) {
    const total = feedbackList.length;
    if (total === 0) {
      return { avgRating: 0, accurateRate: 0, partialRate: 0, inaccurateRate: 0 };
    }

    const avgRating = feedbackList.reduce((s, f) => s + (f.rating || 0), 0) / total;
    const accurate = feedbackList.filter(f => f.accuracy === '准确').length;
    const partial = feedbackList.filter(f => f.accuracy === '部分准确').length;
    const inaccurate = feedbackList.filter(f => f.accuracy === '不准确').length;

    return {
      avgRating: Math.round(avgRating * 10) / 10,
      accurateRate: Math.round(accurate / total * 100),
      partialRate: Math.round(partial / total * 100),
      inaccurateRate: Math.round(inaccurate / total * 100)
    };
  },

  // ===== 私有方法：提取错误模式 =====
  _extractErrorPatterns(feedbackList) {
    const lowQuality = feedbackList.filter(f => f.rating <= 2 || f.accuracy === '不准确');
    if (lowQuality.length === 0) return [];

    const patterns = [];
    for (const f of lowQuality) {
      const text = ((f.comment || '') + ' ' + (f.userCorrection || '')).toLowerCase();
      const keywords = this.DOMAIN_KEYWORDS[f.domain] || [];
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
          patterns.push(kw);
        }
      }
    }

    // 统计频率并去重排序
    const freq = {};
    for (const p of patterns) freq[p] = (freq[p] || 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count >= 2) // 至少出现2次才算模式
      .map(([p, _]) => p);
  },

  // ===== 私有方法：提取好评模式 =====
  _extractGoodPatterns(feedbackList) {
    const goodOnes = feedbackList.filter(f => f.rating >= 4 || f.accuracy === '准确');
    if (goodOnes.length === 0) return [];

    const patterns = [];
    for (const f of goodOnes) {
      const text = (f.comment || '').toLowerCase();
      const keywords = this.DOMAIN_KEYWORDS[f.domain] || [];
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) patterns.push(kw);
      }
    }

    const freq = {};
    for (const p of patterns) freq[p] = (freq[p] || 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([p, _]) => p);
  },

  // ===== 私有方法：按关键词分组 =====
  _groupByKeyword(feedbackList) {
    const groups = {};
    for (const f of feedbackList) {
      const text = ((f.comment || '') + ' ' + (f.userCorrection || '')).toLowerCase();
      const keywords = this.DOMAIN_KEYWORDS[f.domain] || [];
      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
          if (!groups[kw]) groups[kw] = [];
          groups[kw].push(f);
        }
      }
    }
    return groups;
  }
};

// 暴露到全局
window.FeedbackLoop = FeedbackLoop;
