// 简易静态文件服务器（修复 Windows 路径下根 URL 404）
const http = require('http');
const fs = require('fs');
const path = require('path');

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let p = path.join(process.cwd(), decodeURIComponent(req.url).split('?')[0]);
  // 根 URL、目录路径：补 index.html
  if (p === process.cwd() || /[\\/]$/.test(p)) p = path.join(p, 'index.html');

  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

server.listen(8090, () => console.log('Server running at http://localhost:8090 (cwd=' + process.cwd() + ')'));
