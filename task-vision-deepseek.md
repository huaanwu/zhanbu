# 修真任务：识图模块云端统一走 DeepSeek 视觉模型

项目根 D:\get\zhanbu，改 www/ 下文件。

## 背景（排查结论，直接按此修）
DeepSeek 2026-08-21 上线了视觉模型 `deepseek-v4-flash-vision-exp`（实验性），API 还是 `https://api.deepseek.com/v1/chat/completions`，OpenAI 格式 messages 里 content 数组混 `{type:'text'}` + `{type:'image_url', image_url:{url:'data:image/jpeg;base64,...'}}`。

当前乱象：
1. 设置页"识图模型"下拉（index.html #visionModelSelect）只有 qwen-vl-plus/qwen-vl-max（阿里云百炼残留），默认 `core/settings.js` 里 fallback 'qwen-vl-plus'。
2. 但 `app/shouxiang.js:491` 和 `app/mianxiang.js:286` 云端 fallback 实际打的是 **DeepSeek endpoint**（ds_base_url + ds_api_key），model 却取 `vision_model` —— 用户若存过 qwen-vl-plus，就是拿 qwen 模型名打 DeepSeek，必 400/404；没存过则默认 deepseek-v4-flash（纯文本模型），收图片也必挂。**云端识图两条路全断**。

## 用户决策（已确认）
- 识图类模块（手相 shouxiang、面相 mianxiang）**云端一律走 DeepSeek 视觉模型**。
- **本地链路不动**：本地 llama-server（mmproj 多模态）优先逻辑保持现状。

## 改动点
1. `www/app/shouxiang.js` + `www/app/mianxiang.js` 云端 fallback：
   - model 取值逻辑改为：`localStorage.getItem('vision_model')`，仅当以 'deepseek' 开头时采用，否则强制 `'deepseek-v4-flash-vision-exp'`（清掉 qwen 残留值的破坏性）。
   - key 用 `ds_api_key`，endpoint 用 `ds_base_url`（现有代码已是，保持不变）。
2. `www/index.html` 设置页：
   - "识图 API Key (阿里云百炼)" 输入框整个 setting-item 删除（识图已复用 DeepSeek key）；#visionKeyInput 相关引用一并清。
   - "识图模型"下拉改为：`<option value="deepseek-v4-flash-vision-exp" selected>deepseek-v4-flash-vision-exp (DeepSeek 视觉·实验)</option>`，可保留 qwen 两项但标注"(百炼·已废弃)"；label 改"云端识图模型"。
3. `www/core/settings.js`：vision_model 的默认 fallback 'qwen-vl-plus' → 'deepseek-v4-flash-vision-exp'；删掉 vision_api_key 的读写（若 #visionKeyInput 已删）；loadSettings/saveSettings 同步。
4. `www/core/ai-service.js` MODEL_PRICING 加 `'deepseek-v4-flash-vision-exp': { input: 1, output: 2, label: 'DeepSeek-V4-Flash-Vision(识图)' }`（价格按 flash 档先填）。
5. `www/sw.js` SW_VERSION 升一级；`index.html` 涉及改动脚本的 ?v= 升一级。
6. 若 test 文件里有 vision_model/qwen-vl 相关断言，同步更新。

## 验收（我会独立重跑）
```bash
cd /d/get/zhanbu/www
node test_all.js 2>&1 | tail -5
node --check app/shouxiang.js && node --check app/mianxiang.js && node --check core/settings.js && node --check core/ai-service.js
grep -rn "qwen-vl-plus'" app/ core/ | grep -v node_modules   # 不应再有作为默认值的残留
```
输出：每处改动一句话 + 验收真实输出。
