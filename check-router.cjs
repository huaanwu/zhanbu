const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 1. 检查路由函数
  const router = await page.evaluate(() => ({
    switchPage: typeof window.switchPage,
    showPage: typeof window.showPage,
    currentPage: window.currentPage || 'unknown',
    pages: Array.from(document.querySelectorAll('.page')).map(p => p.id).slice(0,15),
  }));
  console.log('路由状态:', JSON.stringify(router, null, 2).slice(0,600));

  // 2. 直接调用 switchPage 看是否切换
  if (router.switchPage === 'function') {
    await page.evaluate(() => window.switchPage('daofobuddhism'));
    await page.waitForTimeout(3000);
    const body = await page.evaluate(() => document.body.innerText.slice(0,200));
    console.log('switchPage后页面:', body.replace(/\s+/g,' ').slice(0,150));
  }

  // 3. 检查 visible page
  const visible = await page.evaluate(() => {
    const vis = Array.from(document.querySelectorAll('.page')).filter(p => p.offsetParent !== null);
    return vis.map(p => p.id);
  });
  console.log('可见页面:', JSON.stringify(visible));

  // 4. 检查底部导航按钮
  const navBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.nav-btn, .bottom-nav button, nav button')).map(b => b.innerText.trim());
  });
  console.log('导航按钮:', JSON.stringify(navBtns));

  console.log('JS错误:', errors.length, errors.slice(0,3).join('|').slice(0,200));
  await page.screenshot({ path: 'check-router.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
