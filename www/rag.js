/**
 * RAG 知识库检索引擎 v1.0 (加载器/索引)
 * --------------------------------------------------
 * 真正实现在 www/rag/ 目录下 5 个模块中
 * 加载顺序: rag/tokenizer.js -> rag/bm25.js -> rag/vector.js -> rag/rrf.js -> rag/index.js
 *
 * 此文件保留仅为向后兼容: 旧引用 var RAG = ... 仍可工作
 */
var RAG = window.RAG || globalThis.RAG || {};
