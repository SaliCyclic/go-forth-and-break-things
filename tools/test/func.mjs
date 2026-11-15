import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const port = 8800 + Math.floor(Math.random() * 90);
const srv = http.createServer((rq, r) => { const u = decodeURIComponent(rq.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(port);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 648 } });
pg.on('pageerror', e => console.log('PAGEERROR', e.message));
await pg.goto(`http://localhost:${port}/?debug=1`);
await pg.waitForFunction(() => window.__ipp && window.__ipp.screen === 'title');
const out = await pg.evaluate(async () => {
  const a = window.__ipp; const log = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  localStorage.clear();
  a.go('slots'); a.slot = 1; a.go('faction'); a.buttons[0].onClick();          // new Realm save in slot 1
  log.push('camp:' + a.screen);
  a.save.unlocked = 12; a.save.coins = 5000; a.persist();
  // back navigation chain
  a.go('records'); a.back(); log.push('records->' + a.screen);
  a.back(); log.push('camp->' + a.screen); log.push('slots back->' + (a.back(), a.screen)); log.push('title back returns ' + a.back());
  // export / import round trip
  a.go('slots');
  const exp = a.buttons.find(x => x.label === 'EXPORT'); exp.onClick(); await sleep(50);
  const code = document.querySelector('textarea').value; log.push('code len ' + code.length + ' ' + code.slice(0, 6));
  log.push('dialog back closes: ' + a.back() + ' ' + !document.querySelector('textarea'));
  const imp = a.buttons.find(x => x.label === 'IMPORT'); imp.onClick(); await sleep(50);
  document.querySelector('textarea').value = 'garbage'; document.querySelector('.ok').click(); await sleep(20);
  log.push('bad code msg: ' + document.querySelector('.msg').textContent.slice(0, 20));
  document.querySelector('textarea').value = code; document.querySelector('.ok').click(); await sleep(20);
  const s2 = JSON.parse(localStorage.getItem('ipp-slot-2')); log.push('imported slot2 unlocked=' + s2.unlocked + ' coins=' + s2.coins);
  // achievements on load of camp
  a.slot = 1; a.save = JSON.parse(localStorage.getItem('ipp-slot-1')); a.save.stats = a.save.stats || {}; a.save.ach = a.save.ach || {}; a.checkAch();
  log.push('ach: ' + Object.keys(a.save.ach).join(',') + ' toasts ' + a.toasts.length + ' coins ' + a.save.coins);
  // daily
  a.go('camp'); a.input.bot = true; a.speed = 20; a.startGame({ daily: true });
  log.push('daily: L' + a.game.level + ' mod ' + a.game.daily.mod);
  for (let i = 0; i < 400 && a.game.state === 'play'; i++) await sleep(50);
  log.push('daily result ' + JSON.stringify({ won: a.result.won, bonus: a.result.dailyBonus, dw: a.save.stats.dailyWins, daily: a.save.daily }));
  return log;
});
console.log(out.join('\n'));
await pg.screenshot({ path: '/home/claude/preview/f_end.png' });
await b.close(); srv.close();
