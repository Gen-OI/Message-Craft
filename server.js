const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── SET YOUR OPENROUTER API KEY HERE ────────────────────────────────────────────
const OPENROUTER_API_KEY = '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';
// ─────────────────────────────────────────────────────────────────────────────

const PORT = 3456;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function proxyOpenRouter(body, res) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('YOUR_OPENROUTER_API_KEY')) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API key not configured in server.js' }));
    return;
  }

  const payload = JSON.stringify(body);
  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Length': Buffer.byteLength(payload),
      'HTTP-Referer': 'http://localhost:3456',
      'X-Title': 'MessageCraft'
    },
  };

  const req = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      cors(res);
      res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  });

  req.on('error', (e) => {
    cors(res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.write(payload);
  req.end();
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // API proxy route
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        proxyOpenRouter(JSON.parse(body), res);
      } catch {
        cors(res);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // Static file serving
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (e2, d2) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ MessageCraft running at http://localhost:${PORT}`);
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes('YOUR_OPENROUTER_API_KEY')) {
    console.warn('⚠️  No API key set! Edit OPENROUTER_API_KEY in server.js');
  } else {
    console.log('🔑 OpenRouter API key loaded.');
  }
});
