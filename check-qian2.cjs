const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.switchPage('daofobuddhism'));
  await page.waitForTimeout(3000);

  // 列出所有按钮
  const btns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim().slice(0,40),
      onclick: b.getAttribute('onclick'),
      class: b.className.slice(0,40)
    })).filter(b => b.text);
  });
  console.log('所有按钮:', JSON.stringify(btns, null, 2).slice(0, 1500));

  // 列出所有有 onclick 的元素
  const clickables = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[onclick]')).map(e => ({
      tag: e.tagName,
      text: e.innerText.trim().slice(0,40),
      onclick: e.getAttribute('onclick').slice(0,60)
    }));
  });
  console.log('onclick元素:', JSON.stringify(clickables, null, 2).slice(0, 1200));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
