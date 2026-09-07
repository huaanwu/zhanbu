
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // 切换到八字页面
  await page.click('#navBazi');
  await page.waitForTimeout(1000);
  
  // 填写八字表单 (input 不是 select)
  await page.fill('#baziYear', '2026');
  await page.fill('#baziMonth', '6');
  await page.fill('#baziDay', '15');
  await page.fill('#baziHour', '12');
  await page.click('#baziGenderMale');
  
  // 点击排盘
  await page.click('#baziCalcBtn');
  await page.waitForTimeout(2000);
  
  // 点击 AI 解读按钮
  console.log('Clicking AI解读 button...');
  await page.click('#baziAIBtn');
  
  // 等待 30 秒观察
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const btnText = await page.$eval('#baziAIBtn', el => el.textContent).catch(() => 'N/A');
    const contentText = await page.$eval('#baziAIContent', el => el.textContent.slice(0, 80)).catch(() => 'N/A');
    console.log(`[${i+1}s] btn: ${btnText}, content: ${contentText}...`);
  }
  
  await browser.close();
})();
