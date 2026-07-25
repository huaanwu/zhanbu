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

  // ===== 工具函数 =====
  // (round-2 fix) 抽到 object 上做 sibling method,避免 case 内 function declaration 的 hoisting / strict-mode 风险
  _imgFingerprint(s) {
    return s ? s.slice(0, 96) + '|' + s.slice(s.length >> 1, (s.length >> 1) + 80) + '|' + s.slice(-80) : '∅';
  },

  // ===== 生成缓存 Key =====
  makeKey(domain, params) {
    // params 是各模块的特征对象
    const parts = [domain];
    // 区分本地/云端模型结果，避免切换模型后仍返回旧缓存
    parts.push(localStorage.getItem('use_local_model') === '1' ? 'model:local' : 'model:cloud');
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
        // v2: 六爻线序/纳甲/卦宫算法已纠正，隔离旧算法生成的错误解读缓存。
        parts.push('jingfang-v2');
        parts.push(params.gua?.name);
        parts.push((params.gua?.dongYaoList || []).join('-'));
        break;
      case 'xiaoliuren':
        parts.push(params.yueGong?.name, params.riGong?.name, params.shiGong?.name);
        break;
      case 'meihua':
        parts.push(params.gua?.name);
        parts.push(String(params.dong));
        break;
      case 'daliuren':
        // daliuren-v1: 九宗门算法首版,隔离未来算法修订的旧缓存
        parts.push('daliuren-v1');
        parts.push([params.dayGZ, params.yueJiang?.zhi, params.hourZhi].join('_'));
        parts.push((params.sanChuan || []).map(c => c.shen).join(''));
        break;
      case 'chenggu':
        // chenggu-v1: 称骨首版,隔离未来算法/数据表修订的旧缓存
        parts.push('chenggu-v1');
        parts.push([params.lunar?.yearGZ, params.lunar?.month, params.lunar?.day, params.lunar?.hourZhi].join('_'));
        break;
      case 'lingqian':
        // lingqian-v1: 灵签首版,隔离未来签文数据修订的旧缓存
        parts.push('lingqian-v1', params.kind, String(params.num));
        break;
      case 'qimen':
        // chaibu-v1: 定局改为拆补法符头定元,隔离旧'天数/5'算法的错误局数缓存。
        parts.push('chaibu-v1');
        parts.push(params.jushu_text);
        parts.push(params.bazi?.join('_'));
        break;
      case 'xingshi':
        parts.push(params.name);
        break;
      case 'fengshui':
        parts.push(params.address);
        break;
      case 'shouxiang': {
        // v3.0.5 + cleanup: _imgFingerprint 与 sxGender + keypoints 组合,
        // 4 图指纹用 forEach 去掉复制粘贴,linkPan 指纹用 lookup 对象遍历
        if (params.sxGender) parts.push('gender:' + params.sxGender);
        ['leftPalm', 'leftBack', 'rightPalm', 'rightBack'].forEach(function (k) {
          parts.push(this._imgFingerprint(params.images?.[k]));
        }, this);
        parts.push('kp:' + (params.keypoints ? 'yes' : 'no'));
        if (params.linkPan) {
          var lp = params.linkPan;
          // 按命盘类型→提取器 遍历:命中第一个真值就 push,否则 push 空 flag
          var lpKeys = [
            ['bazi-day', function () { return lp.bazi?.gz?.day; }],
            ['bazi',     function () { return lp.bazi; }],
            ['zw',       function () { var gz = lp.ziwei?.mingGong?.ganzhi; if (gz) return 'zw:' + gz; else if (lp.ziwei) return 'zw'; }],
            ['ly',       function () { if (lp.liuyao?.gua?.name) return 'ly:' + lp.liuyao.gua.name; else if (lp.liuyao) return 'ly'; }],
            ['qm',       function () { if (lp.qimen?.jushu_text) return 'qm:' + lp.qimen.jushu_text; else if (lp.qimen) return 'qm'; }],
          ];
          lpKeys.forEach(function (_a) {
            var key = _a[0], fn = _a[1];
            var v = fn();
            if (v) parts.push(key.startsWith('bazi') || key === 'zw' || key === 'ly' || key === 'qm' ? v : key);
          });
        }
        parts.push('sx-v3.0.5-fix');
        break;
      }
      case 'mianxiang': {
        // v3.0.8 面相首版:性别 + 3 张图(front/left45/right45)指纹 + 年龄段 + linkPan
        if (params.mxGender) parts.push('gender:' + params.mxGender);
        ['front', 'left45', 'right45'].forEach(function (k) {
          parts.push(this._imgFingerprint(params.images?.[k]));
        }, this);
        parts.push('age:' + (params.ageBucket || 'na'));
        if (params.linkPan) {
          var lp = params.linkPan;
          if (lp.bazi?.gz?.day) parts.push('bazi-day:' + lp.bazi.gz.day);
          else if (lp.bazi) parts.push('bazi');
          var zwGz = lp.ziwei?.mingGong?.ganzhi;
          if (zwGz) parts.push('zw:' + zwGz);
          else if (lp.ziwei) parts.push('zw');
        }
        parts.push('mx-v1');
        break;
      }
      case 'cross':
        // 三术同参包含六爻，同样不能复用旧六爻算法缓存。
        parts.push('jingfang-v2');
        parts.push(params.bazi?.gz?.day);
        parts.push(params.liuyao?.gua?.name);
        parts.push(params.ziwei?.mingGong?.ganzhi);
        break;
      case 'daofobuddhism':
        parts.push(params.question?.slice(0, 50) || 'no-question');
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
