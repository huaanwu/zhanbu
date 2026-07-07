function buildFengshuiPrompt(pan, question) {
  let s = "=== 风水咨询 ===\n";
  if (pan.address) s += "地址/户型：" + pan.address + "\n";
  if (pan.mingGua) s += "命卦：" + pan.mingGua + "\n";
  if (pan.zhaiGua) s += "宅卦：" + pan.zhaiGua + "\n";
  if (question) s += "\n所问之事：" + question + "\n";
  return s;
}
// ========== 风水罗盘（八宅） ==========
let fsHouse = 'zhai', fsGender = 'male';
function selFsHouse(btn) { document.querySelectorAll('#pageFengshui [data-house]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); fsHouse = btn.dataset.house; }
function selFsGender(btn) { document.querySelectorAll('#pageFengshui [data-gender]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); fsGender = btn.dataset.gender; }
window.selFsHouse = selFsHouse; window.selFsGender = selFsGender;

// currentFs已在上方声明
// let currentFs = null, currentFsPrompt = '';

// 八宅命卦：命卦算法流派众多
// 此函数只输出"年干+年支+性别"作为事实，命卦由AI按传统公式（最主流版）判断。
function mingGua(year, gender) {
  const TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const zhiIdx = ((year - 4) % 12 + 12) % 12;
  const ganIdx = ((year - 4) % 10 + 10) % 10;
  return {
    yearGanZhi: TG[ganIdx] + DZ[zhiIdx],
    yangYear: ganIdx % 2 === 0,  // 阳干：甲丙戊庚壬
    gender,
    zhiIdx
  };
}

// 宅卦（大门朝向决定）：东南西北+四隅 → 后天八卦
var MEN_GUA = { '东':'震', '南':'离', '西':'兑', '北':'坎', '东南':'巽', '西南':'坤', '西北':'乾', '东北':'艮' };

// 八宅"伏位轨迹"按后天八卦顺行（坎→坤→震→巽→中→乾→兑→艮→离→坎）
// 但更标准的"八宅"流派是按"大游年"或"小游年"轨迹
// 主流算法：以大门朝向为"伏位"起点，沿后天八卦顺行
//   伏位=大门朝向卦, 延年=伏位对宫, 天医=伏位顺1, 生气=天医顺1
//   绝命=延年对宫, 祸害=伏位对宫, 五鬼=生气对宫, 六煞=天医对宫
// 注：此简化算法在大门朝向东四卦（震巽坎离）和西四卦（乾坤兑艮）时吉凶方位有差异
function eightZhai(doorDir) {
  const houseGong = MEN_GUA[doorDir];
  if (!houseGong) return null;
  // 后天八卦顺行序
  const HOUTIAN = ['坎','坤','震','巽','中','乾','兑','艮','离'];
  const startIdx = HOUTIAN.indexOf(houseGong);

  // 吉方规则（"大游年"法）：伏位→延年→生气→天医（4个吉位）
  // 凶方：祸害→六煞→五鬼→绝命
  // 大游年：每个卦宫有"4吉4凶"固定位
  const GONG_8ZHAI = {
    '坎': { 吉: { 伏位:'北', 生气:'东南', 天医:'东', 延年:'南' }, 凶: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } },
    '坤': { 吉: { 伏位:'西南', 生气:'北', 天医:'东', 延年:'东南' }, 凶: { 祸害:'南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
    '震': { 吉: { 伏位:'东', 生气:'南', 天医:'东南', 延年:'北' }, 凶: { 祸害:'西南', 六煞:'西', 五鬼:'东北', 绝命:'西北' } },
    '巽': { 吉: { 伏位:'东南', 生气:'东', 天医:'北', 延年:'南' }, 凶: { 祸害:'西', 六煞:'东北', 五鬼:'西南', 绝命:'西北' } },
    '中': { 吉: { 伏位:'中', 生气:'南', 天医:'东', 延年:'北' }, 凶: { 祸害:'西南', 六煞:'西', 五鬼:'西北', 绝命:'东北' } },
    '乾': { 吉: { 伏位:'西北', 生气:'西南', 天医:'东', 延年:'北' }, 凶: { 祸害:'南', 六煞:'西', 五鬼:'东北', 绝命:'东南' } },
    '兑': { 吉: { 伏位:'西', 生气:'西北', 天医:'东南', 延年:'南' }, 凶: { 祸害:'北', 六煞:'东北', 五鬼:'西南', 绝命:'东' } },
    '艮': { 吉: { 伏位:'东北', 生气:'西', 天医:'北', 延年:'西南' }, 凶: { 祸害:'东', 六煞:'南', 五鬼:'西北', 绝命:'东南' } },
    '离': { 吉: { 伏位:'南', 生气:'北', 天医:'东', 延年:'东南' }, 凶: { 祸害:'西南', 六煞:'西北', 五鬼:'西', 绝命:'东北' } }
  };
  return GONG_8ZHAI[houseGong];
}

function doFengshui() {
  const door = document.getElementById('fsDoor').value;
  const year = +document.getElementById('fsBirthYear').value;
  if (!year || year < 1900 || year > 2030) { showToast('请输入有效出生年（1900-2030）', 'error'); return; }

  const ming = mingGua(year, fsGender);
  const house = MEN_GUA[door];
  const eightHouse = eightZhai(door);
  const ji = eightHouse ? eightHouse.吉 : null;
  const xiong = eightHouse ? eightHouse.凶 : null;

  const result = document.getElementById('fsResult');
  result.style.display = 'block';
  result.innerHTML = `
    <h3 style="color:var(--accent-gold);">🧭 八宅风水分析</h3>
    <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
      <div style="font-size:0.95rem;">命主生辰：<strong style="color:var(--accent-gold);">${ming.yearGanZhi}年 性别${fsGender === 'male' ? '男' : '女'}（${ming.yangYear ? '阳年' : '阴年'}生）</strong></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.3rem;">命卦：交由AI按传统公式（<code>男11-年支、女4+年支</code>）查定；常见算法流派不一，AI会注明所采用流派</div>
      <div style="font-size:0.95rem;margin-top:0.3rem;">宅卦（大门朝向决定）：<strong style="color:var(--accent-gold);">${house}（大门朝${door}）</strong></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:0.8rem;font-size:0.85rem;">
      <thead>
        <tr style="background:var(--bg-inner);">
          <th style="padding:0.4rem;">星位</th><th>方位</th><th>吉凶</th><th>用途建议</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>伏位（伏）</td><td><strong>${ji.伏位}</strong></td><td style="color:var(--accent-gold);">小吉</td><td>书房、子女房</td></tr>
        <tr><td>生气（最吉）</td><td><strong>${ji.生气}</strong></td><td style="color:var(--accent-green);">大吉</td><td>主房、客厅、开门纳气</td></tr>
        <tr><td>延年（大吉）</td><td><strong>${ji.延年}</strong></td><td style="color:var(--accent-green);">大吉</td><td>夫妻房、长辈房</td></tr>
        <tr><td>天医（大吉）</td><td><strong>${ji.天医}</strong></td><td style="color:var(--accent-green);">大吉</td><td>卧室、财位、厨房</td></tr>
        <tr><td>祸害（小凶）</td><td><strong>${xiong.祸害}</strong></td><td style="color:var(--accent-red);">小凶</td><td>避免主用，宜放杂物</td></tr>
        <tr><td>六煞（中凶）</td><td><strong>${xiong.六煞}</strong></td><td style="color:var(--accent-red);">中凶</td><td>避免睡房、宜空置或放植物</td></tr>
        <tr><td>五鬼（大凶）</td><td><strong>${xiong.五鬼}</strong></td><td style="color:var(--accent-red);">大凶</td><td>不可作主门，宜储藏</td></tr>
        <tr><td>绝命（至凶）</td><td><strong>${xiong.绝命}</strong></td><td style="color:var(--accent-red);">至凶</td><td>绝对避免主用，宜化煞</td></tr>
      </tbody>
    </table>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">⚠️ 八宅吉凶方仅按大门朝向（宅卦）排布；命卦的"东四/西四"分类用于判断宅卦是否适合命主（由AI解读时综合判定）</div>
  `;
  currentFs = { ming, door, house, ji, xiong, gender: fsGender, houseType: fsHouse };
  currentFsPrompt = `=== 八宅风水排盘 ===\n出生年：${year}年（${ming.yearGanZhi}年） 性别：${fsGender === 'male' ? '男' : '女'}（${ming.yangYear ? '阳年生' : '阴年生'}）\n大门朝向：${door}（宅卦${house}）\n户型：${fsHouse === 'zhai' ? '住宅' : '办公室'}\n\n【请按以下步骤推理】\n1. 根据年干支+性别，按传统命卦公式（男命11-年支/女命4+年支→模9）算出命卦\n2. 判断东四命/西四命（坎震巽离=东四；乾坤兑艮=西四）\n3. 与宅卦${house}对比，告知是否"宅命相合"\n4. 给出四吉方具体布置建议、四凶方如何化煞\n\n四吉方（按大门朝${door}，宅卦${house}）：\n  伏位${ji.伏位} · 生气${ji.生气} · 延年${ji.延年} · 天医${ji.天医}\n\n四凶方：\n  祸害${xiong.祸害} · 六煞${xiong.六煞} · 五鬼${xiong.五鬼} · 绝命${xiong.绝命}\n\n请结合以上信息给出专业的风水建议。`;
  document.getElementById('fsAI').style.display = 'block';
  document.getElementById('fsAIBtn').style.display = 'inline-block';
  document.getElementById('fsAILoading').style.display = 'none';
  document.getElementById('fsAIText').style.display = 'none';
}
window.doFengshui = doFengshui;

async function doAIFengshui() {
  if (!currentFsPrompt) return;
  await ensureKB();
  await loadKBGroup('fengshui');
  const btn = document.getElementById('fsAIBtn');
  const loading = document.getElementById('fsAILoading');
  const text = document.getElementById('fsAIText');
  btn.disabled = true; btn.textContent = '解读中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '';

  let fullText = '';
  try {
    // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    const sys = Core.AI.buildSystemPrompt({
      domain: 'fengshui', pan: currentFs, question: '',
      extraSystem: '你是一位精通八宅风水的大师，请根据命卦、宅卦、户型进行详细分析。重点说明：1.命卦与宅卦是否相合 2.四吉方如何利用 3.四凶方如何化解 4.卧室/客厅/厨房/书房的最佳布局建议。'
    });
    // v3.0.5: 统一 AI 入口(任务 #19)
    await Core.AI.interpret({
      domain: 'fengshui',
      prompt: currentFsPrompt,
      system: sys,
      pan: currentFs,
      question: '',
      contentEl: text,
      prefix,
      separator,
    });
    showResultActions('fsAIText', 'fsAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error">解读失败: ' + escapeHtml(e.message) + '</div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIFengshui = doAIFengshui;

function kbFengshui() {
  return '\n\n【知识库参考】八宅风水要点：\n'
    + '· 八宅由"伏位"起，沿洛书轨迹分四吉四凶星位\n'
    + '· 东四命（坎/震/巽/离）吉位：东、南、北、东南\n'
    + '· 西四命（坤/兑/乾/艮）吉位：西、西南、西北、东北\n'
    + '· 大门（气口）宜在生气方或延年方\n'
    + '· 主卧宜在延年或天医方，厨房灶位宜压五鬼祸害方\n'
    + '· 书房宜在伏位，文昌位则需结合流年飞星另定\n'
    + kbFengshuiBase()
    + kbFengshuiLuopan();
}
