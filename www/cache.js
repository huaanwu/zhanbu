/**
 * 解读缓存系统
 * 相同命盘/卦象重复查询时直接返回缓存，减少 API 调用、提升响应速度
 *
 * 缓存策略：
 *   - Key：基于输入参数的确定性哈希
 *   - Value：{ output, ts, ver }
 *   - TTL：7 天
 *   - 容量：最多 50 条（LRU 淘汰）
 *   - APP 版本升级时自动清除旧版本缓存
 */

const Cache = {
  CONFIG: {
    MAX_ENTRIES: 50,
    TTL_DAYS: 7,
    STORAGE_KEY: 'divination_cache_v1',
    VERSION_KEY: 'divination_cache_version',
    ACCESS_ORDER_KEY: 'divination_cache_access_order'
  },

  // ===== 初始化：版本升级时清除旧缓存 =====
  init() {
    const savedVer = localStorage.getItem(this.CONFIG.VERSION_KEY);
    const appVer = window.APP_VERSION || 'unknown';
    if (savedVer !== appVer) {
      console.log('[Cache] 版本升级:', savedVer, '->', appVer, '清除旧缓存');
      this.clear();
      localStorage.setItem(this.CONFIG.VERSION_KEY, appVer);
    }
    // 恢复访问顺序
    this._accessOrder = JSON.parse(localStorage.getItem(this.CONFIG.ACCESS_ORDER_KEY)) || [];
  },

  // ===== 生成缓存 Key =====
  makeKey(domain, params) {
    // params 是各模块的特征对象
    const parts = [domain];
    switch (domain) {
      case 'bazi':
        parts.push(params.gz?.year, params.gz?.month, params.gz?.day, params.gz?.hour);
        parts.push(params.gender);
        break;
      case 'ziwei':
        parts.push(params.mingGong?.ganzhi);
        parts.push(params.gender);
        break;
      case 'liuyao':
        parts.push(params.gua?.name);
        parts.push((params.gua?.dongYaoList || []).join('-'));
        break;
      case 'qimen':
        parts.push(params.jushu_text);
        parts.push(params.bazi?.join('_'));
        break;
      case 'xingshi':
        parts.push(params.name);
        break;
      case 'fengshui':
        parts.push(params.address);
        break;
      case 'shouxiang':
        // 手相用图片 base64 的前 100 个字符作为指纹
        parts.push(params.leftBase64?.slice(0, 100) || 'no-left');
        parts.push(params.rightBase64?.slice(0, 100) || 'no-right');
        break;
      case 'cross':
        parts.push(params.bazi?.gz?.day);
        parts.push(params.liuyao?.gua?.name);
        parts.push(params.ziwei?.mingGong?.ganzhi);
        break;
      default:
        parts.push(JSON.stringify(params));
    }
    // 问题文本也参与 key（同一命盘不同问题，解读不同）
    if (params.question) {
      parts.push(params.question.slice(0, 50)); // 取前50字符避免 key 过长
    }
    return parts.join('|');
  },

  // ===== 读取缓存 =====
  get(domain, params) {
    try {
      const key = this.makeKey(domain, params);
      const raw = localStorage.getItem(this.CONFIG.STORAGE_KEY);
      if (!raw) return null;
      const store = JSON.parse(raw);
      const entry = store[key];
      if (!entry) return null;

      // 检查过期
      const ttlMs = this.CONFIG.TTL_DAYS * 86400000;
      if (Date.now() - entry.ts > ttlMs) {
        delete store[key];
        this._removeFromAccessOrder(key);
        this._saveStore(store);
        return null;
      }

      // 更新访问时间（LRU）
      entry.at = Date.now();

      // 将 key 移到 _accessOrder 末尾
      this._removeFromAccessOrder(key);
      this._accessOrder.push(key);
      this._saveAccessOrder();

      this._saveStore(store);

      return entry.output;
    } catch (e) {
      console.warn('[Cache] 读取失败:', e);
      return null;
    }
  },

  // ===== 写入缓存 =====
  set(domain, params, output) {
    try {
      if (!output || output.length < 10) return; // 太短不缓存

      const key = this.makeKey(domain, params);
      const raw = localStorage.getItem(this.CONFIG.STORAGE_KEY);
      const store = raw ? JSON.parse(raw) : {};

      store[key] = {
        output,
        ts: Date.now(),   // 创建时间
        at: Date.now()    // 最后访问时间
      };

      // LRU 淘汰：如果超过最大条目数，删除最久未访问的
      const keys = Object.keys(store);
      if (keys.length > this.CONFIG.MAX_ENTRIES) {
        // 使用 splice(0,1) 删除最旧的
        const oldest = this._accessOrder.splice(0, 1)[0];
        if (oldest && store[oldest]) {
          delete store[oldest];
          console.log('[Cache] LRU 淘汰:', oldest);
        }
      }

      // 添加到访问顺序末尾
      this._removeFromAccessOrder(key);
      this._accessOrder.push(key);
      this._saveAccessOrder();

      this._saveStore(store);
    } catch (e) {
      console.warn('[Cache] 写入失败:', e);
    }
  },

  // ===== 内部方法 =====
  _removeFromAccessOrder(key) {
    const idx = this._accessOrder.indexOf(key);
    if (idx !== -1) {
      this._accessOrder.splice(idx, 1);
    }
  },

  _saveStore(store) {
    localStorage.setItem(this.CONFIG.STORAGE_KEY, JSON.stringify(store));
  },

  _saveAccessOrder() {
    localStorage.setItem(this.CONFIG.ACCESS_ORDER_KEY, JSON.stringify(this._accessOrder));
  },

  // ===== 统计信息 =====
  stats() {
    try {
      const raw = localStorage.getItem(this.CONFIG.STORAGE_KEY);
      if (!raw) return { total: 0, hitRate: 0 };
      const store = JSON.parse(raw);
      const keys = Object.keys(store);
      const ttlMs = this.CONFIG.TTL_DAYS * 86400000;
      const valid = keys.filter(k => Date.now() - store[k].ts <= ttlMs);
      return { total: valid.length, max: this.CONFIG.MAX_ENTRIES };
    } catch (e) {
      return { total: 0, max: this.CONFIG.MAX_ENTRIES };
    }
  },

  // ===== 清除所有缓存 =====
  clear() {
    localStorage.removeItem(this.CONFIG.STORAGE_KEY);
    localStorage.removeItem(this.CONFIG.ACCESS_ORDER_KEY);
    this._accessOrder = [];
  }
};

// 初始化
Cache.init();
window.Cache = Cache;
