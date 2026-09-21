// Small static server for testing dist/ locally. It mimics Vercel by applying the redirects and
// response headers in vercel.json (including the Content-Security-Policy), so audits see real behaviour.
// Usage: node scripts/serve.mjs [port]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const redirects = new Map(config.redirects.map((r) => [r.source, r.destination]));
const globalHeaders = config.headers.find((h) => h.source === '/(.*)').headers;
const cacheRules = config.headers.filter((h) => h.source !== '/(.*)').map((h) => ({ prefix: h.source.replace('/(.*)', '/'), headers: h.headers }));

export function startServer(port = 4400) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (redirects.has(pathname)) {
      res.writeHead(301, { Location: redirects.get(pathname) });
      return res.end();
    }

    let file = path.join(dist, pathname);
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    let status = 200;

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(308, { Location: pathname + '/' + url.search });
        return res.end();
      }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) {
      file = path.join(dist, '404.html');
      status = 404;
    }

    const headers = { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' };
    for (const h of globalHeaders) headers[h.key] = h.value;
    for (const rule of cacheRules) if (pathname.startsWith(rule.prefix)) for (const h of rule.headers) headers[h.key] = h.value;

    const stat = fs.statSync(file);
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range && status === 200) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(status, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('serve.mjs')) {
  const port = Number(process.argv[2] ?? 4400);
  await startServer(port);
  console.log(`Serving dist/ at http://localhost:${port}`);
}
