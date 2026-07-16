
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 切换到道佛页面
  await page.click('#navDaofobuddhism');
  await page.waitForTimeout(1000);
  
  // 点击摇签
  console.log('Clicking draw qian...');
  await page.click('#qianIdle');
  
  // 等待 5 秒观察
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    const shaking = await page.$eval('#qianShaking', el => el.style.display).catch(() => 'N/A');
    const result = await page.$eval('#qianResult', el => el.style.display).catch(() => 'N/A');
    const resultHtml = await page.$eval('#qianResult', el => el.innerHTML.slice(0, 80)).catch(() => 'N/A');
    console.log(`[${i+1}s] shaking: ${shaking}, result: ${result}, html: ${resultHtml}...`);
  }
  
  await browser.close();
})();
