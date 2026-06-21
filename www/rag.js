/**
 * RAG 知识库检索引擎 v2
 * BM25 + 三元组 + 语义加权
 * 目标：按需检索最相关的知识片段，减少对 LLM 的干扰
 */

const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '上', '也', '很', '到',
  '说', '要', '去', '你', '会', '着', '没', '看', '好', '自己', '这', '那', '里', '什么',
  '之', '的', '地', '得', '而', '其', '此', '与', '及', '或', '若', '如'
]);

function tokenize(text) {
  if (!text) return [];
  const cleaned = text.replace(/[，。！？、；：""''（）()【】\[\]…—\-]/g, ' ');
  const tokens = [];
  // 一元字（去除停用词）
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (/[一-鿿]/.test(c) && !STOP_WORDS.has(c)) {
      tokens.push({ t: c, n: 1 });
    }
  }
  // 二元组（语义更强）
  for (let i = 0; i < cleaned.length - 1; i++) {
    const c1 = cleaned[i], c2 = cleaned[i + 1];
    if (/[一-鿿]/.test(c1) && /[一-鿿]/.test(c2)) {
      if (!STOP_WORDS.has(c1) || !STOP_WORDS.has(c2)) {
        tokens.push({ t: c1 + c2, n: 2 });
      }
    }
  }
  // 三元组（专有名词命中率大幅提升，如"伤官见官"、"身强木弱"等）
  for (let i = 0; i < cleaned.length - 2; i++) {
    const c1 = cleaned[i], c2 = cleaned[i + 1], c3 = cleaned[i + 2];
    if (/[一-鿿]/.test(c1) && /[一-鿿]/.test(c2) && /[一-鿿]/.test(c3)) {
      tokens.push({ t: c1 + c2 + c3, n: 3 });
    }
  }
  return tokens;
}

// 文档切分器（增加标签系统）
function flattenKB(kb, sourceName) {
  const docs = [];
  // 标签映射：根据来源自动打标签
  const sourceTags = {
    '八字': ['命理', '八字', '五行'],
    '紫微': ['命理', '紫微', '星曜'],
    '六爻': ['占卜', '六爻', '周易'],
    '奇门': ['占卜', '奇门', '遁甲'],
    '姓名': ['命理', '姓名', '数理'],
    '手相': ['相术', '手相'],
    '面相': ['相术', '面相'],
    '风水': ['风水', '环境'],
    '择日': ['择吉', '时辰'],
    '周易': ['经典', '周易'],
    '中医': ['中医', '养生'],
    '倪海厦': ['经验', '实战'],
    '哲学': ['理论', '哲学']
  };
  // 提取标签
  let tags = [];
  for (const [key, vals] of Object.entries(sourceTags)) {
    if (sourceName.includes(key)) tags.push(...vals);
  }
  tags = [...new Set(tags)]; // 去重
  
  function walk(obj, path) {
    if (typeof obj === 'string') {
      if (obj.length < 4) return;
      docs.push({ text: obj, path: path.join('.'), source: sourceName, tags, tokens: tokenize(obj) });
    } else if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(v, [...path, i]));
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'meta') continue;
        walk(v, [...path, k]);
      }
    }
  }
  walk(kb, []);
  return docs;
}

// BM25 索引（比 TF-IDF 鲁棒，更好处理长短文档）
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

