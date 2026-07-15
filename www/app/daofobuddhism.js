// ========== 道佛化解页（v1.2.17） ==========
let _dfCurrentTab = 'qian';
let _dfQianDrawCount = 0;

// 灵签数据：v1.2.18 改从 KB 加载（buddhism_divine_kb.json 的 100 签）
// 兼容老代码：如果 KB 未加载，使用硬编码的 20 签 MVP
const QIAN_FALLBACK = [
  { num: 1, level: '上上', title: '钟离成道', poem: '开天辟地作良缘，吉日良时万物全。', desc: '大吉。所求遂意。', advice: '佩平安符，诵大悲咒。' },
  { num: 2, level: '中吉', title: '苏秦不第', poem: '鲸鱼未变守江河，不可升腾更望高。', desc: '先难后易。', advice: '耐心等待，金光神咒。' },
  { num: 3, level: '上吉', title: '董永卖身', poem: '临风冒雨去还乡，孝子心诚意感长。', desc: '孝感天地。', advice: '孝顺父母，心经 21 遍。' }
];

// 从 KB 提取 100 签（bdiv_09 之后为具体签文）
function getQianFromKB() {
  const k = _kb?.buddhism_divine;
  if (!k?.entries) return null;
  const qianEntries = k.entries.filter(e => e.id && e.id.startsWith('bdiv_') && e.poem);
  if (qianEntries.length === 0) return null;
  return qianEntries.map(e => ({
    num: parseInt(e.id.replace('bdiv_', '')),
    level: e.level || '中平',
    title: e.title ? e.title.replace(/观音灵签第\d+签·/, '') : '',
    poem: e.poem,
    desc: e.desc || '',
    advice: e.advice || ''
  }));
}

function getQianData() {
  return getQianFromKB() || QIAN_FALLBACK;
}

function switchDfTab(name) {
  _dfCurrentTab = name;
  document.querySelectorAll('.df-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === name;
    btn.style.background = isActive ? 'var(--bg-card)' : 'var(--bg-card)';
    btn.style.borderColor = isActive ? 'var(--accent-gold)' : 'var(--border)';
    btn.style.color = isActive ? 'var(--accent-gold)' : 'var(--text-primary)';
  });
  document.querySelectorAll('.df-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById('dfTab' + name[0].toUpperCase() + name.slice(1));
  if (target) target.style.display = 'block';
  // 切换时按需渲染
  if (name === 'fu') renderFuList();
  if (name === 'jue') renderJueList();
}

// ========== 灵签抽签 ==========
function drawQian() {
  _dfQianDrawCount++;
  document.getElementById('qianIdle').style.display = 'none';
  document.getElementById('qianShaking').style.display = 'block';
  document.getElementById('qianResult').style.display = 'none';
  document.getElementById('qianAgain').style.display = 'none';
  setTimeout(() => {
    const data = getQianData();
    const idx = Math.floor(Math.random() * data.length);
    const q = data[idx];
    const levelColor = q.level === '上上' ? 'var(--accent-gold)' : q.level === '上吉' ? 'var(--accent-green)' : q.level === '中吉' ? 'var(--accent-gold)' : q.level === '中平' ? 'var(--text-secondary)' : 'var(--accent-red)';
    const ctx = window._dfCurrentQuestion ? '\n\n【问事参考】' + window._dfCurrentQuestion : '';
    const ctxDiv = ctx ? safeHTML`<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">${ctx}</div>` : '';
    document.getElementById('qianResult').innerHTML = safeHTML`
      <div style="text-align:center;padding:1rem;background:var(--bg-inner);border-radius:8px;border:1px solid var(--accent-gold);">
        <div style="font-size:0.8rem;color:var(--text-muted);">第 ${q.num} 签 · 共 ${data.length} 签</div>
        <div style="font-size:1.5rem;font-weight:bold;color:${levelColor};margin:0.3rem 0;">${q.level}签</div>
        <div style="font-size:1.1rem;color:var(--accent-gold);margin:0.3rem 0;">${q.title}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);font-style:italic;margin:0.3rem 0;line-height:1.5;">${q.poem}</div>
        <div style="font-size:0.9rem;color:var(--text-primary);margin:0.5rem 0;line-height:1.6;">${q.desc}</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border);">💡 化解：${q.advice}</div>
        ${safeHTML.raw(ctxDiv)}
      </div>
    `;
    document.getElementById('qianResult').style.display = 'block';
    document.getElementById('qianAgain').style.display = 'inline-block';
    document.getElementById('qianShaking').style.display = 'none';
  }, 1500);
}

