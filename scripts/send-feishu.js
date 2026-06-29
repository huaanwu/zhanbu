#!/usr/bin/env node
/**
 * 发送文件到飞书
 * 用法: node send-feishu.js <file_path> [receiver_id]
 *
 * receiver_id 可选，默认为武华安群
 *
 * 鉴权: 从环境变量 FEISHU_APP_ID / FEISHU_APP_SECRET 读取,
 *       切勿将 secret 硬编码到本文件或提交到 git(参考 CLAUDE.md 安全约束)。
 *       推荐在 ~/.bashrc / .env.local 导出:
 *         export FEISHU_APP_ID='cli_xxxxx'
 *         export FEISHU_APP_SECRET='xxxxx'
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const DEFAULT_RECEIVER = process.env.FEISHU_DEFAULT_RECEIVER || 'oc_e3a7996129088271400f488ef0afff95'; // 武华安群

if (!APP_ID || !APP_SECRET) {
  console.error('缺少 FEISHU_APP_ID / FEISHU_APP_SECRET 环境变量');
  console.error('请先在 shell 导出(或写入 .env.local 后 source):');
  console.error('  export FEISHU_APP_ID="cli_xxxxx"');
  console.error('  export FEISHU_APP_SECRET="xxxxx"');
  process.exit(1);
}

async function getToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const options = {
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    let result = '';
    const req = https.request(options, res => {
      res.on('data', d => result += d);
      res.on('end', () => {
        const json = JSON.parse(result);
        if (json.code === 0) resolve(json.tenant_access_token);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendFile(token, filePath, receiverId) {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
    Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file_name"\r\n\r\n${fileName}\r\n`),
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file_type"\r\n\r\nstream\r\n`),
    Buffer.from(`--${boundary}--\r\n`)
  ]);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'open.feishu.cn',
      path: '/open-apis/im/v1/files',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    };
    let result = '';
    const req = https.request(options, res => {
      res.on('data', d => result += d);
      res.on('end', () => {
        const json = JSON.parse(result);
        if (json.code === 0) {
          sendMessage(token, json.data.file_key, receiverId);
          resolve(json.data);
        } else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMessage(token, fileKey, receiverId) {
  const data = JSON.stringify({
    receive_id: receiverId,
    msg_type: 'file',
    content: JSON.stringify({ file_key: fileKey })
  });

  return postFeishuMessage(token, data);
}

// 飞书发文本消息(msg_type=text)
async function sendTextMessage(token, receiverId, text) {
  const data = JSON.stringify({
    receive_id: receiverId,
    msg_type: 'text',
    content: JSON.stringify({ text })
  });
  return postFeishuMessage(token, data);
}

function postFeishuMessage(token, data) {
  const options = {
    hostname: 'open.feishu.cn',
    path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    let result = '';
    const req = https.request(options, res => {
      res.on('data', d => result += d);
      res.on('end', () => {
        const json = JSON.parse(result);
        if (json.code === 0) resolve(json);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ===== 版本信息自动同步 =====
// 从 www/index.html 顶部读 var APP_VERSION = '...'
function readAppVersion(rootDir) {
  try {
    const html = fs.readFileSync(path.join(rootDir, 'www', 'index.html'), 'utf-8');
    const m = html.match(/var\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return m ? m[1] : 'unknown';
  } catch (e) {
    console.warn('[send-feishu] 读 APP_VERSION 失败:', e.message);
    return 'unknown';
  }
}

// 从 CHANGELOG.md 读最新段(第一个 ## vX.Y.Z 起到下一个 ## vX.Y.Z 之前)
function readLatestChangelog(rootDir) {
  try {
    const md = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf-8');
    const lines = md.split('\n');
    const startIdx = lines.findIndex(l => /^##\s+v?\d+\.\d+/.test(l));
    if (startIdx < 0) return '';
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (/^##\s+v?\d+\.\d+/.test(lines[i])) { endIdx = i; break; }
    }
    return lines.slice(startIdx, endIdx).join('\n').trim();
  } catch (e) {
    console.warn('[send-feishu] 读 CHANGELOG.md 失败:', e.message);
    return '';
  }
}

// 把 CHANGELOG 一段精简成最多 N 行的飞书消息摘要
function buildAnnouncement(version, changelog, maxLines = 8) {
  const lines = changelog.split('\n');
  // 取标题 + 前 maxLines 行实质内容(跳过空行和标题分隔)
  const summary = [];
  for (const l of lines) {
    if (/^##\s/.test(l) || /^---/.test(l)) continue;
    if (l.trim() === '') {
      if (summary.length > 0) summary.push('');
      continue;
    }
    summary.push(l);
    if (summary.length >= maxLines) break;
  }
  return `📦 AI占卜大师 ${version}\n\n${summary.join('\n').trim()}`;
}

const filePath = process.argv[2];
const receiverId = process.argv[3] || DEFAULT_RECEIVER;

if (!filePath) {
  console.log('用法: node send-feishu.js <file_path> [receiver_id]');
  console.log('示例: node send-feishu.js ./app-debug.apk');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('文件不存在:', filePath);
  process.exit(1);
}

var fileName = path.basename(filePath);
var rootDir = path.resolve(__dirname, '..');
var appVersion = readAppVersion(rootDir);
var changelog = readLatestChangelog(rootDir);
var announcement = buildAnnouncement(appVersion, changelog);

console.log('正在发送:', fileName);
console.log('版本:', appVersion);
console.log('接收者:', receiverId);

getToken()
  .then(token => {
    console.log('已获取token，正在上传文件...');
    return sendFile(token, filePath, receiverId);
  })
  .then(data => {
    console.log('APK 上传成功, file_key:', data.file_key);
    // 推完文件后,发一条版本公告文本消息
    return getToken().then(t => sendTextMessage(t, receiverId, announcement)).then(() => data);
  })
  .then(data => {
    console.log('版本公告已发送:', appVersion);
  })
  .catch(err => {
    console.error('发送失败:', err.message);
    process.exit(1);
  });