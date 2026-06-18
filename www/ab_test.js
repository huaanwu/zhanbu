/**
 * A/B测试框架
 * 对比不同参数/提示词对AI解读质量的影响
 */

const ABTest = {
  STORAGE_KEY: 'divination_ab_test_v1',
  
  // 测试配置
  configs: {
    'prompt_v1': {
      name: '标准提示词',
      chainOfThought: true,
      fewshot: true,
      scoreEnabled: false
    },
    'prompt_v2': {
      name: '量化评分提示词',
      chainOfThought: true,
      fewshot: true,
      scoreEnabled: true
    },
    'rag_v1': {
      name: '标准RAG',
      topK: 8,
      maxChars: 2500,
      sourceBoost: true
    },
    'rag_v2': {
      name: '深度RAG',
      topK: 12,
      maxChars: 3500,
      sourceBoost: true
    }
  },
  
  // 初始化
  init() {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        activeTest: null,
        results: []
      }));
    }
  },
  
  // 开始测试
  start(testId, configA, configB) {
    const data = this.getData();
    data.activeTest = {
      id: testId,
      configA,
      configB,
      startTime: new Date().toISOString(),
      samples: { a: [], b: [] }
    };
    this.saveData(data);
    return data.activeTest;
  },
  
  // 获取当前测试配置（随机分配）
  getConfig() {
    const data = this.getData();
    if (!data.activeTest) return null;
    
    // 随机分配A/B
    const isA = Math.random() < 0.5;
    const configKey = isA ? data.activeTest.configA : data.activeTest.configB;
    return {
      variant: isA ? 'A' : 'B',
      config: this.configs[configKey] || {},
      configKey
    };
  },
  
  // 记录结果
  record(result) {
    const data = this.getData();
    if (!data.activeTest) return;
    
    const sample = {
      timestamp: new Date().toISOString(),
      variant: result.variant,
      domain: result.domain,
      question: result.question,
      aiResponse: result.aiResponse,
      userRating: result.userRating,
      responseTime: result.responseTime
    };
    
    data.activeTest.samples[result.variant.toLowerCase()].push(sample);
    this.saveData(data);
  },
  
  // 结束测试并生成报告
  end() {
    const data = this.getData();
    if (!data.activeTest) return null;
    
    const { samples } = data.activeTest;
    const report = {
      testId: data.activeTest.id,
      duration: new Date().toISOString(),
      configA: data.activeTest.configA,
      configB: data.activeTest.configB,
      sampleCount: {
        A: samples.a.length,
        B: samples.b.length
      },
      avgRating: {
        A: samples.a.length > 0 ? samples.a.reduce((s, r) => s + r.userRating, 0) / samples.a.length : 0,
        B: samples.b.length > 0 ? samples.b.reduce((s, r) => s + r.userRating, 0) / samples.b.length : 0
      },
      avgResponseTime: {
        A: samples.a.length > 0 ? samples.a.reduce((s, r) => s + r.responseTime, 0) / samples.a.length : 0,
        B: samples.b.length > 0 ? samples.b.reduce((s, r) => s + r.responseTime, 0) / samples.b.length : 0
      }
    };
    
    // 保存结果
    data.results.push(report);
    data.activeTest = null;
    this.saveData(data);
    
    return report;
  },
  
  // 获取数据
  getData() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || { activeTest: null, results: [] };
    } catch {
      return { activeTest: null, results: [] };
    }
  },
  
  // 保存数据
  saveData(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },
  
  // 获取所有报告
  getReports() {
    return this.getData().results;
  },
  
  // 导出报告
  exportReport(reportId) {
    const reports = this.getReports();
    const report = reports.find(r => r.testId === reportId);
    return report ? JSON.stringify(report, null, 2) : null;
  }
};

// 初始化
ABTest.init();

window.ABTest = ABTest;
