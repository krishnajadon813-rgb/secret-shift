import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const raw = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    const pathname = decodeURIComponent(raw);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const first = relative.split('/')[0];
    if (relative !== 'index.html' && first !== 'client') { res.writeHead(404); res.end('Not found'); return; }
    const path = resolve(root, relative);
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (!(await stat(path)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:;" });
    res.end(body);
  } catch (error) { res.writeHead(error?.code === 'ENOENT' ? 404 : 400); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('SECRET SHIFT is ready at http://127.0.0.1:4173 — close this window to stop the game.'));
