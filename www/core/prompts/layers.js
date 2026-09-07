/**
 * 分层提示词结构(任务 #25)
 *
 * 三层结构,各层独立可调:
 *   【事实层】命盘数据 — 代码生成,100% 准确,模型严禁修改
 *   【规则层】知识库规则 + 历史校准 — RAG/反馈系统提供
 *   【推理层】用户问题 + 输出要求 — 让模型做推理
 *
 * 优势:
 *   - 模型先认事实,降低幻觉概率
 *   - 每层可独立优化(规则更新不影响推理模板)
 *   - 推理层可加 CoT/Few-shot 而不污染事实层
 */

(function () {
  'use strict';

  // ===== 通用硬约束(推理层底) =====
  const HARD_CONSTRAINTS = `
【硬性约束 · 严禁违反】
1. 严禁编造命盘数据、卦象数字、星曜位置 — 以【事实层】为准,若事实层缺失请说"信息不足"
2. 严禁给出医疗、投资、法律确定性建议
3. 不确定时明确说"此解读仅供参考,实际情况因人而异"
4. 引用规则时标注【来源:xxx_kb】,若 KB 未覆盖则不强行解释
5. 避免使用绝对化词汇("一定"、"必然"、"绝对"),改为"可能"、"通常"、"倾向于"
6. 同一段输出里不要重复相同结论,每章给出新角度
7. 严禁输出英文段落,必须纯中文(术语可保留英文)

【输出结构建议 · 任务 #27】
1. 结尾必须包含一行:## 置信度: XX/100(根据事实完整度、规则匹配度、KB 覆盖度自评)
2. 若置信度低于 60,在解读开头明确标注"⚠️ 此解读仅供参考,信息不足"
3. 结尾给 2-4 条 actionable 建议,每条不超过一行
`;

  // ===== 推理层:各模块的任务指令 =====
  const TASK_INSTRUCTIONS = {
    bazi: `【推理任务】
基于上述【事实层】的八字排盘,结合【规则层】的相关知识库和历史校准,回答用户的具体问题。

【输出结构建议】
1. 用神判断(身强弱 → 喜忌神 → 调候)
2. 格局分析(正格/从格/化格)
3. 十神组合含义(针对问题)
4. 大运流年提示(若用户问及)
5. 具体建议(2-3 条 actionable 行动)`,

    ziwei: `【推理任务】
基于上述【事实层】的紫微排盘,结合【规则层】,回答用户问题。

【输出结构建议】
1. 命主特质(主星庙旺利陷)
2. 宫位解读(对应问题相关宫位)
3. 四化飞化(化禄/权/科/忌 路径)
4. 大限流年(若用户问及)
5. 具体建议`,

    liuyao: `【推理任务】
基于上述【事实层】的卦象和爻位,结合【规则层】,回答用户问题。

【输出结构建议】
1. 体用分析(体卦 vs 用卦)
2. 用神判断(世爻/应爻/伏神)
3. 爻位动静(动爻变化方向)
4. 吉凶判断 + 应期
5. 具体建议`,

    qimen: `【推理任务】
基于上述【事实层】的奇门盘,结合【规则层】,回答用户问题。

【输出结构建议】
1. 用神落宫(天盘/地盘/九星/八门/八神)
2. 旺衰判断(生克关系)
3. 格局吉凶(伏吟/反吟/三奇得使等)
4. 应期方位
5. 具体建议`,

    cross: `【推理任务】
三术同参:对同一问题,从八字、紫微、六爻/奇门三个维度交叉验证。
若三术结论一致 → 高置信;若冲突 → 分析差异原因,标注【不确定】`,

    fengshui: `【推理任务】
基于户型方位和命卦,给出具体可执行的风水调整方案。重点说明:
1. 命卦与宅卦是否相合
2. 四吉方(生气/天医/延年/伏位)如何利用
3. 四凶方(祸害/六煞/五鬼/绝命)如何化解
4. 卧室/客厅/厨房/书房的最佳布局
输出要求:分章节,总字数不少于 1500 字,条理清晰,actionable。`,

    xingshi: `【推理任务】
基于五格剖象(天格/人格/地格/外格/总格),解读姓名的吉凶含义。
重点说明:
1. 人格(主运,14-25 岁)
2. 地格(基础运,26-36 岁)
3. 总格(后运,37 岁后)
4. 三才配置(天人地关系)
注意:吉数并非绝对好,需配合三才平衡。`,

    shouxiang: `【推理任务】
基于手相照片,详细解读先天命格与后天运势。
重点:掌型/三大主线/辅助纹/掌丘/手指特征,左右手对比。`,

    mianxiang: `【推理任务】
基于面相照片(五官/三停/十二宫),详细解读。
重点:流年运势/性格特质/健康提示。`,

    daofo: `【推理任务】
你是道佛化解导师。用户描述困扰 → 结合道佛知识库给出 2-3 个化解方案。
每个方案含:方法 / 频次 / 时机 / 注意事项。
末尾提醒"化解为辅,修心为本;行善积德方为根本"。`,
    chat: `【推理任务】
作为占卜助手回答用户追问。简洁、聚焦、直接给结论,不绕弯子。`
  };

  // ===== 事实层包装 =====
  function wrapFacts(facts, opts = {}) {
    if (!facts) return '';
    const header = opts.crossMode
      ? '【事实层·三术同参·各术100%准确】'
      : '【事实层·100%准确·以本节为准,严禁修改】';
    return `${header}\n${facts}\n\n`;
  }

  // ===== 规则层包装(RAG/历史/反馈) =====
  function wrapRules(ragContent, historyPrompt, feedbackCalib, riskPrompt) {
    const parts = [];
    if (ragContent) parts.push(`【规则层·知识库片段】\n${ragContent}`);
    if (historyPrompt) parts.push(historyPrompt); // 已是带【历史校准】前缀
    if (feedbackCalib) parts.push(feedbackCalib);
    if (riskPrompt) parts.push(riskPrompt);
    return parts.length === 0 ? '' : parts.join('\n') + '\n';
  }

  // ===== 推理层包装(任务指令 + 硬约束) =====
  function wrapReasoning(domain, question, extraInstruction) {
    const task = TASK_INSTRUCTIONS[domain] || TASK_INSTRUCTIONS.chat;
    const userQ = question ? `\n【用户问题】${question}\n` : '';
    return `${task}\n${userQ}${extraInstruction ? '\n' + extraInstruction + '\n' : ''}\n${HARD_CONSTRAINTS}`;
  }

  // ===== 组装三层 =====
  function assemble({ domain, facts, ragContent, historyPrompt, feedbackCalib, riskPrompt, question, extraInstruction, crossMode }) {
    const factLayer = wrapFacts(facts, { crossMode });
    const ruleLayer = wrapRules(ragContent, historyPrompt, feedbackCalib, riskPrompt);
    const reasoningLayer = wrapReasoning(domain, question, extraInstruction);
    return factLayer + ruleLayer + reasoningLayer;
  }

  window.CorePrompts = {
    assemble,
    wrapFacts,
    wrapRules,
    wrapReasoning,
    HARD_CONSTRAINTS,
    TASK_INSTRUCTIONS
  };
})();