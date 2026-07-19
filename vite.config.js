import { defineConfig } from 'vite'

export default defineConfig({
  root: 'www',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 不处理 CSS,styles.css 保持原样在 www/ 根目录被 index.html 引用
    cssCodeSplit: false,
    // v3.0.5 + fix: shouxiang-mp.js / xingshi.js 等非 module 域名脚本不参与 Vite bundle
    // (shouxiang-mp.js 用 const 声明 + CDN 加载,不是 ES module;Vite 默认会报 'can't be bundled')
    // 同时外部化 index-T4xbWfZb.js (该文件在 index.html 首行 <script type="module"> 引用,
    // Vite 期望自己在构建阶段生成,但这个项目走 build-web.mjs 把 dist 合并回 www/
    // 所以预构建的 asset 路径在 `npm run build` 环境下不可及 — 直接外部化让 index.html 自己引用)
    rollupOptions: {
      external: ['/assets/index-T4xbWfZb.js', '/app/shouxiang-mp.js', '/app/xingshi.js', '/app/cross.js', '/app/fengshui.js', '/app/daofobuddhism.js']
    }
  },
  server: {
    port: 3002
  }
})