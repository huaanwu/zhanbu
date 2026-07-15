/**
 * RAG · RRF 混合排序 v1.0
 * --------------------------------------------------
 * Reciprocal Rank Fusion: 融合 BM25 与向量检索结果
 *   - 对每个 doc, score = Σ 1/(k + rank_i)
 *   - k=60 是经典 RRF 论文推荐值
 *   - BM25 与向量排名权重相等(1.0), 与 score 数值无关
 *   - 优势: 不需要归一化不同评分器输出, 纯排名驱动
 */

// Reciprocal Rank Fusion：融合 BM25 和向量检索结果
function rrfFusion(bm25Results, vectorResults, k = 60) {
  const scores = new Map();
  // BM25 排名得分
  for (let i = 0; i < bm25Results.length; i++) {
    const d = bm25Results[i].doc;
    const id = d.source + '|' + d.path + '|' + d.text.slice(0, 30);
    scores.set(id, { doc: d, score: 1 / (k + i + 1) });
  }
  // 向量排名得分
  for (let i = 0; i < vectorResults.length; i++) {
    const d = vectorResults[i].doc;
    const id = d.source + '|' + d.path + '|' + d.text.slice(0, 30);
    const existing = scores.get(id);
    if (existing) {
      existing.score += 1 / (k + i + 1);
    } else {
      scores.set(id, { doc: d, score: 1 / (k + i + 1) });
    }
  }
  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

// 显式导出 function(浏览器 script function 会自动挂 window, 这里双保险)
if (typeof window !== 'undefined') window.rrfFusion = rrfFusion;
if (typeof globalThis !== 'undefined') globalThis.rrfFusion = rrfFusion;
