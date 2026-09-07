/**
 * RAG · 向量检索引擎 v1.0
 * --------------------------------------------------
 * 类 VectorIndex:
 *   - add(docs): 批量向量化 + 加入索引
 *   - search(query, topK): 余弦相似度排序
 *
 * 客户端随机投影(无 API 时的兜底):
 *   - textToVector: tokenize → tokenProjection → 加权求和 → 归一化
 *   - 同样的输入永远产生同样的向量(SeededRandom + hashCode)
 *
 * 依赖: window.tokenize (由 rag/tokenizer.js 提供)
 */

// 三层 fallback：本地 embedding → 网络 embedding → 客户端随机投影

const VECTOR_DIM = 128; // 向量维度（平衡精度与性能）

// 确定性随机数生成器（同一 token 始终产生相同投影，保证可复现）
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return (this.seed / 4294967296) * 2 - 1; // -1 ~ 1
  }
}

// 为 token 生成确定性投影向量
function tokenProjection(token, dim) {
  const rng = new SeededRandom(hashCode(token));
  const vec = new Float32Array(dim);
  for (let i = 0; i < dim; i++) vec[i] = rng.next();
  return vec;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

// 文本 → 向量（客户端随机投影）
function textToVector(text, dim = VECTOR_DIM) {
  const tokens = tokenize(text);
  const vec = new Float32Array(dim);
  const tf = new Map();
  for (const t of tokens) tf.set(t.t, (tf.get(t.t) || 0) + t.n);
  const maxTf = Math.max(...tf.values(), 1);
  for (const [token, count] of tf) {
    const proj = tokenProjection(token, dim);
    const weight = count / maxTf; // 归一化 TF
    for (let i = 0; i < dim; i++) vec[i] += proj[i] * weight;
  }
  // L2 归一化
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

// 余弦相似度（向量已 L2 归一化，点积即余弦）
function cosineSimilarity(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// 向量索引
class VectorIndex {
  constructor(dim = VECTOR_DIM) {
    this.dim = dim;
    this.docs = [];
    this.vectors = [];
    this.backend = 'random'; // 'random' | 'semantic'
    this._apiKey = null;
    this._networkUrl = null;
  }

  // v2.0.3: 配置为 semantic 模式后,query 用真 embedding
  setSemantic(apiKey, networkUrl) {
    this.backend = 'semantic';
    this._apiKey = apiKey;
    this._networkUrl = networkUrl;
  }

  add(docs) {
    // random 模式才在这里生成向量;semantic 模式在 _buildSemanticIndex 中已生成
    for (const doc of docs) {
      const vec = textToVector(doc.text, this.dim);
      this.docs.push(doc);
      this.vectors.push(vec);
    }
  }

  async search(query, topK = 5) {
    let qVec;
    if (this.backend === 'semantic' && this._apiKey) {
      // v3.0.4: 优先读 IndexedDB 查询缓存
      let cached = null;
      if (window.VectorCache) {
        cached = await window.VectorCache.get('query', query, this._apiKey);
      }
      if (cached) {
        qVec = cached.vector;
      } else {
        const r = await getEmbedding(query, { apiKey: this._apiKey, networkUrl: this._networkUrl });
        qVec = r.source === 'local-fallback' ? textToVector(query, this.dim) : r.vector;
        if (window.VectorCache && r.source !== 'local-fallback') {
          await window.VectorCache.set('query', query, this._apiKey, qVec);
        }
      }
    } else {
      qVec = textToVector(query, this.dim);
    }
    // L2 归一化(query)
    const norm = Math.sqrt(qVec.reduce((s, v) => s + v * v, 0)) || 1;
    if (norm !== 1) for (let i = 0; i < qVec.length; i++) qVec[i] /= norm;

    const scores = [];
    for (let i = 0; i < this.vectors.length; i++) {
      const sim = cosineSimilarity(qVec, this.vectors[i]);
      if (sim > 0.1) scores.push({ doc: this.docs[i], score: sim });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}


// 三层 fallback：本地 → 网络 → 客户端随机投影

async function getEmbedding(text, opts = {}) {
  const { localUrl = null, apiKey = null, networkUrl = null } = opts;

  // 第一层：本地 embedding
  if (localUrl) {
    try {
      const res = await fetch(`${localUrl}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'local', input: text })
      });
      if (res.ok) {
        const data = await res.json();
        const vec = data.data?.[0]?.embedding;
        if (vec && vec.length > 0) {
          const arr = new Float32Array(vec);
          // L2 归一化
          const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0)) || 1;
          for (let i = 0; i < arr.length; i++) arr[i] /= norm;
          return { vector: arr, source: 'local' };
        }
      }
    } catch (e) { /* 本地不可用，继续 fallback */ }
  }

  // 第二层：网络 embedding（阿里云百炼）
  if (apiKey && networkUrl) {
    try {
      const res = await fetch(networkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model: 'text-embedding-v3', input: text })
      });
      if (res.ok) {
        const data = await res.json();
        const vec = data.data?.[0]?.embedding;
        if (vec && vec.length > 0) {
          const arr = new Float32Array(vec);
          const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0)) || 1;
          for (let i = 0; i < arr.length; i++) arr[i] /= norm;
          return { vector: arr, source: 'network' };
        }
      }
    } catch (e) { /* 网络不可用，继续 fallback */ }
  }

  // 第三层：客户端随机投影
  return { vector: textToVector(text), source: 'local-fallback' };
}

// 批量获取 embedding（优先用 API，失败批量 fallback）
async function getEmbeddingsBatch(texts, opts = {}) {
  const results = [];
  // 先尝试 API（第一个文本探测）
  const test = await getEmbedding(texts[0], opts);
  if (test.source !== 'local-fallback') {
    // API 可用，逐个调用（embedding API 通常支持 batch，但为简单起见逐个）
    for (const text of texts) {
      const r = await getEmbedding(text, opts);
      results.push(r.vector);
    }
  } else {
    // API 不可用，全部用客户端随机投影（更快）
    for (const text of texts) {
      results.push(textToVector(text));
    }
  }
  return results;
}

// 显式导出 const/class(浏览器 script 不挂 window)
window.VECTOR_DIM = VECTOR_DIM
window.SeededRandom = SeededRandom
window.VectorIndex = VectorIndex
window.textToVector = textToVector
window.getEmbedding = getEmbedding;
if (typeof globalThis !== 'undefined') {
globalThis.VECTOR_DIM = VECTOR_DIM;
globalThis.SeededRandom = SeededRandom;
globalThis.VectorIndex = VectorIndex;
globalThis.textToVector = textToVector;
globalThis.getEmbedding = getEmbedding;
}