// ========== 符箓速查 ==========
let _fuCategory = 'all';
function renderFuList() {
  const kw = document.getElementById('fuSearch')?.value?.trim() || '';
  const kb = (typeof _kb !== 'undefined' ? _kb : window._kb)?.daoism_fuzhou;
  if (!kb?.entries) {
    document.getElementById('fuList').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem;">知识库加载中...</div>';
    return;
  }
  // 分类栏
  const cats = ['all', ...new Set(kb.entries.map(e => e.category))];
const catBar = cats.map(c => {
  const isActive = _fuCategory === c;
  return safeHTML`<button data-cat="${c}" style="padding:0.25rem 0.5rem;background:${isActive?'var(--accent-gold)':'var(--bg-primary)'};color:${isActive?'#1a1612':'var(--text-primary)'};border:1px solid var(--border);border-radius:4px;font-size:0.7rem;cursor:pointer;">${c==='all'?'全部':c}</button>`;
}).join('');
document.getElementById('fuCategoryBar').innerHTML = catBar;
document.querySelectorAll('#fuCategoryBar [data-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    _fuCategory = btn.dataset.cat;
    renderFuList();
  });
});
  // 列表
  let list = kb.entries;
  if (_fuCategory !== 'all') list = list.filter(e => e.category === _fuCategory);
  if (kw) {
    const k = kw.toLowerCase();
    list = list.filter(e => (e.title||'').toLowerCase().includes(k) || (e.function||'').toLowerCase().includes(k) || (e.target||'').toLowerCase().includes(k));
  }
  if (list.length === 0) {
    document.getElementById('fuList').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem;">无匹配结果</div>';
    return;
  }
  document.getElementById('fuList').innerHTML = list.map(e => {
    const svgHtml = e.fuType ? renderFuSvg(e.fuType, e.title) : '';
    return `
    <div style="border-bottom:1px solid var(--border);padding:0.5rem 0;">
      <div style="display:flex;align-items:center;gap:0.3rem;">
        <span style="font-size:0.7rem;background:var(--bg-inner);color:var(--accent-gold);padding:0.1rem 0.4rem;border-radius:4px;">${escapeHtml(e.category)}</span>
        <b style="color:var(--accent-gold);font-size:0.95rem;">${escapeHtml(e.title)}</b>
      </div>
      ${svgHtml ? `<div style="text-align:center;margin:0.3rem 0;">${svgHtml}</div>` : ''}
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.3rem;line-height:1.5;">${escapeHtml(e.content)}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">
        ${e.function ? '<b>作用：</b>' + escapeHtml(e.function) + ' · ' : ''}
        ${e.usage ? '<b>用法：</b>' + escapeHtml(e.usage) : ''}
        ${e.target ? '<br><b>适用：</b>' + escapeHtml(e.target) : ''}
      </div>
    </div>
  `;}).join('');
}

