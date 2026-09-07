/**
 * v2.0.4 全局类型声明 (JSDoc 提示,无运行时影响)
 *
 * 用法: 在 JS 文件顶部加 `// @ts-check` 即可启用本文件中的类型检查
 *
 * 目标: 给 IDE/编辑器提供 IntelliSense,捕获常见类型错误
 * 不强制 - 没有 @ts-check 的文件不检查,保持灵活性
 */

/**
 * 八字排盘结果
 * @typedef {Object} BaziPan
 * @property {Object} gz          - 四柱干支 {year, month, day, hour}
 * @property {string} gz.year
 * @property {string} gz.month
 * @property {string} gz.day
 * @property {string} gz.hour
 * @property {string} gender      - 'male' | 'female'
 * @property {Object} tenGods     - 十神表
 * @property {string} wangShuai   - 旺衰描述
 */

/**
 * 六爻排盘结果
 * @typedef {Object} LiuyaoPan
 * @property {string} method      - 起卦方法
 * @property {string} datetime
 * @property {Object} timeGanzhi  - {year, month, day, hour}
 * @property {Object} gua         - 卦象
 * @property {Array<Yao>} yaoList  - 6 爻
 * @property {Array<Yao>|null} bianYaoList - 变卦六爻
 * @property {Array<Yao>} fuShenList - 本卦缺失六亲对应的伏神
 * @property {string[]} xunKong - 日柱旬空地支
 * @property {string|null} huGua
 */

/**
 * 单爻
 * @typedef {Object} Yao
 * @property {number} yao          - 1-6
 * @property {string} name         - '初爻'..'上爻'
 * @property {'阴'|'阳'} yinYang
 * @property {string} gan
 * @property {string} zhi
 * @property {string} wuxing
 * @property {string} liuqin
 * @property {string} liushen
 * @property {boolean} isDong
 * @property {boolean} isShi
 * @property {boolean} isYing
 * @property {boolean} isXunKong
 * @property {Yao|null} fuShen
 */

/**
 * 奇门排盘结果
 * @typedef {Object} QimenPan
 * @property {string} jieqi
 * @property {number} days_in_jq
 * @property {boolean} yang_dun
 * @property {number} jushu
 * @property {string} jushu_text   - '阳遁X局' / '阴遁X局'
 * @property {string[]} bazi       - [年, 月, 日, 时]
 * @property {string} xunshou
 * @property {Array<QimenGong>} gong9
 * @property {string} shichen
 */

/**
 * 九宫格
 * @typedef {Object} QimenGong
 * @property {number} gong         - 洛书数 1-9
 * @property {string} name
 * @property {string} direction
 * @property {string} wuxing
 * @property {string} dipan
 * @property {string} tianpan
 * @property {string} jiuxing
 * @property {string} renpan
 * @property {string} shenpan
 * @property {boolean} is_dipan_zhifu
 * @property {boolean} is_tianpan_zhifu
 * @property {boolean} is_renpan_zhishi
 */

/**
 * 缓存条目
 * @typedef {Object} CacheEntry
 * @property {string} output      - AI 解读文本
 * @property {number} ts          - 创建时间戳
 * @property {number} at          - 最后访问时间戳
 */

/**
 * 历史记录条目
 * @typedef {Object} HistoryItem
 * @property {string} id
 * @property {number} ts
 * @property {string} domain      - 'bazi' | 'ziwei' | 'liuyao' | 'qimen' | etc.
 * @property {string} signal
 * @property {string} question
 * @property {string} output
 * @property {string|null} feedback - 'good' | 'partial' | 'bad' | null
 * @property {Object|null} panSnapshot
 */

/**
 * 反馈条目
 * @typedef {Object} FeedbackItem
 * @property {string} id
 * @property {string} timestamp
 * @property {string} domain
 * @property {string} question
 * @property {string} aiResponse
 * @property {number} rating      - 1-5
 * @property {string} accuracy    - '准确' | '部分准确' | '不准确'
 * @property {string} comment
 * @property {string} userCorrection
 * @property {string|Object} pan  - v1.4 加密后为 string
 */

/**
 * 对话会话条目
 * @typedef {Object} ChatSessionItem
 * @property {string} q
 * @property {string} a           - v1.4 加密后为 string,前缀 enc:v1:
 * @property {number} ts
 */

/**
 * @typedef {Object} Settings
 * @property {string} ds_api_key
 * @property {string} ds_model
 * @property {string} vision_api_key
 * @property {string} vision_model
 * @property {string} use_local_model - '1' | '0'
 * @property {string} local_server_ip
 * @property {string} local_server_port
 */

/**
 * Expert 专家系统 (www/expert.js)
 * @typedef {Object} ExpertModule
 * @property {function(string): string} chainOfThought
 * @property {function(string): string} fewshot
 * @property {function(BaziPan): string} bazi
 * @property {function(LiuyaoPan): string} liuyao
 * @property {function(QimenPan): string} qimen
 * @property {function(any): string} ziwei
 * @property {function(): string} cross
 */

/**
 * RAG 系统 (www/rag.js)
 * @typedef {Object} RAGModule
 * @property {function(): Promise<void>} build
 * @property {function(): void} prewarm
 * @property {function(any, string, Object=): string} search
 * @property {function(any, string): string[]} extractSignals
 * @property {string} embeddingBackend - 'semantic' | 'random'
 * @property {boolean} ready
 */

/**
 * 缓存系统 (www/cache.js)
 * @typedef {Object} CacheModule
 * @property {function(string, Object): string} makeKey
 * @property {function(string, Object): (string|null)} get
 * @property {function(string, Object, string): void} set
 * @property {function(): void} clear
 * @property {function(): {total: number, max: number}} stats
 */

/**
 * 加密模块 (www/crypto.js, v1.4)
 * @typedef {Object} CryptoModule
 * @property {function(string): Promise<string>} encrypt
 * @property {function(string): Promise<string>} decrypt
 * @property {function(Object): Promise<Object>} encryptObject
 * @property {function(Object): Promise<Object>} decryptObject
 * @property {function(): void} clearKey
 */

/**
 * 对话会话 (www/chat.js, v1.4)
 * @typedef {Object} ChatSessionModule
 * @property {function(string): ChatSessionItem[]} get
 * @property {function(string, string, string): Promise<void>} push
 * @property {function(string): Promise<ChatSessionItem[]>} getAllDecrypted
 * @property {function(string?): void} clear
 * @property {function(string): number} size
 */

/**
 * @global
 * @type {ExpertModule}
 */
var Expert;

/**
 * @global
 * @type {RAGModule}
 */
var RAG;

/**
 * @global
 * @type {CacheModule}
 */
var Cache;

/**
 * @global
 * @type {CryptoModule}
 */
var Crypto;

/**
 * @global
 * @type {ChatSessionModule}
 */
var ChatSession;

/**
 * @global
 * @type {Object}
 */
var History;

/**
 * @global
 * @type {Object}
 */
var Feedback;

/**
 * @global
 * @type {Object}
 */
var ABTest;

/**
 * @global
 * @type {Object}
 */
var liuyao;

/**
 * @global
 * @type {Object}
 */
var qimen;

/**
 * @global
 * @type {Object}
 */
var xingshi;

/**
 * @global
 * @type {string}
 */
var APP_VERSION;
