/**
 * 命盘可视化
 * 用 SVG 绘制真实盘面图形
 */

const Visual = {
  // ===== 六爻卦象 SVG =====
  // lines: [1,0,1,1,0,1] 从下往上（1=阳，0=阴）
  // dongYaoList: [3,5] 动爻位置（1-6，从下往上）
  drawLiuyao(pan) {
    if (!pan?.gua?.lines) return '';
    const lines = pan.gua.lines; // 数组，index 0=第1爻（最下）
    const dongList = pan.gua.dongYaoList || [];
    const guaName = pan.gua.name || '';

    const W = 220, H = 320;
    const lineW = 160, lineH = 18;
    const gap = 36;
    const startX = (W - lineW) / 2;
    const startY = H - 40; // 第1爻起始Y（从下往上画）

    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:260px;margin:0 auto;display:block;">`;

    // 背景
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="none"/>`;

    // 卦名
    svg += `<text x="${W/2}" y="28" text-anchor="middle" fill="var(--accent-gold)" font-size="18" font-weight="bold">${guaName}</text>`;

    // 画6爻（从下往上，lines[0]=第1爻在最下）
    for (let i = 0; i < 6; i++) {
      const yaoNum = i + 1; // 爻位 1-6
      const isYang = lines[i] === 1;
      const isDong = dongList.includes(yaoNum);
      const y = startY - i * gap;

      // 爻位标签（右侧）
      svg += `<text x="${startX + lineW + 12}" y="${y + lineH - 2}" fill="var(--text-muted)" font-size="12">${yaoNum}爻</text>`;

      if (isYang) {
        // 阳爻：一条完整横线
        svg += `<rect x="${startX}" y="${y}" width="${lineW}" height="${lineH}" rx="3" fill="var(--accent-gold)" ${isDong ? 'stroke="var(--accent-red)" stroke-width="2"' : ''}/>`;
      } else {
        // 阴爻：两条短横线
        const segW = 68, segGap = 24;
        svg += `<rect x="${startX}" y="${y}" width="${segW}" height="${lineH}" rx="3" fill="#a09888" ${isDong ? 'stroke="var(--accent-red)" stroke-width="2"' : ''}/>`;
        svg += `<rect x="${startX + segW + segGap}" y="${y}" width="${segW}" height="${lineH}" rx="3" fill="#a09888" ${isDong ? 'stroke="var(--accent-red)" stroke-width="2"' : ''}/>`;
      }

      // 动爻标记（红色圆点）
      if (isDong) {
        svg += `<circle cx="${startX - 15}" cy="${y + lineH/2}" r="6" fill="var(--accent-red)"/>`;
        svg += `<text x="${startX - 15}" y="${y + lineH/2 + 4}" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">动</text>`;
      }

      // 爻位名称（初/二/三/四/五/上）
      const yaoLabel = ['初', '二', '三', '四', '五', '上'][i];
      svg += `<text x="${startX - 35}" y="${y + lineH - 2}" text-anchor="end" fill="var(--text-secondary)" font-size="12">${yaoLabel}</text>`;
    }

    // 变卦指示（如果有动爻）
    if (dongList.length > 0) {
      svg += `<text x="${W/2}" y="${H - 8}" text-anchor="middle" fill="var(--accent-red)" font-size="12">动爻：第${dongList.join('、')}爻 → 变卦</text>`;
    } else {
      svg += `<text x="${W/2}" y="${H - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="12">静卦（无动爻）</text>`;
    }

    svg += '</svg>';
    return svg;
  },

  // ===== 奇门九宫格 SVG =====
  drawQimen(pan) {
    if (!pan?.gong9) return '';
    const W = 320, H = 320;
    const cellW = W / 3, cellH = H / 3;

    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:360px;margin:0 auto;display:block;">`;

    // 背景
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="var(--border)" stroke-width="2"/>`;

    // 九宫格线
    svg += `<line x1="${cellW}" y1="0" x2="${cellW}" y2="${H}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<line x1="${cellW*2}" y1="0" x2="${cellW*2}" y2="${H}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<line x1="0" y1="${cellH}" x2="${W}" y2="${cellH}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<line x1="0" y1="${cellH*2}" x2="${W}" y2="${cellH*2}" stroke="var(--border)" stroke-width="1"/>`;

    // 宫格数据（按洛书九宫顺序：4-9-2 / 3-5-7 / 8-1-6）
    const gridOrder = [
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6]
    ];

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const gongNum = gridOrder[row][col];
        const gong = pan.gong9.find(g => g.number === gongNum);
        if (!gong) continue;

        const x = col * cellW, y = row * cellH;
        const cx = x + cellW / 2, cy = y + cellH / 2;

        // 宫名背景（值符/值使高亮）
        if (gong.is_dipan_zhifu || gong.is_renpan_zhishi) {
          svg += `<rect x="${x+2}" y="${y+2}" width="${cellW-4}" height="${cellH-4}" fill="rgba(201,168,76,0.1)" rx="4"/>`;
        }

        // 宫名
        svg += `<text x="${x+8}" y="${y+18}" fill="var(--accent-gold)" font-size="11" font-weight="bold">${gong.name}</text>`;

        // 天盘
        if (gong.tianpan) {
          svg += `<text x="${cx}" y="${cy-15}" text-anchor="middle" fill="var(--text-primary)" font-size="14" font-weight="bold">${gong.tianpan}</text>`;
        }
        // 地盘
        if (gong.dipan) {
          svg += `<text x="${cx}" y="${cy+5}" text-anchor="middle" fill="var(--text-secondary)" font-size="14">${gong.dipan}</text>`;
        }
        // 人盘（门）
        if (gong.renpan) {
          svg += `<text x="${cx}" y="${cy+25}" text-anchor="middle" fill="var(--accent-green)" font-size="12">${gong.renpan}</text>`;
        }
        // 九星
        if (gong.jiuxing) {
          svg += `<text x="${x+cellW-8}" y="${y+18}" text-anchor="end" fill="var(--text-muted)" font-size="10">${gong.jiuxing}</text>`;
        }
      }
    }

    svg += '</svg>';
    return svg;
  }
};

window.Visual = Visual;
