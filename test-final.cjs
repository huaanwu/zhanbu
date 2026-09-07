
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 1. 检查没有 Vite 错误覆盖层
  const hasErrorOverlay = await page.$('vite-error-overlay') !== null;
  console.log('1. Has Vite error overlay:', hasErrorOverlay);
  
  // 2. 切换到道佛页面，测试摇签
  await page.click('#navDaofobuddhism');
  await page.waitForTimeout(1000);
  await page.click('#qianIdle');
  await page.waitForTimeout(2500);
  const shaking = await page.$eval('#qianShaking', el => el.style.display).catch(() => 'N/A');
  const result = await page.$eval('#qianResult', el => el.style.display).catch(() => 'N/A');
  console.log('2. Draw qian - shaking:', shaking, 'result:', result);
  
  // 3. 切换到设置页，检查本地模型名输入字段
  await page.click('#navSettings');
  await page.waitForTimeout(500);
  const hasModelNameInput = await page.$('#localModelNameInput') !== null;
  console.log('3. Has localModelNameInput:', hasModelNameInput);
  
  // 4. 检查默认端口
  const portValue = await page.$eval('#localServerPortInput', el => el.value).catch(() => 'N/A');
  console.log('4. Default port:', portValue);
  
  await browser.close();
})();
