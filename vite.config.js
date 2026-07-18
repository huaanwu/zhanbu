import { defineConfig } from 'vite'

export default defineConfig({
  root: 'www',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 不处理 CSS,styles.css 保持原样在 www/ 根目录被 index.html 引用
    cssCodeSplit: false
  },
  server: {
    port: 3002
  }
})