/**
 * 命理专家系统 v1.0 (加载器/索引)
 * --------------------------------------------------
 * 真正实现在 www/expert/ 目录下的 6 个文件中(tables.js + 5 模块)
 * 此文件仅为向后兼容保留, 浏览器/测试环境通过 <script src="expert/*.js">
 * 顺序加载; 旧代码 var Expert = window.Expert 仍可工作
 *
 * 加载顺序(由 index.html 控制):
 *   lib/ganzhi.js → expert/tables.js → expert/bazi.js →
 *   expert/liuyao.js → expert/qimen.js → expert/ziwei.js → expert/chain.js
 */
var Expert = window.Expert || globalThis.Expert || {};
