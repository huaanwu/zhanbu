/**
 * 用户反馈收集系统
 * 收集用户对AI解读的反馈，用于优化知识库和模型
 */

const Feedback = {
  // 存储键
  STORAGE_KEY: 'divination_feedback_v1',
  
  // 初始化
  init() {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
    }
  },
  
  // 提交反馈
  submit(data) {
    const feedback = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      domain: data.domain, // bazi/ziwei/liuyao/qimen/xingshi/shouxiang
      question: data.question,
      aiResponse: data.aiResponse,
      rating: data.rating, // 1-5星
      accuracy: data.accuracy, // 准确/部分准确/不准确
      comment: data.comment || '',
      userCorrection: data.userCorrection || '',
      pan: data.pan // 排盘数据（用于分析）
    };
    
    const list = this.getAll();
    list.push(feedback);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    
    // 同步到服务器（如果有网络）
    this.syncToServer(feedback);
    
    return feedback.id;
  },
  
  // 获取所有反馈
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch (e) {
      console.error('Feedback parse error:', e);
      return [];
    }
  },
  
  // 按领域统计
  getStats(domain) {
    const list = this.getAll();
    const filtered = domain ? list.filter(f => f.domain === domain) : list;
    
    const total = filtered.length;
    if (total === 0) return null;
    
    const avgRating = filtered.reduce((s, f) => s + f.rating, 0) / total;
    const accuracyCount = filtered.filter(f => f.accuracy === '准确').length;
    const partialCount = filtered.filter(f => f.accuracy === '部分准确').length;
    const inaccurateCount = filtered.filter(f => f.accuracy === '不准确').length;
    
    return {
      total,
      avgRating: Math.round(avgRating * 10) / 10,
      accuracy: Math.round(accuracyCount / total * 100),
      partial: Math.round(partialCount / total * 100),
      inaccurate: Math.round(inaccurateCount / total * 100)
    };
  },
  
  // 获取低质量反馈（用于优化）
  getLowQuality(limit = 10) {
    const list = this.getAll();
    return list
      .filter(f => f.rating <= 2 || f.accuracy === '不准确')
      .sort((a, b) => a.rating - b.rating)
      .slice(0, limit);
  },
  
  // 导出反馈数据
  export() {
    return JSON.stringify(this.getAll(), null, 2);
  },
  
  // 同步到服务器
  async syncToServer(feedback) {
    // 如果有后端API，可以在这里同步
    // 目前仅本地存储
    console.log('[Feedback] 已保存反馈:', feedback.id);
  },
  
  // 生成反馈UI
  renderUI(container, domain, question, aiResponse, pan) {
    container.innerHTML = `
      <div style="margin-top:20px;padding:15px;background:rgba(255,255,255,0.05);border-radius:8px;">
        <h4 style="margin:0 0 10px 0;color:#ffd700;">📊 解读反馈</h4>
        <p style="margin:0 0 10px 0;font-size:14px;color:#aaa;">您的反馈将帮助我们优化AI解读质量</p>
        
        <div style="margin-bottom:10px;">
          <label style="color:#aaa;font-size:13px;">准确度：</label>
          <select id="fb-accuracy" style="background:#1a1a2e;color:#fff;border:1px solid #333;padding:5px 10px;border-radius:4px;">
            <option value="">请选择</option>
            <option value="准确">准确</option>
            <option value="部分准确">部分准确</option>
            <option value="不准确">不准确</option>
          </select>
        </div>
        
        <div style="margin-bottom:10px;">
          <label style="color:#aaa;font-size:13px;">评分：</label>
          <div id="fb-stars" style="display:inline-block;">
            ${[1,2,3,4,5].map(i => `<span class="fb-star" data-rating="${i}" style="cursor:pointer;font-size:20px;color:#555;">★</span>`).join('')}
          </div>
        </div>
        
        <div style="margin-bottom:10px;">
          <label style="color:#aaa;font-size:13px;">补充说明（可选）：</label>
          <textarea id="fb-comment" style="width:100%;background:#1a1a2e;color:#fff;border:1px solid #333;padding:8px;border-radius:4px;resize:vertical;" rows="2" placeholder="请描述实际结果与解读的差异..."></textarea>
        </div>
        
        <div style="margin-bottom:10px;">
          <label style="color:#aaa;font-size:13px;">正确解读（可选）：</label>
          <textarea id="fb-correction" style="width:100%;background:#1a1a2e;color:#fff;border:1px solid #333;padding:8px;border-radius:4px;resize:vertical;" rows="2" placeholder="如果您知道正确解读，请在此补充..."></textarea>
        </div>
        
        <button id="fb-submit" style="background:#ffd700;color:#000;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:bold;">提交反馈</button>
        <span id="fb-status" style="margin-left:10px;color:#4caf50;font-size:13px;"></span>
      </div>
    `;
    
    // 星级交互
    let selectedRating = 0;
    container.querySelectorAll('.fb-star').forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.rating);
        container.querySelectorAll('.fb-star').forEach((s, i) => {
          s.style.color = i < selectedRating ? '#ffd700' : '#555';
        });
      });
    });
    
    // 提交
    container.querySelector('#fb-submit').addEventListener('click', () => {
      const accuracy = container.querySelector('#fb-accuracy').value;
      const comment = container.querySelector('#fb-comment').value;
      const correction = container.querySelector('#fb-correction').value;
      
      if (!accuracy || selectedRating === 0) {
        alert('请选择准确度和评分');
        return;
      }
      
      this.submit({
        domain,
        question,
        aiResponse,
        rating: selectedRating,
        accuracy,
        comment,
        userCorrection: correction,
        pan
      });
      
      container.querySelector('#fb-status').textContent = '✓ 已提交';
      container.querySelector('#fb-submit').disabled = true;
    });
  }
};

// 初始化
Feedback.init();

window.Feedback = Feedback;
