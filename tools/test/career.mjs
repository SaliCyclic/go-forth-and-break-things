// Simulates a player's career: play highest unlocked level, buy cheapest upgrades on the way, repeat.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.argv[2]; const maxRuns = +process.argv[3] || 200; const speed = process.argv[4] || 20;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const port = 8770 + Math.floor(Math.random() * 100);
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 384, height: 216 } });
pg.on('pageerror', e => console.log('PAGEERROR', e.message));
await pg.addInitScript(() => { window.__ippResults = []; localStorage.clear(); });
await pg.goto(`http://localhost:${port}/?bot=1&speed=${speed}&faction=${process.argv[5] || 'us'}&screen=title`);
await pg.waitForFunction(() => window.__ipp && window.__ipp.screen === 'title', null, { timeout: 30000 });
const log = []; let lastLevel = 0, attempts = 0;
for (let run = 0; run < maxRuns; run++) {
  const r = await pg.evaluate(async () => {
    const app = window.__ipp; const n = window.__ippResults.length;
    const L = Math.min(app.save.unlocked, 100); app.startGame({ level: L });
    while (window.__ippResults.length === n) await new Promise(res => setTimeout(res, 100));
    const res = window.__ippResults[n];
    // spend coins: cheapest affordable, repeat
    const { CAMP, campCost } = await import('./src/data.js');
    for (;;) {
      let best = null;
      for (const k of Object.keys(CAMP)) { if (app.save.camp[k] >= CAMP[k].max) continue; const c = campCost(k, app.save.camp[k]); if (!best || c < best.c) best = { k, c }; }
      if (!best || best.c > app.save.coins) break;
      app.save.coins -= best.c; app.save.camp[best.k]++;
    }
    app.persist(); app.go('title');
    return { L, won: res.won, wave: res.waveReached, coins: res.coins, t: Math.round(res.t), camp: Object.values(app.save.camp).join(',') };
  });
  attempts++;
  if (r.won) { log.push({ level: r.L, attempts, camp: r.camp }); console.log(`L${r.L} cleared after ${attempts} tries (run ${run + 1}) t=${r.t}s camp=${r.camp}`); attempts = 0; if (r.L >= 100) break; }
  else if (attempts % 5 === 0) console.log(`  L${r.L} fail #${attempts} wave ${r.wave} +${r.coins} camp=${r.camp}`);
}
await b.close(); srv.close();
