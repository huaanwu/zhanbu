const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(4000);

  // 设置本地模型
  await page.evaluate(() => {
    localStorage.setItem('zhanbu_settings', JSON.stringify({
      apiKey: '', model: 'local', localModelEnabled: true,
      localServerIp: '127.0.0.1', localServerPort: 8082
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 排盘
  await page.evaluate(() => window.switchPage('bazi'));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.doBazi && window.doBazi());
  await page.waitForTimeout(5000);

  // 点 AI 解读
  const aiBtn = await page.$('button:has-text("AI 解读"), button:has-text("AI解读")');
  if (!aiBtn) { console.log('找不到AI解读按钮'); await browser.close(); process.exit(1); }
  await aiBtn.click();
  console.log('已点击AI解读');

  // 等待结果（本地模型最多 90s）
  let got = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    const body = await page.evaluate(() => document.querySelector('#baziAIContent')?.innerText || '');
    if (body.length > 80 && /命局|五行|日主|格局|运势|分析/.test(body)) { got = true; console.log('AI解读返回，第', i, '轮'); break; }
    if (i === 29) console.log('90s 无结果');
  }
  console.log('本地AI解读:', got ? 'OK' : 'FAIL');

  const content = await page.evaluate(() => document.querySelector('#baziAIContent')?.innerText || '');
  console.log('解读内容:', content.slice(0, 200).replace(/\s+/g, ' '));
  console.log('JS错误:', errors.length, errors.slice(0,2).join('|').slice(0,200));
  await page.screenshot({ path: 'test-ai.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
