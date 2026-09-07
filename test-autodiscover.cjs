
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 切换到设置页
  await page.click('#navSettings');
  await page.waitForTimeout(500);
  
  // 点击自动发现
  console.log('Clicking auto discover...');
  await page.click('button:has-text("🔍 自动发现")');
  
  // 等待 15 秒观察结果
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const status = await page.$eval('#discoverStatus', el => el.textContent).catch(() => 'N/A');
    const ip = await page.$eval('#localServerIpInput', el => el.value).catch(() => 'N/A');
    const port = await page.$eval('#localServerPortInput', el => el.value).catch(() => 'N/A');
    const model = await page.$eval('#localModelNameInput', el => el.value).catch(() => 'N/A');
    console.log(`[${i+1}s] status: ${status}, ip: ${ip}, port: ${port}, model: ${model}`);
  }
  
  await browser.close();
})();