// 全局 RAG 引擎
const RAG = {
  index: null,
  ready: false,

  async build() {
    if (this.ready) return;
    // 直接fetch JSON文件，不再依赖KB_EMBEDDED
    const sources = [
      { key: 'bazi', name: '八字', file: 'kb_data/bazi_kb.json' },
      { key: 'bazi_ext', name: '八字扩展', file: 'kb_data/bazi_ext_kb.json' },
      { key: 'gua', name: '六爻', file: 'kb_data/gua_kb.json' },
      { key: 'liuyao_ext', name: '六爻高级', file: 'kb_data/liuyao_ext_kb.json' },
      { key: 'qimen', name: '奇门', file: 'kb_data/qimen_kb.json' },
      { key: 'qimen_ext', name: '奇门扩展', file: 'kb_data/qimen_ext_kb.json' },
      { key: 'ziwei', name: '紫微', file: 'kb_data/ziwei_kb.json' },
      { key: 'ziwei_ext', name: '紫微扩展', file: 'kb_data/ziwei_ext_kb.json' },
      { key: 'shouxiang', name: '手相', file: 'kb_data/shouxiang_kb.json' },
      { key: 'xingshi', name: '姓名', file: 'kb_data/xingshi_kb.json' },
      { key: 'nihai_xia', name: '倪海厦', file: 'kb_data/nihai_xia_kb.json' }
    ];
    const all = [];
    await Promise.all(sources.map(async ({ key, name, file }) => {
      try {
        const r = await fetch(file);
        if (!r.ok) return;
        const kb = await r.json();
        all.push(...flattenKB(kb, name));
      } catch (e) { console.warn('KB flatten fail:', key, e); }
    }));

    // 构建 BM25 索引
    this.index = new BM25Index();
    this.index.add(all);

    // 构建向量索引（统一用客户端随机投影，零依赖、一致性 guaranteed）
    // API embedding（本地/网络）保留在 getEmbedding() 中供未来扩展
    this.vectorIndex = new VectorIndex(VECTOR_DIM);
    this.vectorIndex.add(all);

    this.ready = true;
    console.log(`RAG 混合索引建立完成: ${all.length} 个文档片段（BM25 + 向量${VECTOR_DIM}维）`);
  },

  // 从查询和排盘结果中提取信号词
  extractSignals(pan, question) {
    const signals = [];
    if (question) {
      signals.push(question);
      // 提取问题中的关键词（去除停用词）
      const qTokens = tokenize(question);
      const keyTokens = qTokens.filter(t => t.n >= 2).map(t => t.t);
      if (keyTokens.length > 0) signals.push(...keyTokens);
    }
    if (pan) {
      // 八字
      if (pan.gz) {
        signals.push(pan.gz.day, pan.gz.year, pan.gz.month, pan.gz.hour);
        if (pan.tenGods) {
          Object.values(pan.tenGods).forEach(v => v && signals.push(v));
        }
        // 新增：日主五行+旺衰
        const dayGan = pan.gz.day[0];
        if (dayGan) {
          const wxMap = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
          if (wxMap[dayGan]) signals.push(wxMap[dayGan] + pan.wangShuai);
        }
      }
      // 紫微
      if (pan.mingGong) {
        signals.push(pan.mingGong.name, pan.mingGong.ganzhi);
        if (pan.mingGong.stars) {
          pan.mingGong.stars.forEach(s => signals.push(s.name));
        }
        // 新增：四化
        if (pan.siHua) {
          Object.entries(pan.siHua).forEach(([k,v]) => signals.push(v + k));
        }
      }
      // 六爻
      if (pan.gua) {
        signals.push(pan.gua.name);
        if (pan.yaoList) {
          pan.yaoList.forEach(y => {
            signals.push(y.gan + y.zhi, y.liuqin, y.liushen, y.wuxing);
          });
        }
        // 新增：动爻信息
        if (pan.gua.dongYaoList && pan.gua.dongYaoList.length > 0) {
          signals.push('动爻' + pan.gua.dongYaoList.length + '个');
          if (pan.gua.dongYaoList.length > 3) signals.push('多动爻');
        }
        if (pan.huGua) signals.push('互卦' + pan.huGua);
      }
      // 奇门
      if (pan.gong9) {
        pan.gong9.forEach(g => {
          signals.push(g.dipan, g.tianpan, g.jiuxing, g.renpan, g.shenpan);
        });
        // 新增：值符值使
        const zf = pan.gong9.find(g => g.is_dipan_zhifu);
        const zs = pan.gong9.find(g => g.is_renpan_zhishi);
        if (zf) signals.push('值符' + zf.dipan);
        if (zs) signals.push('值使' + zs.renpan);
        // 新增：吉门凶门
        const sheng = pan.gong9.find(g => g.renpan === '生门');
        const si = pan.gong9.find(g => g.renpan === '死门');
        if (sheng) signals.push('生门' + sheng.name);
        if (si) signals.push('死门' + si.name);
      }
      // 姓名学
      if (pan.sancai) {
        signals.push(pan.sancai.tian + pan.sancai.ren + pan.sancai.di + '三才');
      }
      if (pan.wuge) {
        signals.push('人格' + pan.wuge.renge + '总格' + pan.wuge.zongge);
      }
    }
    return signals.join(' ');
  },

  search(pan, question, opts = {}) {
    if (!this.ready) return '';
    const { topK = 8, maxChars = 2500, source = null, minScore = 1.0, tags = null, useVector = true } = opts;
    const query = this.extractSignals(pan, question);

    // 1. BM25 检索
    let bm25Results = this.index.search(query, topK * 3);

    // 2. 向量语义检索（捕捉 BM25 错过的语义相似）
    let vectorResults = [];
    if (useVector && this.vectorIndex) {
      vectorResults = this.vectorIndex.search(query, topK * 3);
    }

    // 3. RRF 融合排序
    let fused = rrfFusion(bm25Results, vectorResults);

    // 4. 来源过滤
    if (source) {
      fused = fused.filter(r => r.doc.source === source);
    }
    // 标签过滤
    if (tags && tags.length > 0) {
      fused = fused.filter(r => r.doc.tags && tags.some(t => r.doc.tags.includes(t)));
    }

    // 5. 取 TopK
    fused = fused.slice(0, topK);

    // 6. fallback：如果融合结果太少，用 BM25 直接兜底
    if (fused.length === 0) {
      fused = bm25Results.slice(0, topK).map(r => ({ doc: r.doc, score: r.score / 100 }));
    }
    if (fused.length === 0) {
      fused = this.index.search(question || '吉凶', topK).map(r => ({ doc: r.doc, score: r.score / 100 }));
    }

    if (fused.length === 0) return '';

    // 7. 格式化输出
    const lines = ['【知识库相关片段（BM25+向量语义混合检索）】'];
    let totalLen = 0;
    for (const r of fused) {
      const tagStr = r.doc.tags ? `(${r.doc.tags.join('/')})` : '';
      const line = `· [${r.doc.source}]${tagStr} ${r.doc.text}`;
      if (totalLen + line.length > maxChars) break;
      lines.push(line);
      totalLen += line.length;
    }
    const result = '\n' + lines.join('\n') + '\n';
    if (!result || result.length === 0) return '';
    return result;
  }
};

// ============= 向量检索引擎 =============
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
  }

  add(docs) {
    for (const doc of docs) {
      const vec = textToVector(doc.text, this.dim);
      this.docs.push(doc);
      this.vectors.push(vec);
    }
  }

  search(query, topK = 5) {
    const qVec = textToVector(query, this.dim);
    const scores = [];
    for (let i = 0; i < this.vectors.length; i++) {
      const sim = cosineSimilarity(qVec, this.vectors[i]);
      if (sim > 0.1) scores.push({ doc: this.docs[i], score: sim });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

// ========== Embedding API 调用 ==========
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

// ============= RRF 混合排序 =============
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

window.RAG = RAG;