// ========== 手诀教程 ==========
let _jueCategory = 'all';
// ========== 手部 SVG 生成器（v1.2.19） ==========
// fingers: [thumb, index, middle, ring, pinky] 0=伸 1=半弯 2=扣
// type: 'single' 单手 | 'double' 双手相对 | 'pair' 双手交叠
function renderHandSvg(fingers, opts = {}) {
  const { title = '', type = 'single', size = 160 } = opts;
  const SKIN = '#f4c7a1', SKIN_DARK = '#dba77e', LINE = '#5a3a2a', GOLD = '#c9a84c';
  const W = 200, H = 240;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0.3rem auto;background:#fffaf0;border-radius:8px;">`;

  // 单指绘制：state 0=伸 1=半弯 2=扣
  const drawFinger = (x, state, isMiddle = false) => {
    if (state === 0) {  // 伸
      const h = isMiddle ? 120 : 100;
      return `<rect x="${x-9}" y="15" width="18" height="${h}" rx="9" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>
              <line x1="${x-4}" y1="20" x2="${x-4}" y2="${15+h*0.6}" stroke="${SKIN_DARK}" stroke-width="0.8" opacity="0.5"/>`;
    } else if (state === 1) {  // 半弯
      return `<path d="M ${x-9} 80 Q ${x-9} 130 ${x+9} 130 L ${x+9} 100 Q ${x+9} 90 ${x-9} 80 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    } else {  // 扣 - 显示为短弯贴在掌心
      return `<path d="M ${x-8} 110 Q ${x-8} 128 ${x+8} 128 L ${x+8} 120 Q ${x+8} 112 ${x-8} 110 Z" fill="${SKIN_DARK}" stroke="${LINE}" stroke-width="1.5"/>`;
    }
  };

  // 拇指绘制（位置在掌心左外侧）
  const drawThumb = (state, side = 'left') => {
    const x = side === 'left' ? 50 : 150;
    if (state === 0) {  // 伸
      return `<rect x="${x-30}" y="130" width="30" height="18" rx="9" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8" transform="rotate(-30 ${x} 140)"/>`;
    } else if (state === 1) {
      return `<path d="M ${x-25} 130 Q ${x-10} 125 ${x} 135 L ${x} 150 Q ${x-15} 155 ${x-25} 145 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    } else {  // 扣
      return `<path d="M ${x-18} 145 Q ${x-10} 140 ${x} 145 L ${x} 158 Q ${x-12} 162 ${x-18} 155 Z" fill="${SKIN_DARK}" stroke="${LINE}" stroke-width="1.5"/>`;
    }
  };

  if (type === 'double') {
    // 双手相对（太极印/太极阴阳手）：左+右 各画一只手相对
    // 左手
    svg += `<g transform="translate(0,0)">`;
    svg += `<rect x="20" y="120" width="60" height="80" rx="18" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    [0,1,2,3].forEach(i => svg += drawFinger(30 + i*15, fingers[i] !== undefined ? fingers[i] : 0, i===2));
    svg += drawThumb(fingers[4] !== undefined ? fingers[4] : 2, 'left');
    svg += `</g>`;
    // 右手
    svg += `<g transform="translate(120,0)">`;
    svg += `<rect x="40" y="120" width="60" height="80" rx="18" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    [0,1,2,3].forEach(i => svg += drawFinger(50 + i*15, fingers[i] !== undefined ? fingers[i] : 0, i===2));
    svg += drawThumb(fingers[4] !== undefined ? fingers[4] : 2, 'right');
    svg += `</g>`;
    // 双手之间的小圆（太极）
    svg += `<circle cx="100" cy="120" r="8" fill="${GOLD}" opacity="0.6"/>`;
  } else if (type === 'pair') {
    // 双手交叠（抱元印）：上下叠放
    svg += `<g transform="translate(0,0)">`;
    svg += `<rect x="40" y="80" width="120" height="50" rx="15" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8" opacity="0.6"/>`;
    svg += `<rect x="50" y="100" width="100" height="50" rx="15" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    svg += `<text x="100" y="135" text-anchor="middle" font-size="11" fill="${LINE}">双手交叠</text>`;
    svg += `</g>`;
  } else if (type === 'palmpair') {
    // 八卦印：左掌+右剑指
    svg += `<g transform="translate(0,0)">`;
    svg += `<rect x="20" y="120" width="60" height="60" rx="15" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    [0,1,2,3].forEach(i => svg += drawFinger(30 + i*15, 2, false));
    svg += drawThumb(2, 'left');
    svg += `</g>`;
    svg += `<g transform="translate(110,0)">`;
    svg += drawFinger(35, 0, false);
    svg += drawFinger(50, 0, false);
    svg += `</g>`;
    svg += `<text x="50" y="200" text-anchor="middle" font-size="9" fill="${LINE}">左掌</text>`;
    svg += `<text x="145" y="200" text-anchor="middle" font-size="9" fill="${LINE}">右剑指</text>`;
  } else if (type === 'flow') {
    // 六甲/六丁/子午诀：拇指在 4 指上循环 - 简化画法
    svg += `<rect x="60" y="120" width="80" height="80" rx="18" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    [0,1,2,3].forEach(i => svg += drawFinger(72 + i*15, 0, i===2));
    // 拇指在 4 指上画 8 个点
    [0,1,2,3].forEach(finger => {
      svg += `<circle cx="${72+finger*15}" cy="20" r="3" fill="${GOLD}"/>`;  // 尖
      svg += `<circle cx="${72+finger*15}" cy="115" r="3" fill="${GOLD}"/>`; // 根
    });
    // 拇指伸向第一个点
    svg += `<line x1="60" y1="100" x2="${72}" y2="20" stroke="${GOLD}" stroke-width="2" stroke-dasharray="3,2"/>`;
  } else {
    // 默认单手
    svg += `<rect x="60" y="120" width="80" height="80" rx="18" fill="${SKIN}" stroke="${LINE}" stroke-width="1.8"/>`;
    [0,1,2,3].forEach(i => svg += drawFinger(72 + i*15, fingers[i] !== undefined ? fingers[i] : 0, i===2));
    svg += drawThumb(fingers[4] !== undefined ? fingers[4] : 2, 'left');
  }

  // 标题
  if (title) {
    svg += `<text x="100" y="${H-8}" text-anchor="middle" font-size="13" font-weight="bold" fill="${GOLD}">${title}</text>`;
  }
  svg += '</svg>';
  return svg;
}

// 简化的单手 SVG（向后兼容旧 API）
function drawHandSVG(fingers, title) {
  return renderHandSvg(fingers, { title });
}

// ========== 符箓 SVG 生成器（v1.2.19） ==========
// fuType: bagua/sword/mountain/ingot/five_ingot/tower/flower/star/gourd/peach/cloud/hehe/pouch
function renderFuSvg(fuType, title, opts = {}) {
  const { size = 160 } = opts;
  const W = 180, H = 240;
  const PAPER = '#f4e4bc', PAPER_DARK = '#e6d29a', GOLD = '#c9a84c', GOLD_DARK = '#8b6f2a';
  const RED = '#c94c4c', RED_DARK = '#8b2222', BLACK = '#2a2018';
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0.3rem auto;background:${PAPER};border-radius:6px;">`;
  svg += `<rect x="6" y="6" width="${W-12}" height="${H-12}" fill="none" stroke="${GOLD}" stroke-width="2"/>`;
  svg += `<rect x="10" y="10" width="${W-20}" height="${H-20}" fill="none" stroke="${GOLD}" stroke-width="0.8"/>`;
  svg += `<rect x="20" y="14" width="${W-40}" height="24" fill="${RED}" opacity="0.9"/>`;
  svg += `<text x="${W/2}" y="32" text-anchor="middle" font-size="14" font-weight="bold" fill="${PAPER}" font-family="'Noto Serif SC',serif;">${title || '符箓'}</text>`;
  const cx = W/2, cy = 110;
  if (fuType === 'bagua') {
    svg += `<circle cx="${cx}" cy="${cy}" r="55" fill="none" stroke="${GOLD_DARK}" stroke-width="2"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="48" fill="none" stroke="${GOLD_DARK}" stroke-width="0.8"/>`;
    svg += `<path d="M ${cx} ${cy-40} A 40 40 0 0 1 ${cx} ${cy+40} A 20 20 0 0 1 ${cx} ${cy-20} A 20 20 0 0 0 ${cx} ${cy-40} Z" fill="${BLACK}"/>`;
    svg += `<path d="M ${cx} ${cy-40} A 40 40 0 0 0 ${cx} ${cy+40} A 20 20 0 0 0 ${cx} ${cy-20} A 20 20 0 0 1 ${cx} ${cy-40} Z" fill="${PAPER}" stroke="${BLACK}" stroke-width="1"/>`;
    svg += `<circle cx="${cx}" cy="${cy-25}" r="4" fill="${BLACK}"/>`;
    svg += `<circle cx="${cx}" cy="${cy+15}" r="4" fill="${PAPER}" stroke="${BLACK}" stroke-width="1"/>`;
  } else if (fuType === 'sword') {
    svg += `<rect x="${cx-3}" y="50" width="6" height="100" fill="${RED}"/>`;
    svg += `<polygon points="${cx-15},50 ${cx+15},50 ${cx},38" fill="${RED}"/>`;
    svg += `<rect x="${cx-20}" y="65" width="40" height="5" fill="${GOLD_DARK}"/>`;
    svg += `<rect x="${cx-20}" y="120" width="40" height="5" fill="${GOLD_DARK}"/>`;
    svg += `<text x="${cx}" y="100" text-anchor="middle" font-size="20" font-weight="bold" fill="${GOLD_DARK}">雷</text>`;
  } else if (fuType === 'mountain') {
    const peaks = [[cx-40, 70, 18], [cx-20, 60, 20], [cx, 50, 22], [cx+20, 60, 20], [cx+40, 70, 18]];
    peaks.forEach(([x, y, h]) => { svg += `<polygon points="${x-h},${y+10} ${x},${y} ${x+h},${y+10}" fill="${GOLD_DARK}" stroke="${BLACK}" stroke-width="1"/>`; });
    svg += `<text x="${cx}" y="135" text-anchor="middle" font-size="14" font-weight="bold" fill="${BLACK}">鎮</text>`;
  } else if (fuType === 'ingot') {
    svg += `<path d="M ${cx-50} 100 L ${cx+50} 100 L ${cx+40} 130 L ${cx-40} 130 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="2"/>`;
    svg += `<path d="M ${cx-40} 100 L ${cx-30} 80 L ${cx+30} 80 L ${cx+40} 100 Z" fill="${GOLD_DARK}"/>`;
    svg += `<text x="${cx}" y="120" text-anchor="middle" font-size="20" font-weight="bold" fill="${RED}">財</text>`;
  } else if (fuType === 'five_ingot') {
    const positions = [[cx-50, 110], [cx-25, 95], [cx, 90], [cx+25, 95], [cx+50, 110]];
    positions.forEach(([x, y]) => {
      svg += `<path d="M ${x-12} ${y} L ${x+12} ${y} L ${x+9} ${y+12} ${x-9} ${y+12} Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="1.5"/>`;
      svg += `<path d="M ${x-9} ${y} L ${x-6} ${y-8} L ${x+6} ${y-8} L ${x+9} ${y} Z" fill="${GOLD_DARK}"/>`;
    });
    svg += `<text x="${cx}" y="155" text-anchor="middle" font-size="16" font-weight="bold" fill="${RED}">五路財神</text>`;
  } else if (fuType === 'tower') {
    for (let i = 0; i < 4; i++) {
      const w = 50 - i * 8, y = 65 + i * 18;
      svg += `<rect x="${cx-w/2}" y="${y}" width="${w}" height="14" fill="${PAPER_DARK}" stroke="${BLACK}" stroke-width="1.5"/>`;
      svg += `<polygon points="${cx-w/2-3},${y} ${cx+w/2+3},${y} ${cx},${y-8}" fill="${GOLD_DARK}"/>`;
    }
    svg += `<text x="${cx}" y="160" text-anchor="middle" font-size="14" font-weight="bold" fill="${BLACK}">文昌</text>`;
  } else if (fuType === 'flower') {
    for (let i = 0; i < 5; i++) {
      const angle = i * 72 * Math.PI / 180;
      const px = cx + 30 * Math.cos(angle), py = cy + 30 * Math.sin(angle);
      svg += `<ellipse cx="${px}" cy="${py}" rx="20" ry="14" fill="#e8a4a4" stroke="#c94c4c" stroke-width="1.5" transform="rotate(${i*72} ${px} ${py})"/>`;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="${GOLD}"/>`;
    svg += `<text x="${cx}" y="160" text-anchor="middle" font-size="14" font-weight="bold" fill="${RED}">桃花</text>`;
  } else if (fuType === 'star') {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 45 : 20;
      const angle = i * Math.PI / 5 - Math.PI / 2;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    svg += `<polygon points="${points.join(' ')}" fill="${GOLD_DARK}" stroke="${BLACK}" stroke-width="1.5"/>`;
    svg += `<text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="18" font-weight="bold" fill="${PAPER}">太歲</text>`;
  } else if (fuType === 'gourd') {
    svg += `<path d="M ${cx-15} 60 L ${cx-15} 75 Q ${cx-25} 80 ${cx-25} 95 Q ${cx-25} 130 ${cx} 130 Q ${cx+25} 130 ${cx+25} 95 Q ${cx+25} 80 ${cx+15} 75 L ${cx+15} 60 Z" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="2"/>`;
    svg += `<circle cx="${cx}" cy="60" r="6" fill="${GOLD_DARK}"/>`;
    svg += `<text x="${cx}" y="105" text-anchor="middle" font-size="14" font-weight="bold" fill="${RED}">壽</text>`;
  } else if (fuType === 'peach') {
    svg += `<ellipse cx="${cx}" cy="100" rx="45" ry="35" fill="#f0a4a4" stroke="#c94c4c" stroke-width="2"/>`;
    svg += `<path d="M ${cx-8} 65 Q ${cx} 55 ${cx+8} 65 L ${cx+5} 70 L ${cx-5} 70 Z" fill="${GOLD_DARK}"/>`;
    svg += `<text x="${cx}" y="115" text-anchor="middle" font-size="28" font-weight="bold" fill="${RED}">壽</text>`;
  } else if (fuType === 'cloud') {
    for (let i = 0; i < 3; i++) {
      const y = 70 + i * 22;
      svg += `<path d="M ${cx-50} ${y} Q ${cx-40} ${y-10} ${cx-20} ${y} Q ${cx} ${y+5} ${cx+20} ${y} Q ${cx+40} ${y-10} ${cx+50} ${y} L ${cx+50} ${y+5} L ${cx-50} ${y+5} Z" fill="${PAPER_DARK}" stroke="${GOLD_DARK}" stroke-width="1.5"/>`;
    }
    svg += `<text x="${cx}" y="160" text-anchor="middle" font-size="14" font-weight="bold" fill="${BLACK}">平安</text>`;
  } else if (fuType === 'hehe') {
    svg += `<circle cx="${cx-20}" cy="95" r="22" fill="#f0a4a4" stroke="${GOLD_DARK}" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx+20}" cy="95" r="22" fill="#f0a4a4" stroke="${GOLD_DARK}" stroke-width="1.5"/>`;
    svg += `<text x="${cx-20}" y="102" text-anchor="middle" font-size="18" font-weight="bold" fill="${RED}">合</text>`;
    svg += `<text x="${cx+20}" y="102" text-anchor="middle" font-size="18" font-weight="bold" fill="${RED}">和</text>`;
  } else if (fuType === 'pouch') {
    svg += `<path d="M ${cx-40} 80 L ${cx+40} 80 L ${cx+35} 150 L ${cx-35} 150 Z" fill="${RED}" stroke="${RED_DARK}" stroke-width="2"/>`;
    svg += `<rect x="${cx-25}" y="70" width="50" height="15" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx}" cy="65" r="5" fill="${GOLD_DARK}"/>`;
    svg += `<text x="${cx}" y="120" text-anchor="middle" font-size="14" font-weight="bold" fill="${GOLD}">化太歲</text>`;
  } else {
    svg += `<circle cx="${cx}" cy="${cy}" r="50" fill="none" stroke="${RED}" stroke-width="3"/>`;
    svg += `<text x="${cx}" y="${cy+8}" text-anchor="middle" font-size="40" font-weight="bold" fill="${RED}">符</text>`;
  }
  svg += `<rect x="${cx-30}" y="195" width="60" height="20" fill="${RED}" stroke="${RED_DARK}" stroke-width="1.5" opacity="0.9"/>`;
  svg += `<text x="${cx}" y="210" text-anchor="middle" font-size="13" font-weight="bold" fill="${PAPER}" font-family="'Noto Serif SC',serif;">敕令</text>`;
  svg += '</svg>';
  return svg;
}

function renderJueList() {
  const kb = (typeof _kb !== 'undefined' ? _kb : window._kb)?.daoism_shoujue;
  if (!kb?.entries) {
    document.getElementById('jueList').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem;">知识库加载中...</div>';
    return;
  }
  const cats = ['all', ...new Set(kb.entries.map(e => e.category))];
const catBar = cats.map(c => {
  const isActive = _jueCategory === c;
  return safeHTML`<button data-cat="${c}" style="padding:0.25rem 0.5rem;background:${isActive?'var(--accent-gold)':'var(--bg-primary)'};color:${isActive?'#1a1612':'var(--text-primary)'};border:1px solid var(--border);border-radius:4px;font-size:0.7rem;cursor:pointer;">${c==='all'?'全部':c}</button>`;
}).join('');
document.getElementById('jueCategoryBar').innerHTML = catBar;
document.querySelectorAll('#jueCategoryBar [data-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    _jueCategory = btn.dataset.cat;
    renderJueList();
  });
});
  let list = kb.entries;
  if (_jueCategory !== 'all') list = list.filter(e => e.category === _jueCategory);
  document.getElementById('jueList').innerHTML = list.map(e => {
    const svgHtml = e.handType ? renderHandSvg(e.fingers || [], { title: e.title, type: e.handType }) : '';
    return `
    <div style="border-bottom:1px solid var(--border);padding:0.5rem 0;">
      <div style="display:flex;align-items:center;gap:0.3rem;">
        <span style="font-size:0.7rem;background:var(--bg-inner);color:var(--accent-gold);padding:0.1rem 0.4rem;border-radius:4px;">${escapeHtml(e.category)}</span>
        <b style="color:var(--accent-gold);font-size:0.95rem;">${escapeHtml(e.title)}</b>
      </div>
      ${svgHtml ? `<div style="text-align:center;margin:0.3rem 0;">${svgHtml}</div>` : ''}
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.3rem;line-height:1.5;">${escapeHtml(e.content)}</div>
      <div style="font-size:0.75rem;color:var(--accent-green);margin-top:0.3rem;padding:0.3rem;background:var(--bg-inner);border-radius:4px;">
        <b>手势：</b>${escapeHtml(e.shape || '见上图')}
      </div>
      ${e.shape_detail ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.3rem;padding:0.3rem;background:var(--bg-inner);border-radius:4px;"><b>详细步骤：</b>${escapeHtml(e.shape_detail)}</div>` : ''}
      ${e.finger_map ? `<div style="font-size:0.75rem;color:var(--accent-green);margin-top:0.3rem;"><b>指位说明：</b>${escapeHtml(e.finger_map)}</div>` : ''}
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">
        <b>使用：</b>${escapeHtml(e.usage || '')}
      </div>
      ${e.pair_with && e.pair_with.length ? `<div style="font-size:0.75rem;color:var(--accent-gold);margin-top:0.3rem;"><b>配伍：</b>${e.pair_with.map(escapeHtml).join(' · ')}</div>` : ''}
    </div>
  `;}).join('');
}

// ========== AI 化解 ==========
async function doAiHuaJie() {
  const input = document.getElementById('aiHuaJieInput')?.value?.trim();
  if (!input) { showToast('请描述你的困扰', 'error'); return; }
  await ensureKB();
  await loadKBGroup('daofobuddhism');
  const result = document.getElementById('aiHuaJieResult');
  result.style.display = 'block';
  result.innerHTML = '<div class="loading"><div class="spinner"></div><p style="margin-top:0.5rem;color:var(--text-secondary);">AI 正在结合道佛知识库生成化解方案...</p></div>';

  // 构建 system prompt
  // v3.0.5: system prompt 统一由 Core.AI.buildSystemPrompt() 组装(任务 #23)
    // daofobuddhism 特殊:全文传 extraSystem(KB 函数在 system 字符串内直接调用)
    const system = Core.AI.buildSystemPrompt({ domain: 'daofobuddhism', pan: {}, question: input, extraSystem: `你是一位精通道教与佛教化解法门的导师。请根据用户描述的困扰，结合道佛知识库给出具体、可执行的化解方案。

【优先使用：场景化解库（30 个标准场景方案）】
${kbDaoismJiuhuo()}

【道佛知识库】
${kbDaoismFuzhou()}
${kbDaoismZhoushu()}
${kbDaoismShoujue()}
${kbBuddhismMantra()}
${kbBuddhismDivine()}

【输出要求】
1. 先简短共情用户处境（1-2句）
2. **优先匹配场景库**：如果用户困扰接近某个标准场景，可直接套用场景库的组合方案
3. 推荐 2-3 个化解方案（每个含：方法 / 频次 / 时机 / 注意事项）
4. 符箓、手诀、咒语、行善建议可组合
5. 最后提醒"化解为辅，修心为本；行善积德方为根本"
6. 用通俗易懂的语言，300-500字` });

  const prompt = `我的困扰：${input}\n\n请给出化解方案。`;
  try {
    // v3.0.5: 统一 AI 入口(任务 #19)— 单次非流式调用,直接渲染到 result.innerHTML
    const { finalText: text } = await Core.AI.interpret({
      domain: 'daofobuddhism',
      prompt,
      system,
      question: input,
      callOpts: { temperature: 0.3 },
    });
    result.innerHTML = safeHTML`<div style="background:var(--bg-inner);border-radius:8px;padding:0.8rem;line-height:1.7;font-size:0.9rem;white-space:pre-wrap;">${text}</div>
      <div style="margin-top:0.5rem;display:flex;gap:0.4rem;justify-content:flex-end;">
        <button class="df-copy-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);padding:0.3rem 0.6rem;border-radius:4px;font-size:0.75rem;cursor:pointer;">📋 复制</button>
      </div>`;
    const copyBtn = result.querySelector('.df-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => showToast('已复制', 'success')).catch(() => showToast('复制失败', 'error'));
      });
    }
  } catch (e) {
    result.innerHTML = `<div class="error">化解生成失败：${escapeHtml(e.message)}</div>`;
  }
}