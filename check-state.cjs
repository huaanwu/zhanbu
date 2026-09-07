const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.click('text=八字').catch(() => {});
  await page.waitForTimeout(1200);
  const btn = await page.$('button:has-text("开始排盘"), button:has-text("排盘")');
  if (btn) await btn.click();
  await page.waitForTimeout(5000);
  const body1 = await page.evaluate(() => document.body.innerText);
  console.log('排盘结果:', /年柱|日柱|时柱/.test(body1) ? 'OK' : 'FAIL');
  await page.waitForTimeout(5000);
  const body2 = await page.evaluate(() => document.body.innerText);
  const kbStuck = /正在加载知识库，请稍候/.test(body2) && !/命局|日主|格局/.test(body2);
  console.log('KB卡住:', kbStuck ? 'YES(问题)' : 'NO(正常)');
  const exposed = await page.evaluate(() => ({
    kbBazi: typeof window.kbBazi,
    getKbForDomain: typeof window.getKbForDomain,
    daofoLingqian: typeof window.daofoLingqian,
    callLocalModel: typeof window.callLocalModel,
  }));
  console.log('函数暴露:', JSON.stringify(exposed));
  console.log('JS错误数:', errors.length, errors.slice(0, 2).join('|').slice(0, 200));
  await page.screenshot({ path: 'check-state.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
