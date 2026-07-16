
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 拦截 console 日志
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  
  // 阻止 Service Worker 干扰
  await page.route('**/sw.js', route => route.fulfill({ status: 404 }));
  
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 切换到八字页面
  await page.click('#navBazi');
  await page.waitForTimeout(1000);
  
  // 填写八字表单
  await page.selectOption('#baziYear', '2026');
  await page.selectOption('#baziMonth', '6');
  await page.selectOption('#baziDay', '15');
  await page.selectOption('#baziHour', '12');
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
    const contentText = await page.$eval('#baziAIContent', el => el.textContent.slice(0, 50)).catch(() => 'N/A');
    console.log(`[${i+1}s] btn: ${btnText}, content: ${contentText}...`);
  }
  
  await browser.close();
})();
