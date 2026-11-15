import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.argv[2]; const runs = JSON.parse(process.argv[3]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(8766);
const b = await chromium.launch();
async function one(q) {
  const ctx = await b.newContext({ viewport: { width: 384, height: 216 } }); const pg = await ctx.newPage();
  await pg.addInitScript(() => { window.__ippResults = []; });
  pg.on('pageerror', e => console.log('PAGEERROR', q, e.message));
  await pg.goto('http://localhost:8766/?' + q);
  const t0 = Date.now(); let res = null;
  while (Date.now() - t0 < 120000) { res = await pg.evaluate(() => window.__ippResults[0] || (window.__ipp.error ? { error: window.__ipp.error } : null)); if (res) break; await pg.waitForTimeout(300); }
  const extra = await pg.evaluate(() => { const g = window.__ipp.game; return g ? { peak: g.peak, weapon: g.weapon, wlv: g.wlv, wave: g.wave } : null; });
  await ctx.close(); return { q, ...res, ...extra };
}
const out = []; const conc = 6;
for (let i = 0; i < runs.length; i += conc) out.push(...await Promise.all(runs.slice(i, i + conc).map(one)));
for (const r of out) console.log(JSON.stringify(r));
await b.close(); srv.close();
