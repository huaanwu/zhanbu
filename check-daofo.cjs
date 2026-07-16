const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. 检查函数是否存在
  const exposed = await page.evaluate(() => ({
    drawQian: typeof window.drawQian,
    switchDfTab: typeof window.switchDfTab,
    getQianFromKB: typeof window.getQianFromKB,
    kbDaoismBuddhismOnDemand: typeof window.kbDaoismBuddhismOnDemand,
  }));
  console.log('道佛函数暴露:', JSON.stringify(exposed));

  // 2. 进入道佛页面
  await page.click('text=道佛').catch(()=>{});
  await page.waitForTimeout(3000);
  const body0 = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('道佛页面内容:', body0.replace(/\s+/g,' ').slice(0,150));

  // 3. 直接调用 drawQian 看是否卡住
  const qianResult = await Promise.race([
    page.evaluate(async () => { try { const r = await window.drawQian(); return 'resolved: ' + JSON.stringify(r).slice(0,100); } catch(e){ return 'error: ' + e.message; } }),
    new Promise(r => setTimeout(() => r('TIMEOUT 8s'), 8000))
  ]);
  console.log('drawQian调用:', qianResult);

  // 4. 检查符箓 KB 加载
  await page.evaluate(() => window.switchDfTab && window.switchDfTab('fulu'));
  await page.waitForTimeout(6000);
  const body1 = await page.evaluate(() => document.body.innerText);
  const fuluStuck = /加载知识库|正在加载/.test(body1) && !/符|敕|咒/.test(body1);
  console.log('符箓KB卡住:', fuluStuck ? 'YES(问题)' : 'NO(正常)', body1.slice(0,120).replace(/\s+/g,' '));

  console.log('JS错误:', errors.length, errors.slice(0,3).join('|').slice(0,250));
  await page.screenshot({ path: 'check-daofo.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
