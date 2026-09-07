const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // 切到道佛页面
  await page.evaluate(() => window.switchPage('daofobuddhism'));
  await page.waitForTimeout(3000);

  // 点击摇签按钮
  const shakeBtn = await page.$('button:has-text("摇签"), button:has-text("点击摇签"), .qian-shake-btn');
  if (!shakeBtn) { console.log('找不到摇签按钮'); await browser.close(); process.exit(1); }
  await shakeBtn.click();
  console.log('已点击摇签');

  // 等待并检查是否卡住
  let result = 'timeout';
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const body = await page.evaluate(() => document.body.innerText);
    if (/签文|解签|第.{1,4}签|观音灵签/.test(body) && !/点击摇签|正在摇签/.test(body)) {
      result = 'done';
      console.log('摇签完成，第', i, '轮检测到结果');
      break;
    }
    if (i === 14) console.log('摇签15轮(30s)仍无结果');
  }

  const body = await page.evaluate(() => document.body.innerText.slice(0,400));
  console.log('摇签后页面:', body.replace(/\s+/g,' ').slice(0,250));

  // 检查是否有动画元素一直转
  const shaking = await page.evaluate(() => {
    const el = document.querySelector('.qian-shaking, .shaking, [class*="shake"]');
    return el ? el.outerHTML.slice(0,200) : 'none';
  });
  console.log('摇签动画元素:', shaking);

  console.log('JS错误:', errors.length, errors.slice(0,3).join('|').slice(0,200));
  await page.screenshot({ path: 'check-qian.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
