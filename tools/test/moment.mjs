// open a URL, wait until a JS condition is true, then screenshot
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const [root, q, cond, out, vp = '1560x720', clearLS = '1'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const port = 8900 + Math.floor(Math.random() * 90);
const srv = http.createServer((rq, r) => { const u = decodeURIComponent(rq.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
const [w, h] = vp.split('x').map(Number);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: w, height: h } });
pg.on('pageerror', e => console.log('PAGEERROR', e.message));
if (clearLS === '1') await pg.addInitScript(() => { try { if (!sessionStorage.x) { localStorage.clear(); sessionStorage.x = 1; } } catch (e) {} });
await pg.goto(`http://localhost:${port}/${q}`);
try { await pg.waitForFunction(cond, null, { timeout: 60000, polling: 50 }); } catch (e) { console.log('TIMEOUT'); }
await pg.screenshot({ path: out });
console.log(await pg.evaluate(() => window.__ipp.error || 'ok'));
await b.close(); srv.close();
