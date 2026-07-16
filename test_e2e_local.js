const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  
  console.log('1. 打开设置页面...');
  await page.goto('http://localhost:3002/');
  await page.waitForTimeout(1000);
  
  // 点击设置按钮
  const settingsBtn = await page.$('[data-page="settings"]');
  if (settingsBtn) await settingsBtn.click();
  await page.waitForTimeout(500);
  
  console.log('2. 配置本地模型...');
  // 设置 IP 和端口
  await page.fill('#localServerIpInput', '127.0.0.1');
  await page.fill('#localServerPortInput', '8083'); // CORS 代理端口
  
  console.log('3. 测试自动发现...');
  const discoverBtn = await page.$('#autoDiscoverBtn');
  if (discoverBtn) {
    await discoverBtn.click();
    await page.waitForTimeout(3000);
    const status = await page.$eval('#discoverStatus', el => el.textContent);
    console.log('自动发现状态:', status);
  }
  
  console.log('4. 测试连接...');
  const testBtn = await page.$('#testLocalModelBtn');
  if (testBtn) {
    await testBtn.click();
    await page.waitForTimeout(3000);
    const status = await page.$eval('#discoverStatus', el => el.textContent);
    console.log('连接测试状态:', status);
  }
  
  console.log('5. 保存设置...');
  const saveBtn = await page.$('#saveSettingsBtn');
  if (saveBtn) await saveBtn.click();
  await page.waitForTimeout(1000);
  
  console.log('6. 测试八字排盘...');
  const baziBtn = await page.$('[data-page="bazi"]');
  if (baziBtn) await baziBtn.click();
  await page.waitForTimeout(500);
  
  // 填写八字信息
  await page.fill('#baziYear', '1990');
  await page.selectOption('#baziMonth', '6');
  await page.fill('#baziDay', '15');
  await page.selectOption('#baziHour', '12');
  await page.check('#baziGenderMale');
  
  // 点击排盘
  const calcBtn = await page.$('#calcBaziBtn');
  if (calcBtn) await calcBtn.click();
  await page.waitForTimeout(2000);
  
  console.log('7. 测试AI解读...');
  const aiBtn = await page.$('#aiInterpretBtn');
  if (aiBtn) {
    await aiBtn.click();
    await page.waitForTimeout(10000); // 等待AI响应
    
    const result = await page.$eval('#aiResult', el => el.textContent).catch(() => '无结果');
    console.log('AI解读结果:', result.substring(0, 200));
  }
  
  await browser.close();
  console.log('测试完成!');
})();
