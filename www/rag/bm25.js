/**
 * RAG · BM25 倒排索引 v1.0
 * --------------------------------------------------
 * 类 BM25Index:
 *   - build(docs): 从 docs 构建 BM25 索引(计算 df, idf, avgDocLen)
 *   - score(doc, docLen, queryTokens): 单文档评分
 *   - search(query, topK): 查询接口, 返回排序后的 [{doc, score}]
 *
 * 依赖: window.tokenize (由 rag/tokenizer.js 提供)
 */

class BM25Index {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.docs = [];
    this.docLens = [];
    this.avgDocLen = 0;
    this.df = new Map();
    this.N = 0;
  }

  add(docs) {
    for (const d of docs) {
      this.docs.push(d);
      this.docLens.push(d.tokens.length || 1);
      const seen = new Set();
      for (const t of d.tokens) {
        if (!seen.has(t.t)) {
          this.df.set(t.t, (this.df.get(t.t) || 0) + 1);
          seen.add(t.t);
        }
      }
    }
    this.N = this.docs.length || 1;
    this.avgDocLen = this.docLens.reduce((a, b) => a + b, 0) / this.N || 1;
  }

  // IDF（BM25 公式）
  idf(term) {
    const df = this.df.get(term) || 0;
    return Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
  }

  // 单文档评分（增加来源权重）
  score(doc, docLen, qTokens) {
    const tf = new Map();
    for (const t of doc.tokens) tf.set(t.t, (tf.get(t.t) || 0) + 1);
    let s = 0;
    for (const q of qTokens) {
      const df = tf.get(q.t) || 0;
      if (!df) continue;
      const idf = this.idf(q.t);
      const denom = df + this.k1 * (1 - this.b + this.b * docLen / this.avgDocLen);
      s += idf * (df * (this.k1 + 1)) / denom;
    }
    // 核心经典权重提升
    const sourceBoost = {
      '增删卜易': 1.5,
      '奇门统宗': 1.5,
      '周易爻辞': 1.3,
      '周易爻辞2': 1.3,
      '周易爻辞3': 1.3,
      '周易爻辞4': 1.3,
      '周易爻辞5': 1.3,
      '周易爻辞6': 1.3,
      '周易爻辞7': 1.3,
      '周易爻辞8': 1.3,
      '周易爻辞9': 1.3,
      '周易爻辞10': 1.3,
      '周易爻辞11': 1.3,
      '周易爻辞12': 1.3,
      '周易爻辞13': 1.3,
      '周易爻辞14': 1.3,
      '周易爻辞15': 1.3,
      '倪海厦': 1.4,
      '易经哲学': 1.2,
      '命理哲学': 1.2
    };
    const boost = sourceBoost[doc.source] || 1.0;
    return s * boost;
  }

  search(query, topK = 5) {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];
    // 三元组加权
    const qWeight = qTokens.map(t => ({ ...t, weight: t.n }));
    const scores = [];
    for (let i = 0; i < this.docs.length; i++) {
      const s = this.score(this.docs[i], this.docLens[i], qWeight);
      if (s > 0) scores.push({ doc: this.docs[i], score: s });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

// 显式导出 class(浏览器 script class 不会挂到 window)
if (typeof window !== 'undefined') window.BM25Index = BM25Index;
if (typeof globalThis !== 'undefined') globalThis.BM25Index = BM25Index;
