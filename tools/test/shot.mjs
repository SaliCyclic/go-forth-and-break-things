import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.argv[2]; const shots = JSON.parse(process.argv[3]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(8765);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 648 } });
pg.on('pageerror', e => console.log('PAGEERROR', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
for (const s of shots) {
  await pg.goto('http://localhost:8765/' + (s.q || ''));
  for (const a of (s.actions || [])) { if (a.wait) await pg.waitForTimeout(a.wait); if (a.click) await pg.mouse.click(a.click[0] * 3, a.click[1] * 3); if (a.eval) console.log(await pg.evaluate(a.eval)); }
  await pg.waitForTimeout(s.wait || 1500);
  if (s.out) await pg.screenshot({ path: s.out });
  if (s.eval) console.log(await pg.evaluate(s.eval));
}
await b.close(); srv.close();
