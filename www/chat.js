/**
 * 追问/多轮对话会话存储 (v1.4)
 *
 * 用法:
 *   const cs = ChatSession.get('bazi');
 *   cs.push({ q, a, ts });     // 追加一条 Q&A
 *   const history = cs.getAll();
 *   cs.clear();                 // 重建对话
 *
 * 数据结构 (localStorage key: divination_chat_v1):
 *   { bazi: [{q,a,ts}, ...], ziwei: [...], ... }
 *
 * 注意:
 *   - 每个域独立会话
 *   - a (AI 回答) 走 AES-GCM 加密 (与 history 一致)
 *   - 最多保留 20 轮/域, 超过 LRU 淘汰
 */

const ChatSession = {
  KEY: 'divination_chat_v1',
  MAX_PER_DOMAIN: 20,

  _data: null,

  _load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(this.KEY);
      this._data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[ChatSession] 加载失败,重置:', e.message);
      this._data = {};
    }
    // 确保每个域有数组
    for (const d of ['bazi', 'ziwei', 'liuyao', 'qimen', 'cross', 'fengshui', 'xingshi']) {
      if (!Array.isArray(this._data[d])) this._data[d] = [];
    }
    return this._data;
  },

  _save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('[ChatSession] 保存失败:', e.message);
    }
  },

  // 获取域的会话 (返回数组引用,直接 push)
  get(domain) {
    return this._load()[domain];
  },

  // 追加一条 Q&A
  async push(domain, q, a) {
    if (!domain || !q) return;
    const arr = this.get(domain);
    // 加密 a 字段(如果有 Crypto 模块)
    let encA = a;
    if (a && window.Crypto) {
      try { encA = await window.Crypto.encrypt(a); } catch (e) { /* 降级明文 */ }
    }
    arr.push({ q, a: encA, ts: Date.now() });
    // LRU 淘汰
    if (arr.length > this.MAX_PER_DOMAIN) {
      arr.splice(0, arr.length - this.MAX_PER_DOMAIN);
    }
    this._save();
  },

  // 获取所有历史 (Q&A 对),自动解密 a 字段
  // 注: 这个方法因解密是 async,需要外部 await
  async getAllDecrypted(domain) {
    const arr = this.get(domain);
    if (!arr || arr.length === 0) return [];
    if (!window.Crypto) return arr.slice();
    const out = [];
    for (const item of arr) {
      const decA = await window.Crypto.decrypt(item.a);
      out.push({ q: item.q, a: decA, ts: item.ts });
    }
    return out;
  },

  // 清除某域会话
  clear(domain) {
    if (domain) {
      this._load()[domain] = [];
    } else {
      // 清空所有
      for (const d of Object.keys(this._data || {})) {
        this._data[d] = [];
      }
    }
    this._save();
  },

  // 获取会话长度
  size(domain) {
    return (this.get(domain) || []).length;
  }
};

window.ChatSession = ChatSession;
