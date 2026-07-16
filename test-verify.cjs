
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 检查是否有 Vite 错误覆盖层
  const hasErrorOverlay = await page.$('vite-error-overlay') !== null;
  console.log('Has Vite error overlay:', hasErrorOverlay);
  
  // 检查道佛页面是否能正常点击
  await page.click('#navDaofobuddhism');
  await page.waitForTimeout(1000);
  
  // 点击摇签
  await page.click('#qianIdle');
  await page.waitForTimeout(2500);
  
  const shaking = await page.$eval('#qianShaking', el => el.style.display).catch(() => 'N/A');
  const result = await page.$eval('#qianResult', el => el.style.display).catch(() => 'N/A');
  console.log('After drawQian - shaking:', shaking, 'result:', result);
  
  await browser.close();
})();
