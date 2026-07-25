// ========== 风水罗盘(八宅 + 玄空飞星)v3.0.11 ==========
// 算盘层: window.fengshui.mingGua/eightZhai/zhaiMingHe/mainRoomAssess + window.xuankong.*
// 本文件只负责 UI 绑定 + 渲染 + AI 解读调用

// v3.0.11:八宅/玄空 tab 切换
function selFsTab(btn) {
  document.querySelectorAll('#pageFengshui [data-fs-tab]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  var tab = btn.dataset.fsTab;
  var p8 = document.getElementById('fsPane8zhai');
  var pxk = document.getElementById('fsPaneXuankong');
  if (p8) p8.style.display = (tab === '8zhai') ? 'block' : 'none';
  if (pxk) pxk.style.display = (tab === 'xuankong') ? 'block' : 'none';
}
window.selFsTab = selFsTab;

function selFsHouse(btn) {
  document.querySelectorAll('#pageFengshui [data-house]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.fengshui.houseType = btn.dataset.house;
}
window.selFsHouse = selFsHouse;

function selFsGender(btn) {
  document.querySelectorAll('#pageFengshui [data-gender]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.fengshui.gender = btn.dataset.gender;
}
window.selFsGender = selFsGender;

// v3.0.10:历法切换(阳/阴)
function selFsCal(btn) {
  document.querySelectorAll('#pageFengshui [data-fs-cal]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.fengshui.cal = btn.dataset.fsCal;
  var solarRow = document.getElementById('fsSolarRow');
  var lunarRow = document.getElementById('fsLunarRow');
  if (solarRow) solarRow.style.display = btn.dataset.fsCal === 'solar' ? 'grid' : 'none';
  if (lunarRow) lunarRow.style.display = btn.dataset.fsCal === 'lunar' ? 'grid' : 'none';
}
window.selFsCal = selFsCal;

// v3.0.10:主卧朝向
function selFsMainRoom(btn) {
  document.querySelectorAll('#pageFengshui [data-main-room]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.fengshui.mainRoomDir = btn.dataset.mainRoom;
}
window.selFsMainRoom = selFsMainRoom;

function doFengshui() {
  var errEl = document.getElementById('fsError');
  if (errEl) errEl.style.display = 'none';
  var cal = (state.fengshui && state.fengshui.cal) || 'solar';
  var year;
  try {
    if (cal === 'lunar') {
      // 农历路径:yearGZ + 干支纪年转公历 → mingGua 仍按公历算(命卦不分公农)
      var yearGZ = document.getElementById('fsYearGZ').value;
      // 简化: 用年支取年(1900-2099),例如 "甲子" → 60甲子表里找最近的甲子年
      year = fsGZToYear(yearGZ);
    } else {
      year = +document.getElementById('fsBirthYear').value;
    }
    if (!year || year < 1900 || year > 2030) {
      throw new Error('请输入有效出生年份(1900-2030),当前: ' + year);
    }
    var door = document.getElementById('fsDoor').value;
    var mainRoom = (state.fengshui && state.fengshui.mainRoomDir) || document.getElementById('fsMainRoomDir').value;
    var gender = (state.fengshui && state.fengshui.gender) || 'male';

    var ming = window.fengshui.mingGua(year, gender);
    var house = window.fengshui.eightZhai(door);
    if (!house) throw new Error('未知大门朝向: ' + door);
    var he = window.fengshui.zhaiMingHe(ming, house);
    var mainRoomAssess = window.fengshui.mainRoomAssess(door, mainRoom);

    var result = document.getElementById('fsResult');
    result.style.display = 'block';
    var heColor = he.he ? 'var(--accent-green)' : 'var(--accent-red)';
    var heBg = he.he ? 'rgba(120,180,120,0.1)' : 'rgba(220,80,80,0.1)';
    var heLabel = he.he ? '✅ 宅命相合' : '⚠️ 宅命不合';
    var ji = house.ji, xiong = house.xiong;
    var jiArr = ['伏位','生气','延年','天医'];
    var xiongArr = ['祸害','六煞','五鬼','绝命'];
    var jiLevel = { '伏位':'小吉', '生气':'大吉', '延年':'大吉', '天医':'大吉' };
    var xiongLevel = { '祸害':'小凶', '六煞':'中凶', '五鬼':'大凶', '绝命':'至凶' };

    var html = `
      <h3 style="color:var(--accent-gold);">🧭 八宅风水分析</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin:0.5rem 0;">
        <div style="background:var(--bg-inner);padding:0.4rem;border-radius:6px;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.3rem;text-align:center;">🧭 罗盘 24 山向</div>
          ${window.fengshuiVisual.drawLuopan24(door)}
        </div>
        <div style="background:var(--bg-inner);padding:0.4rem;border-radius:6px;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.3rem;text-align:center;">🏠 户型方位</div>
          ${window.fengshuiVisual.drawHouseLayout({ doorDir: door, mainRoomDir: mainRoom, ji: ji, xiong: xiong })}
        </div>
      </div>
      <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
        <div style="font-size:0.95rem;">命主生辰：<strong style="color:var(--accent-gold);">${ming.yearGanZhi}年 性别${gender === 'male' ? '男' : '女'}（${ming.yangYear ? '阳年' : '阴年'}生）</strong></div>
        <div style="font-size:0.95rem;margin-top:0.3rem;">命卦：<strong style="color:var(--accent-gold);">${ming.guaName}（${ming.nature}·${ming.group === 'east' ? '东四命' : '西四命'}）</strong></div>
        <div style="font-size:0.95rem;margin-top:0.3rem;">宅卦：<strong style="color:var(--accent-gold);">${house.guaName}（大门朝${door}）</strong></div>
        <div style="font-size:0.95rem;margin-top:0.4rem;padding:0.4rem 0.6rem;background:${heBg};border-left:3px solid ${heColor};border-radius:4px;">
          <strong style="color:${heColor};">${heLabel}</strong> — ${he.summary}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:0.8rem;font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg-inner);">
            <th style="padding:0.4rem;">星位</th><th>方位</th><th>吉凶</th><th>用途建议</th>
          </tr>
        </thead>
        <tbody>
          ${jiArr.map(function(k){ return `
            <tr>
              <td>${k}${k==='伏位'?'(伏)':(k==='生气'?'(最吉)':'(大吉)')}</td>
              <td><strong>${ji[k]}</strong></td>
              <td style="color:${k==='伏位'?'var(--accent-gold)':'var(--accent-green)'};">${jiLevel[k]}</td>
              <td>${k==='伏位'?'书房/子女房':(k==='生气'?'主房/客厅/开门纳气':(k==='延年'?'夫妻房/长辈房':'卧室/财位/厨房'))}</td>
            </tr>`; }).join('')}
          ${xiongArr.map(function(k){ return `
            <tr>
              <td>${k}</td>
              <td><strong>${xiong[k]}</strong></td>
              <td style="color:var(--accent-red);">${xiongLevel[k]}</td>
              <td>${k==='祸害'?'避免主用,宜放杂物':(k==='六煞'?'避免睡房,空置或植物':(k==='五鬼'?'不可主门,宜储藏':'绝对避免,宜化煞'))}</td>
            </tr>`; }).join('')}
        </tbody>
      </table>

      <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.8rem;border-left:3px solid var(--accent-blue);">
        <div style="font-size:0.85rem;color:var(--text-muted);">主卧朝向评估（大门朝${door}，主卧朝${mainRoom}）</div>
        <div style="font-size:1rem;margin-top:0.3rem;">
          主卧位 <strong style="color:var(--accent-gold);">${mainRoom}</strong>，落 <strong>${mainRoomAssess.star || '未知位'}</strong>
          ${mainRoomAssess.type === 'ji'
            ? '(<span style="color:var(--accent-green);">' + mainRoomAssess.level + '</span>)'
            : mainRoomAssess.type === 'xiong'
            ? '(<span style="color:var(--accent-red);">' + mainRoomAssess.level + '</span>)'
            : '(未知位)'}
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">
          💡 ${mainRoomAssess.star === '生气' || mainRoomAssess.star === '延年' || mainRoomAssess.star === '天医'
            ? '主卧位置极佳,有助于主人健康/夫妻和睦/事业提升'
            : mainRoomAssess.star === '伏位'
            ? '主卧适合书房/子女房,但用作主卧略欠火候'
            : mainRoomAssess.star === '绝命'
            ? '主卧位置严重不利,建议调整床位朝向或化煞'
            : '建议结合 AI 解读判断主卧是否需要调整'}
        </div>
      </div>

      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">⚠️ 八宅吉凶方按大门朝向(宅卦)排布;命卦与宅卦是否相合已标注;跨东四/西四的化解方案由 AI 给出。</div>
    `;
    result.innerHTML = html;

    currentFs = {
      ming: ming, door: door, house: { name: house.guaName, num: house.guaNum },
      ji: ji, xiong: xiong, gender: gender, houseType: state.fengshui.houseType || 'zhai',
      mainRoom: mainRoom, mainRoomAssess: mainRoomAssess,
      he: he, cal: cal
    };

    currentFsPrompt = `=== 八宅风水排盘(v3.0.10) ===\n`
      + `出生年:${year}年(${ming.yearGanZhi}年) 性别:${gender === 'male' ? '男' : '女'}(${ming.yangYear ? '阳年生' : '阴年生'})\n`
      + `命卦:${ming.guaName}(${ming.nature}·${ming.group === 'east' ? '东四命' : '西四命'}) — 由代码按"男11-支序模9/女4+支序模9"算得(0 视作 9)\n`
      + `大门朝向:${door}(宅卦${house.guaName}) 户型:${state.fengshui.houseType === 'zhai' ? '住宅' : '办公室'}\n`
      + `主卧朝向:${mainRoom}(落 ${mainRoomAssess.star || '未知位'} — ${mainRoomAssess.type === 'ji' ? mainRoomAssess.level : mainRoomAssess.type === 'xiong' ? mainRoomAssess.level : '未知'})\n`
      + `历法输入:${cal === 'lunar' ? '阴历' : '阳历'}\n\n`
      + `宅命相合判定:${he.he ? '✅ 相合' : '⚠️ 不合'} — ${he.summary}\n\n`
      + `【请按以下步骤推理】\n`
      + `1. 命卦与宅卦是否相合(${he.he ? '同属' + (ming.group === 'east' ? '东四' : '西四') : '跨 ' + ming.group + '/' + (house.guaNum === 1||house.guaNum===3||house.guaNum===4||house.guaNum===9 ? 'east' : 'west')})\n`
      + `2. 若不合,给出化解方案(五行通关/颜色/物品/方位调整)\n`
      + `3. 主卧落在 ${mainRoomAssess.star || '未知'},给出卧室布局建议(床位/床头朝向/灯具/装饰)\n`
      + `4. 四吉方具体布置建议(主卧/客厅/厨房/书房/大门开向)\n`
      + `5. 四凶方如何化煞(避免/化煞物品/储藏/植物)\n\n`
      + `四吉方(大门朝${door},宅卦${house.guaName}):\n`
      + `  伏位${ji.伏位} · 生气${ji.生气} · 延年${ji.延年} · 天医${ji.天医}\n\n`
      + `四凶方:\n`
      + `  祸害${xiong.祸害} · 六煞${xiong.六煞} · 五鬼${xiong.五鬼} · 绝命${xiong.绝命}\n\n`
      + `请结合以上信息给出专业的风水建议(总字数不少于 2000 字,分章节、条理清晰、actionable,给出具体可执行方案)。`;

    document.getElementById('fsAI').style.display = 'block';
    document.getElementById('fsAIBtn').style.display = 'inline-block';
    document.getElementById('fsAILoading').style.display = 'none';
    document.getElementById('fsAIText').style.display = 'none';
  } catch (e) {
    if (errEl) {
      errEl.textContent = '⚠️ ' + e.message;
      errEl.style.display = 'block';
    }
    showToast(e.message, 'error');
    console.error(e);
  }
}
window.doFengshui = doFengshui;

// 60甲子 → 公历年(1900-2099),取最近的甲子/乙丑/...年
function fsGZToYear(gz) {
  if (!gz) return null;
  // 简单查找:遍历 1900-2099 找年干支匹配
  var TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  for (var y = 1900; y <= 2099; y++) {
    var ganIdx = ((y - 4) % 10 + 10) % 10;
    var zhiIdx = ((y - 4) % 12 + 12) % 12;
    if (TG[ganIdx] + DZ[zhiIdx] === gz) return y;
  }
  return null;
}

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

  try {
    const sys = await Core.AI.buildSystemPrompt({
      domain: 'fengshui', pan: currentFs, question: '',
      extraSystem: '你是一位精通八宅风水的大师,请根据命卦、宅卦、户型、主卧朝向进行详细深入分析。命卦(${currentFs.ming.guaName})、宅卦(${currentFs.house.name})、宅命相合(${currentFs.he.he ? "相合" : "不合"})、主卧落位(${currentFs.mainRoomAssess.star || "未知"}) 都是代码定论事实,不可更改。重点说明:1. 命卦与宅卦关系及化解 2. 主卧位置评估与建议 3. 四吉方如何利用 4. 四凶方如何化解 5. 卧室/客厅/厨房/书房的最佳布局建议。输出要求:总字数不少于 2000 字,分章节、条理清晰、actionable,给出具体可执行的风水调整方案。'
    });
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

// ============ v3.0.11 玄空飞星 ============
function selXkSit(btn) {
  document.querySelectorAll('#pageFengshui [data-xk-sit]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.xuankong.sitDir = btn.dataset.xkSit;
}
window.selXkSit = selXkSit;

function selXkFace(btn) {
  document.querySelectorAll('#pageFengshui [data-xk-face]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.xuankong.faceDir = btn.dataset.xkFace;
}
window.selXkFace = selXkFace;

function doXuankong() {
  var errEl = document.getElementById('xkError');
  if (errEl) errEl.style.display = 'none';
  try {
    var year = +document.getElementById('xkYear').value;
    if (!year || year < 1864 || year > 2099) {
      throw new Error('玄空飞星仅支持 1864-2099 年,当前: ' + year);
    }
    var sitDir = (state.xuankong && state.xuankong.sitDir) || '南';
    var faceDir = (state.xuankong && state.xuankong.faceDir) || '北';

    var yun = window.xuankong.currentYun(year);
    var yp = window.xuankong.yunPan(year);
    var mp = window.xuankong.mountainPan(year, sitDir);
    var fp = window.xuankong.facePan(year, faceDir);
    var ws = window.xuankong.wangShanWangXiang(yp, mp, fp, sitDir, faceDir);
    var wh = window.xuankong.wuhuangAndErhei(yp);
    // v3.0.14:流年/流月飞星(按当前日期自动算)
    var now = new Date();
    var curYear = now.getFullYear();
    var curMonthIdx = now.getMonth() + 1;  // 1-12(阳历月 → 需转农历,但本轮简化用阳历月数 — 月份地支按月份推算)
    // 注: 严格玄空流月需用农历月(干支纪月),本轮用月份数 1-12 → XK_MONTH_ZHI[month-1]
    var liunian = window.xuankong.liunianPan(curYear);
    var liuyue = window.xuankong.liuyuePan(curYear, curMonthIdx);
    var lw = window.xuankong.liunianAndLiuyueWuhuang(curYear, curMonthIdx);
    var curMonthCN = window.xuankong.MONTH_CN[curMonthIdx - 1] + '(' + curMonthIdx + '月)';

    var result = document.getElementById('xkResult');
    result.style.display = 'block';

    // 9 宫 SVG 渲染(替代原 renderPan)
    // 3 个并排:运盘/山盘/向盘
    var html = `
      <h3 style="color:var(--accent-gold);">🌌 玄空飞星排盘</h3>
      <div style="background:var(--bg-inner);padding:0.8rem;border-radius:8px;margin-top:0.5rem;">
        <div style="font-size:0.95rem;">年份：<strong>${year}年</strong>(本运：<strong style="color:var(--accent-gold);">${yun.yun}运 ${yun.yunName}</strong>,${yun.period},${yun.startYear}-${yun.endYear},已过 ${yun.yearsFromStart + 1} 年)</div>
        <div style="font-size:0.95rem;margin-top:0.3rem;">坐方：<strong style="color:var(--accent-gold);">${sitDir}</strong>　向方：<strong style="color:var(--accent-gold);">${faceDir}</strong></div>
        <div style="font-size:0.95rem;margin-top:0.4rem;padding:0.4rem 0.6rem;background:rgba(201,168,76,0.1);border-left:3px solid var(--accent-gold);border-radius:4px;">
          <strong>旺山旺向：</strong>${ws.verdict}
        </div>
        <div style="font-size:0.85rem;margin-top:0.3rem;color:var(--text-secondary);">
          山星到坐 = <strong>${ws.mountainStarAtSit}</strong>(${ws.wangShan ? '旺' : '不旺'})；向星到向 = <strong>${ws.faceStarAtFace}</strong>(${ws.wangXiang ? '旺' : '不旺'})
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:1rem;">
        <div>
          <div style="font-size:0.8rem;color:var(--accent-gold);margin-bottom:0.3rem;text-align:center;">【运盘】${yun.yunName}入中</div>
          ${window.fengshuiVisual.drawJiugong(yp.panByGong, yun.yunName)}
        </div>
        <div>
          <div style="font-size:0.8rem;color:var(--accent-gold);margin-bottom:0.3rem;text-align:center;">【山盘】坐 ${sitDir}</div>
          ${window.fengshuiVisual.drawJiugong(mp.panByGong, '坐' + sitDir + '入中')}
        </div>
        <div>
          <div style="font-size:0.8rem;color:var(--accent-gold);margin-bottom:0.3rem;text-align:center;">【向盘】向 ${faceDir}</div>
          ${window.fengshuiVisual.drawJiugong(fp.panByGong, '向' + faceDir + '入中')}
        </div>
      </div>

      <div style="margin-top:0.8rem;background:rgba(220,80,80,0.08);padding:0.6rem;border-radius:6px;border-left:3px solid var(--accent-red);font-size:0.85rem;">
        <strong>五黄煞</strong>在 <strong>${wh.wuhuangAt}宫</strong>(最凶,宜静不宜动);<br>
        <strong>二黑病符</strong>在 <strong>${wh.erheiAt}宫</strong>(主病,化解:铜器/灰色地毯/避免红色)
      </div>

      <div style="margin-top:1rem;font-size:0.85rem;color:var(--accent-gold);border-top:1px solid var(--border);padding-top:0.6rem;">📅 v3.0.14 流年飞星 (按当前日期自动计算)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">
        <div>
          <div style="font-size:0.75rem;color:var(--accent-gold);margin-bottom:0.3rem;text-align:center;">【流年盘】${year}年 (${liunian.yearZhi}年)</div>
          ${window.fengshuiVisual.drawJiugong(liunian.panByGong, year + '年' + liunian.yearZhi + '年')}
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--accent-gold);margin-bottom:0.3rem;text-align:center;">【流月盘】${curMonthCN}(${liuyue.monthZhi}月)</div>
          ${window.fengshuiVisual.drawJiugong(liuyue.panByGong, curMonthCN + liuyue.monthZhi)}
        </div>
      </div>

      <div style="margin-top:0.6rem;background:rgba(220,80,80,0.08);padding:0.6rem;border-radius:6px;border-left:3px solid var(--accent-red);font-size:0.85rem;">
        <strong>流年五黄</strong>在 <strong>${lw.liunianWuhuang}宫</strong>，<strong>流年二黑</strong>在 <strong>${lw.liunianErhei}宫</strong>;<br>
        <strong>流月五黄</strong>在 <strong>${lw.liuyueWuhuang}宫</strong>，<strong>流月二黑</strong>在 <strong>${lw.liuyueErhei}宫</strong>;
        ${lw.doubleWu ? '<br><strong style="color:var(--accent-red);">⚠️ 双五黄叠加(' + lw.liunianWuhuang + '宫) — 当月最凶,避免动土装修!</strong>' : ''}
      </div>

      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">⚠️ 本盘为基础版(山向飞星用元旦盘起星);替卦、零神等进阶操作由 AI 在解读中说明。</div>
    `;
    result.innerHTML = html;

    currentFs = {
      domain: 'fengshui_xuankong',
      year: year,
      sitDir: sitDir,
      faceDir: faceDir,
      yun: yun,
      yp: { panByGong: yp.panByGong },
      mp: { panByGong: mp.panByGong },
      fp: { panByGong: fp.panByGong },
      ws: ws,
      wh: wh,
      question: ''
    };
    currentFsPrompt = window.xuankong.formatPrompt(year, sitDir, faceDir)
      + '\n\n【玄空飞星解读要点】运盘/山盘/向盘为代码定论,不可更改。重点说明:\n'
      + '1. 当前运(${yun.yunName})旺衰及五行(${yun.nature})与宅主/户主八字是否相合\n'
      + '2. 旺山旺向判定: ${ws.verdict}\n'
      + '3. 五黄(${wh.wuhuangAt}宫)/ 二黑(${wh.erheiAt}宫)化解方案(具体物品/方位/颜色)\n'
      + '4. 山盘到坐宫、向盘到向宫的吉星(如一白/六白/八白/九紫)催旺建议\n'
      + '5. 卧室/客厅/厨房/书房的飞星布局(参考 KB 玄空飞星条目)\n\n'
      + '本盘为基础版(山向用元旦盘起星);若需替卦/零神等进阶操作,请用户线下咨询专业风水师。';

    document.getElementById('xkAI').style.display = 'block';
    document.getElementById('xkAIBtn').style.display = 'inline-block';
    document.getElementById('xkAILoading').style.display = 'none';
    document.getElementById('xkAIText').style.display = 'none';
  } catch (e) {
    if (errEl) {
      errEl.textContent = '⚠️ ' + e.message;
      errEl.style.display = 'block';
    }
    showToast(e.message, 'error');
    console.error(e);
  }
}
window.doXuankong = doXuankong;

async function doAIXuankong() {
  if (!currentFsPrompt) return;
  await ensureKB();
  await loadKBGroup('fengshui');
  const btn = document.getElementById('xkAIBtn');
  const loading = document.getElementById('xkAILoading');
  const text = document.getElementById('xkAIText');
  btn.disabled = true; btn.textContent = '解读中...';
  loading.style.display = 'none';
  text.style.display = 'block';

  const prefix = _followUpPrefix;
  _followUpPrefix = '';
  const separator = prefix ? '\n\n─────────────────\n📌 追问\n─────────────────\n\n' : '';
  if (!prefix) text.textContent = '';

  try {
    const sys = await Core.AI.buildSystemPrompt({
      domain: 'fengshui', pan: currentFs, question: '',
      extraSystem: '你是一位精通玄空飞星的风水大师。运盘/山盘/向盘的星位排布是代码定论事实,不可更改。当前 ${currentFs.yun.yun}运(${currentFs.yun.yunName}),${currentFs.ws.verdict}。请结合五黄(${currentFs.wh.wuhuangAt}宫)、二黑(${currentFs.wh.erheiAt}宫)位置,给出客厅/卧室/厨房/书房的飞星布局建议与化解方案。输出要求:总字数不少于 1500 字,分章节、条理清晰、actionable。'
    });
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
    showResultActions('xkAIText', 'xkAIActions');
  } catch (e) {
    text.innerHTML = prefix + separator + '<div class="error">解读失败: ' + escapeHtml(e.message) + '</div>';
    text.style.display = 'block';
    loading.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = 'AI 解读';
    if (window.Core?.Stream?.hideStreamIndicator) window.Core.Stream.hideStreamIndicator();
  }
}
window.doAIXuankong = doAIXuankong;

function kbFengshui() {
  return '\n\n【知识库参考】八宅风水要点：\n'
    + '· 八宅由"伏位"起,沿洛书轨迹分四吉四凶星位\n'
    + '· 东四命(坎/震/巽/离) 吉位:东、南、北、东南\n'
    + '· 西四命(坤/兑/乾/艮) 吉位:西、西南、西北、东北\n'
    + '· 大门(气口)宜在生气方或延年方\n'
    + '· 主卧宜在延年或天医方,厨房灶位宜压五鬼祸害方\n'
    + '· 书房宜在伏位,文昌位则需结合流年飞星另定\n'
    + kbFengshuiBase()
    + kbFengshuiLuopan();
}