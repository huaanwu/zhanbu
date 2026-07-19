/**
 * RAG · 主入口 v1.0
 * --------------------------------------------------
 * const RAG = { index, ready, embeddingBackend, ... }
 *   - load(): 加载 KB bundle (kb_core.json + 各 _bundles/kb_*.json)
 *   - build(): 构建 BM25 + 向量索引
 *   - prewarm(): 提前构建索引(不阻塞 UI)
 *   - extractSignals(pan, question): 从盘面+问题提取检索关键词
 *   - retrieve(pan, question, topK): BM25+向量混合检索
 *   - format(results): 格式化为 AI prompt 字符串
 *
 * 依赖: rag/tokenizer.js + rag/bm25.js + rag/vector.js + rag/rrf.js
 *
 * 末尾设 window.RAG = RAG (最后加载, 包含所有方法挂载)
 */

// v3.0.6: fetch 带超时保护
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// flattenKB 由 tokenizer.js 提供
const _flattenKB = window.flattenKB;
const _tokenize = window.tokenize;
const _BM25Index = window.BM25Index;
const _VectorIndex = window.VectorIndex;
const _rrfFusion = window.rrfFusion;
const _getEmbedding = window.getEmbedding;

const RAG = {
  index: null,
  ready: false,
  // v2.0.3: embedding backend ('semantic' 真API / 'random' 客户端随机投影)
  embeddingBackend: null, // build 后会被覆盖

  async build() {
    if (this.ready) return;
    if (this._building) return this._building; // 复用进行中的 build
    this._building = (async () => {
      // v2.0.2: 直接 fetch kb_core bundle,不再 11 个并发请求
      // bundle 内仍按 key 区分, flattenKB 的 source tag 仍用 key 名
    const all = [];
    try {
      const r = await fetchWithTimeout('kb_data/_bundles/kb_core.json');
      if (r.ok) {
        const bundle = await r.json();
        for (const [key, kb] of Object.entries(bundle)) {
          // tag 用原始 key 名(去 _kb 后缀),例如 bazi → "八字"
          const nameMap = {
            bazi: '八字', bazi_ext: '八字扩展', gua: '六爻', liuyao_ext: '六爻高级',
            qimen: '奇门', qimen_ext: '奇门扩展', ziwei: '紫微', ziwei_ext: '紫微扩展',
            shouxiang: '手相', xingshi: '姓名', nihai_xia: '倪海厦'
          };
          const name = nameMap[key] || key;
          all.push(...flattenKB(kb, name));
        }
      } else {
        console.warn('[RAG] kb_core bundle 加载失败,降级逐个 fetch');
        // 降级: 11 个并发 fetch
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
        await Promise.all(sources.map(async ({ key, name, file }) => {
          try {
            const r = await fetchWithTimeout(file);
            if (!r.ok) return;
            const kb = await r.json();
            all.push(...flattenKB(kb, name));
          } catch (e) { console.warn('KB flatten fail:', key, e); }
        }));
      }
    } catch (e) {
      console.warn('[RAG] bundle 加载异常,降级逐个 fetch:', e.message);
    }

    // 构建 BM25 索引
    this.index = new BM25Index();
    this.index.add(all);

    // v2.0.3: 选择 embedding backend
    // 优先用真 embedding (需 API key),否则随机投影兜底
    const apiKey = localStorage.getItem('ds_api_key');
    const useSemantic = apiKey && apiKey.length > 20;
    this.embeddingBackend = useSemantic ? 'semantic' : 'random';
    console.log(`[RAG] embedding backend: ${this.embeddingBackend}${useSemantic ? ' (云端 API)' : ' (本地随机投影)'}`);

    if (useSemantic) {
      this.vectorIndex = await this._buildSemanticIndex(all);
    } else {
      this.vectorIndex = new VectorIndex(VECTOR_DIM);
      this.vectorIndex.add(all);
    }

    this.ready = true;
    this._building = null;
    console.log(`RAG 混合索引建立完成: ${all.length} 个文档片段（BM25 + 向量${this.vectorIndex?.dim || VECTOR_DIM}维 ${this.embeddingBackend}）`);
    })();
    return this._building;
  },

  // v2.0.3: 真 embedding 索引构建 (调云端 API)
  // 失败自动降级到随机投影
  async _buildSemanticIndex(docs) {
    const index = new VectorIndex(VECTOR_DIM);
    const apiKey = localStorage.getItem('ds_api_key');
    const networkUrl = localStorage.getItem('embedding_url') || 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
    index.setSemantic(apiKey, networkUrl);
    const BATCH = 10;
    let okCount = 0;
    let cacheCount = 0;
    try {
      for (let i = 0; i < docs.length; i += BATCH) {
        const batch = docs.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async d => {
          try {
            // v3.0.4: 优先读 IndexedDB 缓存
            if (window.VectorCache) {
              const cached = await window.VectorCache.get('doc', d.text, apiKey);
              if (cached) {
                cacheCount++;
                return cached.vector;
              }
            }
            const r = await getEmbedding(d.text, { apiKey, networkUrl });
            if (r.source !== 'local-fallback' && r.vector.length > 0) {
              okCount++;
              if (window.VectorCache) {
                await window.VectorCache.set('doc', d.text, apiKey, r.vector);
              }
              return r.vector;
            }
            return null;
          } catch (e) {
            return null;
          }
        }));
        for (let j = 0; j < batch.length; j++) {
          if (results[j]) {
            index.docs.push(batch[j]);
            index.vectors.push(results[j]);
          } else {
            // 失败条目用 random 投影填充,确保 index 完整
            index.docs.push(batch[j]);
            index.vectors.push(textToVector(batch[j].text, VECTOR_DIM));
          }
        }
      }
      console.log(`[RAG] semantic index: ${okCount}/${docs.length} 用真 embedding, ${cacheCount}/${docs.length} 来自缓存, 余用 random 兜底`);
      return index;
    } catch (e) {
      console.warn('[RAG] semantic build 失败,完全降级 random:', e.message);
      const fallback = new VectorIndex(VECTOR_DIM);
      fallback.add(docs);
      return fallback;
    }
  },

  // v1.4 预热: 在浏览器空闲时提前构建,消除首次 AI 解读的 1-3s 等待
  // 用 requestIdleCallback 优先;不支持时降级 setTimeout
  prewarm() {
    if (this.ready || this._building) return;
    const run = () => this.build().catch(e => console.warn('[RAG.prewarm] 失败:', e));
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => run(), { timeout: 3000 });
    } else {
      setTimeout(run, 1500);
    }
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
          // 日主五行 — 来自 Expert.TG_WX 单一来源 (expert/tables.js)
          if (window.Expert && window.Expert.TG_WX && window.Expert.TG_WX[dayGan]) signals.push(window.Expert.TG_WX[dayGan] + pan.wangShuai);
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
    const { topK = 8, maxChars = 2500, source = null, minScore = 1.0, tags = null, useVector = true, domain = null } = opts;
    // 任务 #28:query 改写 — 把口语化问题转成 KB 术语
    let finalQuestion = question;
    try {
      if (window.QueryRewrite && question) {
        finalQuestion = window.QueryRewrite.rewriteQuery(question, domain || pan?.domain || null);
      }
    } catch (e) { console.warn('[RAG.search] query 改写失败:', e); }
    const query = this.extractSignals(pan, finalQuestion);

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

    // 任务 #24:重排序(取 3 倍候选,rerank 后取 topK,提升准确度)
    let ranked = fused;
    try {
      if (window.RAGRerank && fused.length > topK) {
        const candidates = fused.map(r => ({
          title: r.doc.title || '',
          text: r.doc.text || '',
          tags: r.doc.tags || [],
          score: r.score,
          _doc: r.doc
        }));
        const reranked = window.RAGRerank.rerankCandidates(question || query, candidates, topK);
        ranked = reranked.map(c => ({ doc: c._doc, score: c.finalScore }));
      }
    } catch (e) { console.warn('[RAG.search] 重排序失败,用原排序:', e); }

    // 7. 格式化输出
    const lines = ['【知识库相关片段（重排序精排）】'];
    let totalLen = 0;
    for (const r of ranked) {
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


// 暴露到 globalThis
if (typeof window !== 'undefined') window.RAG = RAG;
if (typeof globalThis !== 'undefined') globalThis.RAG = RAG;