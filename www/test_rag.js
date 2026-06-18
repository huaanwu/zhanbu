// RAG 检索测试 - 通过浏览器全局 window.RAG 访问
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const ctx = dom.window;

global.window = ctx;
global.document = ctx.document;
global.fetch = (url) => {
  const fs = require('fs');
  const path = require('path');
  const localPath = path.join('..', url);
  if (fs.existsSync(localPath)) {
    return Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(localPath, 'utf-8'))) });
  }
  return Promise.reject(new Error('not found: ' + url));
};

const fs = require('fs');
const code = fs.readFileSync('rag.js', 'utf-8');
// 让 eval 后的赋值写到 ctx（window）上
const wrapped = code.replace(/^const RAG = /m, 'ctx.RAG = ');
ctx.eval(wrapped);

ctx.RAG.build().then(() => {
  console.log('=== 测试 1: 问事业发展，乾卦 ===');
  const r1 = ctx.RAG.search(
    { gua: { name: '乾为天' }, yaoList: [
      {gan:'甲',zhi:'子',wuxing:'水',liuqin:'兄弟',liushen:'青龙'},
      {gan:'甲',zhi:'寅',wuxing:'木',liuqin:'妻财',liushen:'朱雀'},
      {gan:'甲',zhi:'辰',wuxing:'土',liuqin:'父母',liushen:'勾陈'},
      {gan:'壬',zhi:'午',wuxing:'火',liuqin:'官鬼',liushen:'螣蛇'},
      {gan:'壬',zhi:'申',wuxing:'金',liuqin:'父母',liushen:'白虎'},
      {gan:'壬',zhi:'戌',wuxing:'土',liuqin:'妻财',liushen:'玄武'}
    ] },
    '问事业发展'
  );
  console.log(r1);

  console.log('=== 测试 2: 问财运，八字甲木日主 ===');
  const r2 = ctx.RAG.search(
    { gz: { day: '甲子', year: '庚午', month: '戊辰', hour: '壬申' },
      tenGods: { year_gan: '偏财', month_gan: '偏印', day_gan: '比肩', hour_gan: '偏印' } },
    '财运如何'
  );
  console.log(r2);

  console.log('=== 测试 3: 问奇门生门方位 ===');
  const r3 = ctx.RAG.search(
    { gong9: [{name:'艮八宫', jiuxing:'天任', renpan:'生门', shenpan:'直符', dipan:'戊', tianpan:'壬'}] },
    '求财看什么宫'
  );
  console.log(r3);
});
