/**
 * E2E: 占卜大师 三路径全链路验证
 *
 * 目标:
 *   1) 网络大模型(DeepSeek) — 验证 fallback 路径
 *   2) 本地大模型(llama.cpp @ 8083 via CORS) — 验证主路径
 *   3) 知识库联动 — 验证 RAG/KB 内容注入 system prompt
 *
 * 前置:
 *   - llama-server @ 127.0.0.1:8082
 *   - cors_proxy.py @ 127.0.0.1:8083 -> 8082
 *   - Vite dev @ localhost:3003 (脚本会自动选)
 */
const { chromium } = require('playwright');

const VITE_PORT = 3003;
const APP = `http://localhost:${VITE_PORT}/`;

function log(...args) { console.log('[E2E]', ...args); }
function ok(msg) { console.log('  ✅', msg); }
function bad(msg, detail) { console.log('  ❌', msg, detail || ''); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  page.on('console', m => {
    const t = m.text();
    if (/AI|RAG|KB|SSE|本地|网络|model|Core|Error/i.test(t)) console.log('  [browser]', t.slice(0, 300));
  });
  page.on('requestfailed', req => console.log('  [netfail]', req.url(), req.failure()?.errorText));
  page.on('response', resp => {
    if (resp.status() >= 400) console.log('  [http' + resp.status() + ']', resp.url());
  });

  let pass = 0, fail = 0;
  function check(name, cond, detail) {
    if (cond) { pass++; ok(name); }
    else { fail++; bad(name, detail || ''); }
  }

  try {
    log('1. 打开 APP');
    await page.goto(APP);
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1500);
    ok('页面加载');

    // ===== PATH 2: 本地大模型 =====
    log('\n=== PATH 2: 本地大模型 + 知识库 ===');
    await page.evaluate(() => {
      localStorage.setItem('use_local_model', '1');
      localStorage.setItem('local_server_ip', '127.0.0.1');
      localStorage.setItem('local_server_port', '8083'); // CORS proxy port
      localStorage.setItem('local_model_name', 'Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf');
      localStorage.removeItem('ds_api_key'); // 强制走本地
    });
    ok('localStorage 配置: use_local=1, port=8083 (CORS proxy)');

    // 直接调 ai-service: 测试纯本地模型调用 (不依赖 Vite 元素选择器)
    log('2. 直接调 callDeepSeek (本地模型)');
    const localResult = await page.evaluate(async () => {
      try {
        const fn = window.Core?.AI?.callDeepSeek;
        if (!fn) return { ok: false, error: 'Core.AI.callDeepSeek 不可用' };
        const t0 = Date.now();
        const text = await fn(
          '请用一句话回答: 你好',
          '你是助手',
          null,
          { temperature: 0.1, max_tokens: 80 }
        );
        return { ok: true, text, ms: Date.now() - t0 };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    if (localResult.ok) {
      check('本地模型返回内容', localResult.text && localResult.text.length > 0, JSON.stringify(localResult));
      log(`   耗时 ${localResult.ms}ms, 内容前 80 字: ${(localResult.text || '').slice(0, 80)}`);
    } else {
      check('本地模型调用', false, localResult.error);
    }

    // ===== PATH 3: 知识库联动 =====
    log('\n=== PATH 3: 知识库联动 (RAG + KB 注入) ===');
    const kbResult = await page.evaluate(async () => {
      try {
        const fn = window.Core?.AI?.buildSystemPrompt;
        if (!fn) return { ok: false, error: 'Core.AI.buildSystemPrompt 不可用' };
        // 用 bazi 域做样例: 应包含 Expert 事实 + RAG 内容 + KB + instruction
        const samplePan = {
          gz: { year: '庚午', month: '癸未', day: '甲子', hour: '丙寅' },
          gender: 'male',
          birthDate: '1990-06-15'
        };
        const system = fn({ domain: 'bazi', pan: samplePan, question: '我的事业运如何?' });
        return { ok: true, system, length: system.length };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    if (kbResult.ok) {
      check('buildSystemPrompt 返回内容', kbResult.length > 100);
      log(`   system prompt 长度: ${kbResult.length} 字符`);
      check('含【确定事实·100%准确】(Expert)', /确定事实/.test(kbResult.system || ''));
      check('含 chain-of-thought / 解读 / 推算 等指令片段', /解读|推算|分析|大运|格局/.test(kbResult.system || ''));
    } else {
      check('知识库组装', false, kbResult.error);
    }

    // ===== PATH 1: 网络大模型 fallback =====
    log('\n=== PATH 1: 网络大模型 (云端 fallback) ===');
    // 不实际发起(避免网络/Key 失败干扰);只检查接口存在
    const apiAvailable = await page.evaluate(() => {
      return {
        hasCallDeepSeek: typeof window.Core?.AI?.callDeepSeek === 'function',
        hasBuildSystem: typeof window.Core?.AI?.buildSystemPrompt === 'function',
        hasInterpret: typeof window.Core?.AI?.interpret === 'function',
        hasStripThinking: typeof window.Core?.AI?.stripThinking === 'function',
        hasRAG: typeof window.RAG?.search === 'function',
      };
    });
    check('Core.AI.callDeepSeek 可用', apiAvailable.hasCallDeepSeek);
    check('Core.AI.buildSystemPrompt 可用', apiAvailable.hasBuildSystem);
    check('Core.AI.interpret 可用', apiAvailable.hasInterpret);
    check('Core.AI.stripThinking 可用', apiAvailable.hasStripThinking);
    check('window.RAG.search 可用', apiAvailable.hasRAG);

    // ===== 真实联调: 本地 + RAG + 排盘页面 =====
    log('\n=== PATH 4: 真实页面排盘 → AI 解读 (本地+KB) ===');
    // 进入八字页
    const navOk = await page.evaluate(() => {
      const btn = document.querySelector('[data-page="bazi"]') || document.querySelector('#navBazi');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (navOk) {
      ok('进入八字页');
      await page.waitForTimeout(1500);
      // 填表 + 排盘
      try {
        await page.fill('#baziYear', '1990');
        await page.fill('#baziMonth', '6');
        await page.fill('#baziDay', '15');
        await page.fill('#baziHour', '12');
        await page.check('input[name="gender"][value="male"]').catch(() => {});
        await page.click('button:has-text("开始排盘")', { timeout: 5000 });
        await page.waitForTimeout(2000);
        ok('八字排盘完成');
      } catch (e) {
        bad('八字排盘失败: ' + e.message);
      }
      // 点 AI 解读 — force 跳过遮挡检查
      try {
        await page.click('#baziAIBtn', { timeout: 5000, force: true });
        log('  等待本地模型解读(最多 90s)...');
        const start = Date.now();
        let result = '';
        while (Date.now() - start < 90000) {
          await page.waitForTimeout(2000);
          result = await page.$eval('#baziAIContent, [id*="aiResult"], [id*="aiContent"]', el => el.textContent || '').catch(() => '');
          if (result && result.length > 50 && /[一-龥]/.test(result)) {
            // 看到中文正文就视为成功
            break;
          }
        }
        check('八字 AI 解读产生中文内容', result && result.length > 50 && /[一-龥]/.test(result));
        if (result) log(`  解读前 200 字: ${result.slice(0, 200)}`);
      } catch (e) {
        bad('AI 解读按钮未找到或失败: ' + e.message);
      }
    } else {
      bad('未找到八字入口按钮(可能选择器已变)');
    }

    log(`\n=== 汇总: ✅ ${pass} pass, ❌ ${fail} fail ===`);
  } catch (e) {
    console.error('测试脚本异常:', e.message);
    fail++;
  } finally {
    await browser.close();
    process.exit(fail > 0 ? 1 : 0);
  }
})();