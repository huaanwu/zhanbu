/**
 * v3.0.1 Service Worker - 离线缓存
 *
 * 策略:
 *   - 静态资源 (JS/CSS/JSON bundle/字体/图片): cache-first, 后台异步更新
 *   - 导航请求: network-first, 失败 fallback 到缓存的 index.html
 *   - API 请求 (deepseek/ollama/etc): 完全跳过缓存
 *
 * 版本: 通过 CACHE_NAME 升级,旧缓存自动清空
 */

const CACHE_NAME = 'zhanbu-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  // JS 核心
  './app.js',
  './expert.js',
  './rag.js',
  './liuyao.js',
  './qimen.js',
  './xingshi.js',
  './visual.js',
  './cache.js',
  './ab_test.js',
  './feedback.js',
  './feedback-loop.js',
  './history.js',
  './crypto.js',
  './chat.js',
  // 离线库
  './lib/lunar.bundle.js',
  './lib/iztro.bundle.js',
  // KB bundles
  './kb_data/_bundles/kb_core.json',
  './kb_data/_bundles/kb_extended.json',
  './kb_data/_bundles/kb_specialty.json',
  // 图标
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 哪些 host 走 network (不缓存)
const NETWORK_ONLY_HOSTS = [
  'api.deepseek.com',
  'dashscope.aliyuncs.com',
  'openrouter.ai',
  'localhost', // 本地大模型端口
  '192.168.' // 局域网 IP
];

// 从 HTML/Manifest 文本中提取需要缓存的资源路径
function extractAssets(text) {
  const assets = new Set();
  const re = /(?:href|src|content)="([^"]+\.(?:css|js|png|jpg|jpeg|svg|webp|woff2?|ttf|otf|json)(?:\?[^"]*)?)"/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let url = m[1];
    // 保留绝对路径(同域)和相对路径;外部 URL 会在后续 fetch 时自然过滤
    assets.add(url);
  }
  return Array.from(assets);
}

self.addEventListener('install', (event) => {
  console.log('[SW] install, version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const toCache = new Set(STATIC_ASSETS);

      // 1) 拉取 index.html,解析其中引用的 assets(如 vite 构建后的 hash CSS/JS)
      const indexFetch = fetch('./index.html')
        .then(res => {
          if (!res.ok) return res;
          const clone = res.clone();
          return res.text().then(html => {
            extractAssets(html).forEach(u => {
              // 同域相对/绝对路径才缓存;跳过协议 URL
              if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//')) return;
              toCache.add(u);
            });
            return clone;
          });
        })
        .catch(err => {
          console.warn('[SW] 解析 index.html 资源失败:', err.message);
        });

      // 2) 拉取 manifest 中的图标/截图等
      const manifestFetch = fetch('./manifest.webmanifest')
        .then(res => {
          if (!res.ok) return res;
          return res.json().then(data => {
            if (data.icons) data.icons.forEach(i => i.src && toCache.add(i.src));
            if (data.shortcuts) data.shortcuts.forEach(s => {
              if (s.url) toCache.add(s.url);
              if (s.icons) s.icons.forEach(i => i.src && toCache.add(i.src));
            });
            if (data.screenshots) data.screenshots.forEach(s => s.src && toCache.add(s.src));
          });
        })
        .catch(err => {
          console.warn('[SW] 解析 manifest 失败:', err.message);
        });

      return Promise.all([indexFetch, manifestFetch]).then(() => {
        const list = Array.from(toCache);
        console.log('[SW] 预缓存', list.length, '项');
        return cache.addAll(list).catch(err => {
          console.warn('[SW] 预缓存部分失败(非致命):', err.message);
          // 部分资源缺失不阻塞 SW 安装
        });
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] 删除旧缓存:', k);
        return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) 跳过非 GET
  if (req.method !== 'GET') return;

  // 2) API 请求: 始终走 network,不缓存
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h) || url.hostname.startsWith(h))) {
    return; // 不拦截,让浏览器直接处理
  }

  // 3) 导航请求 (HTML): network-first, 失败 fallback 缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        // 同时更新缓存
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 4) 静态资源: cache-first, 后台更新
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // 缓存命中,后台异步更新
        fetch(req).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(req, res));
          }
        }).catch(() => {});
        return cached;
      }
      // 缓存未命中,fetch + 缓存
      return fetch(req).then(res => {
        if (res.ok && (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'file:')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // 完全失败 (离线 + 未缓存): 返回通用 fallback
        if (req.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return new Response('离线且未缓存', { status: 503 });
      });
    })
  );
});

// 接收消息: 强制更新 / 清除缓存
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
});
