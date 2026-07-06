/**
 * v3.0.4 IndexedDB 嵌入向量缓存
 *
 * 用途:
 *   - 缓存 RAG 文档 embedding(构建索引时复用,避免每次启动都调 API)
 *   - 缓存查询 embedding(同一问题多次解读时复用)
 *
 * 设计:
 *   - key: 文本哈希 + API key 哈希前缀(避免跨 key 串用)
 *   - value: { key, vector: number[], createdAt }
 *   - 向量本身与模型/文本一一对应,无 TTL;升级版本时统一清空
 */

const VECTOR_CACHE_DB = 'zhanbu-vectors';
const VECTOR_CACHE_STORE = 'embeddings';
const VECTOR_CACHE_VERSION = 1;

function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h &= 0xffffffff;
  }
  return h.toString(36);
}

function keyPrefix(type, seed) {
  return `emb:${type}:${seed}:`;
}

function makeKey(type, text, apiKey) {
  const keyHash = apiKey ? simpleHash(apiKey).slice(0, 8) : 'rand';
  return keyPrefix(type, keyHash) + simpleHash(text);
}

class VectorCache {
  constructor() {
    this._db = null;
  }

  async _open() {
    if (this._db) return this._db;
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(VECTOR_CACHE_DB, VECTOR_CACHE_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(VECTOR_CACHE_STORE)) {
          db.createObjectStore(VECTOR_CACHE_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  async get(type, text, apiKey) {
    try {
      const db = await this._open();
      if (!db) return null;
      const key = makeKey(type, text, apiKey);
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_CACHE_STORE, 'readonly');
        const store = tx.objectStore(VECTOR_CACHE_STORE);
        const req = store.get(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const data = req.result;
          if (data && Array.isArray(data.vector) && data.vector.length > 0) {
            resolve({ vector: new Float32Array(data.vector), source: 'cache' });
          } else {
            resolve(null);
          }
        };
      });
    } catch (e) {
      console.warn('[VectorCache] get 失败:', e.message);
      return null;
    }
  }

  async set(type, text, apiKey, vector) {
    try {
      const db = await this._open();
      if (!db) return;
      const key = makeKey(type, text, apiKey);
      const arr = vector instanceof Float32Array ? Array.from(vector) : vector;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(VECTOR_CACHE_STORE);
        const req = store.put({ key, vector: arr, createdAt: Date.now() });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      });
    } catch (e) {
      console.warn('[VectorCache] set 失败:', e.message);
    }
  }

  async clear() {
    try {
      const db = await this._open();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(VECTOR_CACHE_STORE);
        const req = store.clear();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      });
    } catch (e) {
      console.warn('[VectorCache] clear 失败:', e.message);
    }
  }

  // 按 key 前缀清空(例如换 API key 时)
  async clearByPrefix(prefix) {
    try {
      const db = await this._open();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(VECTOR_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(VECTOR_CACHE_STORE);
        const req = store.openCursor();
        req.onerror = () => reject(req.error);
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) { resolve(); return; }
          if (cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        };
      });
    } catch (e) {
      console.warn('[VectorCache] clearByPrefix 失败:', e.message);
    }
  }
}

window.VectorCache = new VectorCache();
window.VectorCache.makeKey = makeKey;
