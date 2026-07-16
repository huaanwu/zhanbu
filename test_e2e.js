const { chromium } = require('playwright');

(async () => {
  console.log('=== 启动端到端测试 ===');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  
  // 1. 打开APP
  console.log('1. 打开APP...');
  await page.goto('http://localhost:3002/');
  await page.waitForTimeout(2000);
  
  // 2. 进入设置 - 点击设置按钮
  console.log('2. 进入设置页面...');
  await page.click('#navSettings');
  await page.waitForTimeout(1000);
  
  // 3. 配置本地模型
  console.log('3. 配置本地模型...');
  await page.fill('#localServerIpInput', '127.0.0.1');
  await page.fill('#localServerPortInput', '8083');
  console.log('   IP: 127.0.0.1, Port: 8083');
  
  // 4. 测试自动发现（通过 onclick 属性找到按钮）
  console.log('4. 测试自动发现...');
  try {
    await page.click('button:has-text("自动发现")');
    await page.waitForTimeout(5000);
    const status = await page.$eval('#discoverStatus', el => el.textContent).catch(() => '无状态');
    console.log('   自动发现状态:', status);
  } catch (e) {
    console.log('   自动发现失败:', e.message);
  }
  
  // 5. 测试连接
  console.log('5. 测试连接...');
  try {
    await page.click('button:has-text("测试连接")');
    await page.waitForTimeout(5000);
    const status = await page.$eval('#discoverStatus', el => el.textContent).catch(() => '无状态');
    console.log('   连接测试状态:', status);
  } catch (e) {
    console.log('   连接测试失败:', e.message);
  }
  
  // 6. 检查 localModelCheck 状态
  console.log('6. 检查本地模型启用状态...');
  try {
    const isChecked = await page.$eval('#localModelCheck', el => el.checked);
    console.log('   本地模型勾选:', isChecked);
  } catch (e) {
    console.log('   无法检查勾选状态');
  }
  
  // 7. 保存设置
  console.log('7. 保存设置...');
  try {
    await page.click('button:has-text("保存设置")');
    await page.waitForTimeout(1000);
    console.log('   设置已保存');
  } catch (e) {
    console.log('   保存失败:', e.message);
  }
  
  // 8. 进入八字页面
  console.log('8. 进入八字页面...');
  try {
    await page.click('button:has-text("八字")');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('   进入八字页面失败:', e.message);
  }
  await page.waitForTimeout(1000);
  
  // 9. 填写八字信息并排盘
  console.log('9. 填写八字信息...');
  try {
    await page.fill('#baziYear', '1990');
    await page.selectOption('#baziMonth', '6');
    await page.fill('#baziDay', '15');
    await page.selectOption('#baziHour', '12');
    await page.check('input[name="gender"][value="male"]');
    console.log('   信息已填写');
    
    await page.click('button:has-text("开始排盘")');
    await page.waitForTimeout(3000);
    console.log('   排盘完成');
  } catch (e) {
    console.log('   排盘失败:', e.message);
  }
  
  // 10. 测试AI解读
  console.log('10. 测试AI解读...');
  try {
    await page.click('#baziAIBtn');
    console.log('   已点击AI解读按钮，等待30秒...');
    await page.waitForTimeout(30000);
    
    const result = await page.$eval('#baziAIContent', el => el.textContent).catch(() => '无结果');
    console.log('   AI解读结果前200字:', result.substring(0, 200));
    
    if (result.includes('本地模型') && result.includes('API Key')) {
      console.log('   ❌ AI解读失败：模型连接问题');
    } else if (result.includes('加载知识库')) {
      console.log('   ⏳ 知识库加载中...');
    } else if (result.length > 100) {
      console.log('   ✅ AI解读成功！');
    } else {
      console.log('   ⚠️ 结果异常:', result);
    }
  } catch (e) {
    console.log('   AI解读失败:', e.message);
  }
  
  await browser.close();
  console.log('=== 测试完成 ===');
})();
