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
      res.on('end', () => resolve(JSON.parse(result)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
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
console.log('正在发送:', fileName);
console.log('接收者:', receiverId);

getToken()
  .then(token => {
    console.log('已获取token，正在上传文件...');
    return sendFile(token, filePath, receiverId);
  })
  .then(data => {
    console.log('发送成功! message_id:', data.message_id);
  })
  .catch(err => {
    console.error('发送失败:', err.message);
    process.exit(1);
  });