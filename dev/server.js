// Local stand-in for Vercel: serves public/ and routes /api/* to the handlers.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.css': 'text/css' };
const routes = {
  '/api/info': () => import('../api/info.js'),
  '/api/download': () => import('../api/download.js'),
  '/api/mcp': () => import('../api/mcp.js'),
  '/mcp': () => import('../api/mcp.js'),
};

export function createServer() {
  return http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (routes[path]) return (await routes[path]()).default(req, res);
    const file = normalize(join(root, 'public', path === '/' ? 'index.html' : path));
    if (!file.startsWith(join(root, 'public'))) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => console.log(`http://localhost:${port}`));
}
