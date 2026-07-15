/**
 * RAG · 分词与文档扁平化 v1.0
 * --------------------------------------------------
 * 提供:
 *   - STOP_WORDS: 中文停用词集合
 *   - tokenize(text): 1/2/3 元组分词(BM25 与向量检索共用)
 *   - flattenKB(kb, sourceName): KB JSON → 扁平 docs 数组, 自动打标签
 *
 * 加载顺序: 必须最先, 被 rag/bm25.js 和 rag/vector.js 依赖
 */

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

// 显式导出 const(浏览器 script const 不会挂到 window)
if (typeof window !== 'undefined') window.STOP_WORDS = STOP_WORDS;
if (typeof globalThis !== 'undefined') globalThis.STOP_WORDS = STOP_WORDS;

// 显式导出 function(CommonJS module 中 function 顶层声明不会挂到 globalThis)
if (typeof window !== 'undefined') { window.STOP_WORDS = STOP_WORDS; window.tokenize = tokenize; window.flattenKB = flattenKB; }
if (typeof globalThis !== 'undefined') { globalThis.STOP_WORDS = STOP_WORDS; globalThis.tokenize = tokenize; globalThis.flattenKB = flattenKB; }
