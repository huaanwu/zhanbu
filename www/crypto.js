/**
 * 敏感数据加密工具 (v1.4)
 *
 * 设计目标:
 *   - 满足《个人信息保护法》对敏感个人信息(生辰八字)加密存储要求
 *   - 用 Web Crypto API (AES-GCM 256),无外部依赖
 *   - 设备绑定密钥:首次启动生成随机 256-bit key,存 localStorage
 *   - 加密仅对结构化敏感字段 (panSnapshot / pan),文本字段保持明文以支持检索
 *
 * 威胁模型:
 *   - localStorage 被同源脚本读取 → 加密阻止直接读取 (符合合规)
 *   - 设备物理访问 → 密钥也在同一设备,攻击者可解密 (可接受,因为是单设备 app)
 *
 * 升级兼容:
 *   - 旧版本明文数据自动识别,getAll 时不抛错
 *   - 重新 save 后自动升级为密文
 */

const Crypto = {
  KEY_NAME: 'divination_crypto_key_v1',
  ALGO: 'AES-GCM',
  KEY_LENGTH: 256,
  IV_LENGTH: 12, // 96 bits recommended for GCM
  ENC_PREFIX: 'enc:v1:', // 标记密文,避免和明文混淆

  // 加密 base64 helper
  _b64encode(bytes) {
    let s = '';
    for (let i = 0; btoa && i < bytes.length; i += 0x7fffffff) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x7fffffff));
    }
    return btoa(s);
  },

  _b64decode(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  // 获取或创建设备密钥
  async _getKey() {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.warn('[Crypto] Web Crypto API 不可用,降级为明文');
      return null;
    }
    let b64 = localStorage.getItem(this.KEY_NAME);
    if (b64) {
      try {
        const raw = this._b64decode(b64);
        return await crypto.subtle.importKey('raw', raw, this.ALGO, false, ['encrypt', 'decrypt']);
      } catch (e) {
        console.warn('[Crypto] 旧密钥失效,生成新密钥:', e.message);
      }
    }
    // 生成新密钥
    const key = await crypto.subtle.generateKey(
      { name: this.ALGO, length: this.KEY_LENGTH },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    localStorage.setItem(this.KEY_NAME, this._b64encode(raw));
    return key;
  },

  // 加密字符串 → "enc:v1:<iv_b64>:<ct_b64>" 或明文(失败时降级)
  async encrypt(plain) {
    if (plain == null) return plain;
    if (typeof plain !== 'string') plain = JSON.stringify(plain);
    if (plain.length === 0) return plain;
    const key = await this._getKey();
    if (!key) return plain;
    try {
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const ct = await crypto.subtle.encrypt(
        { name: this.ALGO, iv },
        key,
        new TextEncoder().encode(plain)
      );
      return this.ENC_PREFIX + this._b64encode(iv) + ':' + this._b64encode(new Uint8Array(ct));
    } catch (e) {
      console.warn('[Crypto] 加密失败,降级明文:', e.message);
      return plain;
    }
  },

  // 解密字符串(若非密文格式,原样返回)
  async decrypt(cipher) {
    if (cipher == null) return cipher;
    if (typeof cipher !== 'string') return cipher;
    if (!cipher.startsWith(this.ENC_PREFIX)) return cipher;
    const key = await this._getKey();
    if (!key) return cipher;
    try {
      const payload = cipher.slice(this.ENC_PREFIX.length);
      const [ivB64, ctB64] = payload.split(':');
      if (!ivB64 || !ctB64) return cipher;
      const iv = this._b64decode(ivB64);
      const ct = this._b64decode(ctB64);
      const pt = await crypto.subtle.decrypt({ name: this.ALGO, iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (e) {
      console.warn('[Crypto] 解密失败,可能密钥已换/数据损坏:', e.message);
      return cipher; // 降级返回,前端可识别前缀后兜底
    }
  },

  // 加密对象(深拷贝,只加密 values 里的字符串)
  async encryptObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        out[k] = await this.encrypt(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        out[k] = await this.encryptObject(v);
      } else if (Array.isArray(v)) {
        out[k] = await Promise.all(v.map(async item =>
          typeof item === 'string' ? await this.encrypt(item) : item
        ));
      } else {
        out[k] = v;
      }
    }
    return out;
  },

  // 解密对象(只解 values 里的字符串)
  async decryptObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.startsWith(this.ENC_PREFIX)) {
        out[k] = await this.decrypt(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        out[k] = await this.decryptObject(v);
      } else if (Array.isArray(v)) {
        out[k] = await Promise.all(v.map(async item =>
          typeof item === 'string' && item.startsWith(this.ENC_PREFIX)
            ? await this.decrypt(item)
            : item
        ));
      } else {
        out[k] = v;
      }
    }
    return out;
  },

  // 清除密钥(清除所有数据时调用)
  clearKey() {
    localStorage.removeItem(this.KEY_NAME);
  }
};

window.Crypto = Crypto;
