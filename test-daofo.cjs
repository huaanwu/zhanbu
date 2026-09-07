const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.switchPage('daofobuddhism'));
  await page.waitForTimeout(2000);

  // 找摇签元素（任何 tag）
  const shakeEl = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#pageDaofobuddhism *'));
    const el = els.find(e => /摇签|点击摇签/.test(e.innerText || ''));
    return el ? { tag: el.tagName, id: el.id, class: el.className, text: el.innerText.trim().slice(0,40) } : null;
  });
  console.log('摇签元素:', JSON.stringify(shakeEl));

  // 点击摇签
  if (shakeEl) {
    await page.click(`#${shakeEl.id}`).catch(async () => {
      await page.evaluate((id) => document.getElementById(id)?.click(), shakeEl.id);
    });
    console.log('已点击摇签');
    await page.waitForTimeout(8000);
    const body = await page.evaluate(() => document.querySelector('#pageDaofobuddhism').innerText);
    const stuck = /摇签|shaking/.test(body) && !/签文|第.{1,4}签|解签/.test(body);
    console.log('摇签卡住:', stuck ? 'YES(问题)' : 'NO(正常)');
    console.log('摇签后内容:', body.replace(/\s+/g,' ').slice(0,200));
  }

  // 测符箓 tab
  await page.evaluate(() => window.switchDfTab && window.switchDfTab('fulu'));
  await page.waitForTimeout(5000);
  const fulu = await page.evaluate(() => document.querySelector('#pageDaofobuddhism').innerText);
  const fuluStuck = /加载知识库|正在加载/.test(fulu) && !/符|敕|咒/.test(fulu);
  console.log('符箓KB卡住:', fuluStuck ? 'YES(问题)' : 'NO(正常)');

  // 测手诀 tab
  await page.evaluate(() => window.switchDfTab && window.switchDfTab('shoujue'));
  await page.waitForTimeout(5000);
  const sj = await page.evaluate(() => document.querySelector('#pageDaofobuddhism').innerText);
  const sjStuck = /加载知识库|正在加载/.test(sj) && !/手诀|诀|印/.test(sj);
  console.log('手诀KB卡住:', sjStuck ? 'YES(问题)' : 'NO(正常)');

  console.log('JS错误:', errors.length, errors.slice(0,3).join('|').slice(0,200));
  await page.screenshot({ path: 'test-daofo.png' });
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
