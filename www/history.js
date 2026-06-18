/**
 * 历史记录 + 反馈校准系统
 * - 记录所有 AI 解读
 * - 用户给"准/不准/部分准"反馈
 * - 相似度匹配：新查询时找出相似历史+反馈
 */

const History = {
  KEY: 'divination_history_v1',
  MAX: 200,

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch (e) { return []; }
  },

  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items.slice(-this.MAX)));
  },

  // 添加一条记录（pan是排盘快照，output是AI解读，feedback=准/不准/部分准/null）
  add(domain, signal, question, output, panSnapshot) {
    const items = this.load();
    items.push({
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      ts: Date.now(),
      domain,
      signal,
      question: question || '',
      output,
      feedback: null,  // 'good' | 'partial' | 'bad' | null
      panSnapshot
    });
    this.save(items);
  },

  setFeedback(id, feedback) {
    const items = this.load();
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) {
      items[idx].feedback = feedback;
      this.save(items);
    }
  },

  // 文本相似度（与 RAG 同款 TF-IDF，但只针对历史记录）
  similarity(a, b) {
    const tokenize = (t) => {
      if (!t) return [];
      const out = [];
      for (let i = 0; i < t.length; i++) {
        if (/[一-鿿]/.test(t[i])) out.push(t[i]);
      }
      for (let i = 0; i < t.length - 1; i++) {
        if (/[一-鿿]/.test(t[i]) && /[一-鿿]/.test(t[i+1])) out.push(t[i]+t[i+1]);
      }
      return out;
    };
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 || tb.size === 0) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return inter / Math.sqrt(ta.size * tb.size);
  },

  // 找相似历史
  findSimilar(domain, signal, question, topK = 3) {
    const items = this.load().filter(i => i.domain === domain && i.feedback);
    if (items.length === 0) return [];
    const query = [domain, signal, question].join(' ');
    const scored = items.map(i => ({
      item: i,
      score: this.similarity(query, i.signal + ' ' + i.question)
    })).filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scored;
  },

  // 格式化为可注入 prompt 的内容
  formatForPrompt(similar) {
    if (similar.length === 0) return '';
    const lines = ['【历史校准·用户反馈】'];
    for (const s of similar) {
      const fb = s.item.feedback === 'good' ? '✓准确' : s.item.feedback === 'partial' ? '≈部分准' : '✗不准';
      const summary = s.item.output.slice(0, 200).replace(/\n/g, ' ');
      lines.push(`- [${fb}] ${s.item.signal} ${s.item.question || ''}\n  解读摘要：${summary}...`);
    }
    return lines.join('\n') + '\n';
  },

  // 搜索/筛选历史记录
  // filters: { domain?: string, days?: number|'all', keyword?: string, feedback?: string }
  search(filters = {}) {
    let items = this.load();
    const now = Date.now();

    // 按类型筛选
    if (filters.domain && filters.domain !== 'all') {
      items = items.filter(i => i.domain === filters.domain);
    }

    // 按日期范围筛选
    if (filters.days && filters.days !== 'all') {
      const dayMs = filters.days * 86400000;
      items = items.filter(i => now - i.ts < dayMs);
    }

    // 按关键词搜索（问题+解读内容）
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      items = items.filter(i =>
        (i.question || '').toLowerCase().includes(kw) ||
        (i.output || '').toLowerCase().includes(kw) ||
        (i.signal || '').toLowerCase().includes(kw)
      );
    }

    // 按反馈筛选（v1.2.16 支持 'none' = 未反馈）
    if (filters.feedback) {
      if (filters.feedback === 'none') {
        items = items.filter(i => !i.feedback);
      } else {
        items = items.filter(i => i.feedback === filters.feedback);
      }
    }

    // 默认按时间倒序
    return items.sort((a, b) => b.ts - a.ts);
  },

  // 删除单条记录
  delete(id) {
    let items = this.load();
    items = items.filter(i => i.id !== id);
    this.save(items);
    return items.length;
  },

  // 清空所有记录
  clear() {
    localStorage.removeItem(this.KEY);
  },

  // 获取统计信息
  stats() {
    const items = this.load();
    const domains = {};
    const feedbacks = { good: 0, partial: 0, bad: 0, none: 0 };
    for (const i of items) {
      domains[i.domain] = (domains[i.domain] || 0) + 1;
      if (i.feedback) feedbacks[i.feedback]++;
      else feedbacks.none++;
    }
    return { total: items.length, domains, feedbacks };
  }
};

window.History = History;
