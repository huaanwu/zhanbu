/**
 * RAG 重排序(任务 #24)
 *
 * 轻量级重排序:不依赖外部 API,纯本地规则。
 * 综合评分 = 0.4 * BM25 原始分 + 0.3 * 关键词命中密度 + 0.2 * 标题匹配加分 + 0.1 * 标签匹配加分
 *
 * 设计目标:
 *   - 零成本(不调用外部 API)
 *   - 几毫秒内完成
 *   - 比单纯 BM25 Top-K 排序更准
 */

(function () {
 'use strict';

 // 停用词(只移除最没意义的字,保留有信息量的字)
 const STOP_WORDS = new Set(['的', '了', '和', '与', '或', '但', '而', '又',
   '这', '那', '此', '该',
   '啊', '吧', '呢', '嘛', '哦', '嗯', '呀', '哈', '呵']);

 // 分词(简单中文 1/2 gram)
 function tokenize(text) {
   if (!text) return [];
   const tokens = [];
   // 1-gram
   for (const ch of text) {
     if (/[一-鿿]/.test(ch) && !STOP_WORDS.has(ch)) tokens.push(ch);
   }
   // 2-gram
   for (let i = 0; i < text.length - 1; i++) {
     if (/[一-鿿]/.test(text[i]) && /[一-鿿]/.test(text[i + 1])) {
       const bg = text[i] + text[i + 1];
       if (!STOP_WORDS.has(bg)) tokens.push(bg);
     }
   }
   return tokens;
 }

 /**
  * 重排序候选文档
  * @param {string} query 检索查询
  * @param {Array} candidates 候选文档 [{text, title, tags, score, ...}]
  * @param {number} topK 返回前 N 条
  * @returns {Array} 重排序后的 topK 文档(原对象附加 finalScore 字段)
  */
 function rerank(query, candidates, topK = 5) {
   if (!candidates || candidates.length === 0) return [];
   if (!query || candidates.length <= topK) return candidates.slice(0, topK);

   const queryTokens = new Set(tokenize(query));
   if (queryTokens.size === 0) return candidates.slice(0, topK);

   const maxBm25 = Math.max(...candidates.map(c => c.score || 0), 1);

   const scored = candidates.map(doc => {
     const title = doc.title || '';
     const tags = (doc.tags || []).join(' ');
     const content = doc.text || doc.content || doc.summary || '';

     // 关键词命中密度(content 中命中数 / 总词数)
     const contentTokens = tokenize(content);
     const contentSet = new Set(contentTokens);
     let hits = 0;
     queryTokens.forEach(qt => { if (contentSet.has(qt)) hits++; });
     const density = contentSet.size > 0 ? hits / Math.sqrt(queryTokens.size * contentSet.size) : 0;

     // 标题匹配加分
     const titleTokens = new Set(tokenize(title));
     let titleHits = 0;
     queryTokens.forEach(qt => { if (titleTokens.has(qt)) titleHits++; });
     const titleScore = titleTokens.size > 0 ? titleHits / Math.sqrt(queryTokens.size * titleTokens.size) : 0;

     // 标签匹配加分
     const tagTokens = new Set(tokenize(tags));
     let tagHits = 0;
     queryTokens.forEach(qt => { if (tagTokens.has(qt)) tagHits++; });
     const tagScore = tagTokens.size > 0 ? tagHits / Math.sqrt(queryTokens.size * tagTokens.size) : 0;

     // 综合分数(关键词密度权重更高,避免低 BM25 误杀真正相关)
     const bm25Norm = (doc.score || 0) / maxBm25;
     const finalScore = 0.2 * bm25Norm + 0.5 * density + 0.2 * titleScore + 0.1 * tagScore;

     return { ...doc, finalScore };
   });

   return scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, topK);
 }

 /**
  * 对 RAG 结果批量重排序(接受 RAG.search 返回的字符串或数组)
  * @param {string} query 检索查询
  * @param {Array<{title, text, score, tags?}>} candidates RAG 返回的候选
  * @param {number} topK
  */
 function rerankCandidates(query, candidates, topK = 5) {
   return rerank(query, candidates, topK);
 }

 window.RAGRerank = { rerank, rerankCandidates, tokenize };
})();