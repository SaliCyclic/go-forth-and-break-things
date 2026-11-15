// App shell: loading, screens, input, saving, loop (MIT)
import { W, DW, H, setW, MAX_LEVEL, CAMP, campCost, biomeOf, FACTIONS, HEROES, MASTERY_MAX, masteryCost } from './data.js';
import { Game, groundTexture } from './game.js';
import { drawText, textWidth } from './font.js';
import { initAudio, sfx, setSfx, setMusic, playMusic } from './audio.js';
import { UI, INK, INK_SOFT, PAL, setTheme, panel, smallTile, Button, ribbon, drawStar, drawTent, shortNum } from './ui.js';

const params = new URLSearchParams(location.search);

// ---------------- assets ----------------
const BUNDLE = window.__BUNDLE || null;
function loadImg(src) {
  if (BUNDLE && BUNDLE.files[src]) src = BUNDLE.files[src];
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + src)); i.src = src; });
}
function tintCanvas(img, mode) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], gr = p[i + 1], b = p[i + 2];
    if (mode === 'red') { p[i] = Math.min(255, gr * 1.15 + 20); p[i + 1] = r * 0.55; p[i + 2] = b * 0.6; }
    else if (mode === 'ghost') { const l = (r + gr + b) / 3; p[i] = l * 0.8 + 40; p[i + 1] = l * 0.95 + 50; p[i + 2] = Math.min(255, l * 1.1 + 80); p[i + 3] = p[i + 3] * 0.85; }
    else if (mode === 'dark') { p[i] = r * 0.5 + 20; p[i + 1] = gr * 0.4; p[i + 2] = b * 0.6 + 25; }
  }
  g.putImageData(d, 0, 0); return c;
}
async function loadAssets(onProgress) {
  const manifest = BUNDLE ? BUNDLE.manifest : await (await fetch('assets/manifest.json')).json();
  const jobs = []; let done = 0;
  const L = (src, set) => jobs.push(loadImg(src).then(i => { set(i); onProgress(++done / jobs.length); }));
  const A = { manifest, chars: {}, props: {}, fx: {}, traps: {}, icons: {}, biomes: [], tints: {} };
  for (const [k, v] of Object.entries(manifest.chars)) L(v.src, i => A.chars[k] = i);
  for (const [k, v] of Object.entries(manifest.props)) L(v, i => A.props[k] = i);
  for (const [k, v] of Object.entries(manifest.fx)) L(v.src, i => A.fx[k] = i);
  for (const [k, v] of Object.entries(manifest.traps)) L(v.src, i => A.traps[k] = i);
  for (const [k, v] of Object.entries(manifest.icons)) L(v, i => A.icons[k] = i);
  A.ui = {}; for (const [k, v] of Object.entries(manifest.ui)) L(v, i => A.ui[k] = i);
  A.villagers = {}; for (const [k, v] of Object.entries(manifest.villagers)) L(v.src, i => A.villagers[k] = i);
  L(manifest.arrow, i => A.arrow = i);
  A.arrows = {}; for (const [k, v] of Object.entries(manifest.arrows)) L(v, i => A.arrows[k] = i);
  A.camp = {}; for (const [k, v] of Object.entries(manifest.camp)) L(v, i => A.camp[k] = i);
  A.campAnim = {}; for (const [k, v] of Object.entries(manifest.campAnim)) L(v.src, i => A.campAnim[k] = i);
  manifest.biomes.forEach((b, bi) => {
    A.biomes[bi] = { name: b.name, layers: b.layers.map(l => ({ speed: l.speed, img: null })) };
    b.layers.forEach((l, li) => L(l.src, i => A.biomes[bi].layers[li].img = i));
  });
  A.biomesH = [];
  manifest.biomesH.forEach((b, bi) => {
    A.biomesH[bi] = { name: b.name, ground: b.ground, layers: b.layers.map(l => ({ speed: l.speed, y: l.y, img: null })) };
    b.layers.forEach((l, li) => L(l.src, i => A.biomesH[bi].layers[li].img = i));
  });
  // biome sets per faction: the Realm fights through bright lands, the Horde through dusk lands
  A.biomeSet = f => (f === 'them' ? A.biomesH : A.biomes);
  await Promise.all(jobs);
  A.sheet = (name, tint) => {
    if (!tint) return A.chars[name];
    const k = name + ':' + tint; if (!A.tints[k]) A.tints[k] = tintCanvas(A.chars[name], tint);
    return A.tints[k];
  };
  return A;
}

// ---------------- saves: 3 slots + global settings ----------------
const SLOT_KEY = n => `ipp-slot-${n}`;
const SETTINGS_KEY = 'ipp-settings';
const emptyCamp = () => Object.fromEntries(Object.keys(CAMP).map(k => [k, 0]));
function newSave(faction) {
  const heroes = {};
  for (const id of FACTIONS[faction].heroes) heroes[id] = { u: HEROES[id].unlock === 0, m: 0 };
  return { v: 2, faction, hero: FACTIONS[faction].heroes[0], heroes, unlocked: 1, stars: {}, coins: 0, camp: emptyCamp(), bestEndless: 0, runs: 0, created: Date.now() };
}
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
function loadSlot(n) {
  const s = readJSON(SLOT_KEY(n));
  if (!s || s.v !== 2) return null;
  const base = newSave(s.faction || 'us');
  return { ...base, ...s, camp: { ...emptyCamp(), ...(s.camp || {}) }, heroes: { ...base.heroes, ...(s.heroes || {}) } };
}
function migrateV1() {
  // the first preview stored one save; move it into slot 1 as a Realm archer
  const old = readJSON('infinite-pew-pew-save-v1');
  if (!old || readJSON(SLOT_KEY(1))) return;
  const s = newSave('us'); Object.assign(s, { unlocked: old.unlocked || 1, stars: old.stars || {}, coins: old.coins || 0, bestEndless: old.bestEndless || 0 });
  s.camp = { ...emptyCamp(), ...(old.camp || old.armory || {}) };
  writeJSON(SLOT_KEY(1), s);
}

// ---------------- App ----------------
class App {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    migrateV1();
    this.settings = { sfx: true, music: true, theme: 'auto', ...(readJSON(SETTINGS_KEY) || {}) };
    setSfx(this.settings.sfx); setMusic(this.settings.music);
    this.slot = 0; this.save = null;
    // test/debug hooks: ?faction=them&hero=imp&camp=N builds a throwaway save in memory
    if (params.has('faction') || params.has('level') || params.has('endless') || params.has('camp') || params.has('screen')) {
      const f = params.get('faction') === 'them' ? 'them' : 'us';
      this.save = newSave(f);
      if (params.has('hero') && HEROES[params.get('hero')]) { this.save.hero = params.get('hero'); this.save.heroes[this.save.hero].u = true; }
      if (params.has('camp')) { const v = +params.get('camp'); for (const k of Object.keys(CAMP)) this.save.camp[k] = Math.min(CAMP[k].max, k === 'quart' ? Math.floor(v / 8) : v); }
      if (params.has('coins')) this.save.coins = +params.get('coins');
    }
    this.input = { up: false, down: false, dragDy: 0, bot: params.has('bot') };
    this.speed = Math.max(1, Math.min(20, +params.get('speed') || 1));
    this.screen = 'loading'; this.progress = 0; this.buttons = []; this.t = 0;
    this.page = 0;
    this.bindInput();
    window.__ipp = this;
  }

  async start() {
    this.loop();
    try { this.assets = await loadAssets(p => this.progress = p); Object.assign(UI, this.assets.ui); }
    catch (e) { this.error = String(e); return; }
    const lvl = +params.get('level');
    if (params.has('endless')) this.startGame({ endless: true });
    else if (lvl) this.startGame({ level: Math.max(1, Math.min(MAX_LEVEL, lvl)) });
    else if (params.has('screen')) this.go(params.get('screen'));
    else this.go('title');
  }

  applyTheme() {
    const t = this.settings.theme === 'auto' ? (this.save && this.save.faction === 'them' ? 'dark' : 'paper') : this.settings.theme;
    setTheme(t);
  }
  go(screen) {
    this.screen = screen; this.buttons = []; this.overlay = null; this.confirmErase = this.confirmErase && screen === 'slots' ? this.confirmErase : 0;
    this.applyTheme();
    const b = {
      title: () => this.buildTitle(), slots: () => this.buildSlots(), faction: () => this.buildFaction(),
      heroes: () => this.buildHeroes(), camp: () => this.buildCamp(), levels: () => this.buildLevels(),
    }[screen];
    if (b) b();
  }
  persist() { if (this.slot) writeJSON(SLOT_KEY(this.slot), this.save); }
  persistSettings() { writeJSON(SETTINGS_KEY, this.settings); }
  get fi() { return this.save && this.save.faction === 'them' ? 1 : 0; }
  hero() { return HEROES[this.save.hero]; }

  // ----- title -----
  buildTitle() {
    const cx = DW / 2;
    const chip = (x, label, on, fn) => new Button(x, H - 20, 36, 16, label, fn, { kind: 'tile', ink: on ? INK : INK_SOFT });
    this.buttons = [
      new Button(cx - 70, 112, 140, 22, 'PLAY', () => this.go('slots'), { style: 'go', scale: 1 }),
      chip(DW - 118, this.settings.sfx ? 'SFX' : 'sfx', this.settings.sfx, () => this.toggle('sfx')),
      chip(DW - 79, this.settings.music ? 'MUS' : 'mus', this.settings.music, () => this.toggle('music')),
      new Button(DW - 40, H - 20, 38, 16, { auto: 'AUTO', paper: 'LITE', dark: 'DARK' }[this.settings.theme], () => {
        this.settings.theme = { auto: 'paper', paper: 'dark', dark: 'auto' }[this.settings.theme]; this.persistSettings(); this.go('title');
      }, { kind: 'tile' }),
    ];
  }
  toggle(k) {
    this.settings[k] = !this.settings[k]; this.persistSettings();
    if (k === 'sfx') setSfx(this.settings.sfx); else setMusic(this.settings.music);
    this.go(this.screen);
  }

  // ----- save slots -----
  buildSlots() {
    const b = [];
    for (let n = 1; n <= 3; n++) {
      const s = loadSlot(n); const x = 22 + (n - 1) * 116;
      b.push(new Button(x, 40, 108, 126, '', () => {
        this.slot = n;
        if (s) { this.save = s; this.go('camp'); } else { this.save = null; this.go('faction'); }
      }, { kind: 'tile', extra: (ctx, bt, py) => this.drawSlotCard(ctx, bt, py, n, s) }));
      if (s) b.push(new Button(x + 24, 170, 60, 18, this.confirmErase === n ? 'SURE?' : 'ERASE', () => {
        if (this.confirmErase === n) { try { localStorage.removeItem(SLOT_KEY(n)); } catch (e) { /* ignore */ } this.confirmErase = 0; sfx.gateBad(); }
        else this.confirmErase = n;
        this.go('slots');
      }, { kind: 'tile', ink: PAL.accent }));
    }
    b.push(new Button(4, H - 26, 76, 22, '< BACK', () => this.go('title')));
    this.buttons = b;
  }
  drawSlotCard(ctx, bt, py, n, s) {
    const cx = bt.x + bt.w / 2;
    drawText(ctx, `SLOT ${n}`, cx, py + 6, { align: 'center', color: INK_SOFT, outline: null });
    if (!s) {
      drawText(ctx, 'NEW GAME', cx, py + 54, { align: 'center', scale: 1, color: INK, outline: null });
      drawText(ctx, '+', cx, py + 70, { align: 'center', scale: 3, color: PAL.good, outline: null });
      return;
    }
    const f = FACTIONS[s.faction]; const h = HEROES[s.hero];
    drawText(ctx, f.name, cx, py + 18, { align: 'center', color: PAL.accent, outline: null });
    this.drawChar(ctx, h.sheet, 'idle', cx, py + 70, { scale: 2 });
    drawText(ctx, h.name, cx, py + 76, { align: 'center', color: INK, outline: null });
    drawText(ctx, `LEVEL ${Math.min(s.unlocked, MAX_LEVEL)}/${MAX_LEVEL}`, cx, py + 90, { align: 'center', color: INK, outline: null });
    ctx.drawImage(this.assets.icons.coin, cx - 26, py + 101, 11, 11);
    drawText(ctx, shortNum(s.coins), cx - 12, py + 103, { color: PAL.gold, outline: null });
  }

  // ----- faction choice (new game) -----
  buildFaction() {
    const b = [];
    ['us', 'them'].forEach((f, i) => {
      b.push(new Button(26 + i * 174, 38, 158, 150, '', () => {
        this.save = newSave(f); this.persist(); sfx.gateGood(); this.go('camp');
      }, { kind: 'tile', extra: (ctx, bt, py) => {
        const F = FACTIONS[f]; const cx = bt.x + bt.w / 2;
        drawText(ctx, F.short, cx, py + 8, { align: 'center', scale: 3, color: f === 'us' ? '#2f5f9a' : PAL.accent, outline: null });
        drawText(ctx, F.name, cx, py + 34, { align: 'center', color: INK, outline: null });
        F.heroes.forEach((id, k) => this.drawChar(ctx, HEROES[id].sheet, 'walk', bt.x + 20 + k * 29, py + 98 - (k % 2) * 6, { flip: f === 'them', phase: k }));
        drawText(ctx, F.blurb, cx, py + 110, { align: 'center', color: INK_SOFT, outline: null });
        drawText(ctx, `FIGHT ${F.foes.toUpperCase()}`, cx, py + 124, { align: 'center', color: INK_SOFT, outline: null });
      } }));
    });
    b.push(new Button(4, H - 26, 76, 22, '< BACK', () => this.go('slots')));
    this.buttons = b;
  }

  // ----- champions: hero select, unlocks, mastery -----
  buildHeroes() {
    const b = []; const ids = FACTIONS[this.save.faction].heroes;
    ids.forEach((id, i) => {
      const h = HEROES[id]; const st = this.save.heroes[id]; const x = 4 + i * 76;
      b.push(new Button(x, 34, 72, 128, '', () => { if (st.u) { this.save.hero = id; this.persist(); this.go('heroes'); } }, {
        kind: 'tile', fill: this.save.hero === id ? PAL.fillHi : PAL.fill, edgeC: this.save.hero === id ? PAL.edgeHi : PAL.edge,
        extra: (ctx, bt, py) => {
          const cx = bt.x + bt.w / 2;
          drawText(ctx, h.name, cx, py + 6, { align: 'center', color: INK, outline: null });
          ctx.save(); ctx.beginPath(); ctx.rect(bt.x + 1, py + 14, bt.w - 2, 58); ctx.clip();
          this.drawChar(ctx, h.sheet, st.u ? h.atk : 'idle', cx - 4, py + 66, { scale: 2, speed: 9 });
          ctx.restore();
          if (!st.u) { ctx.drawImage(UI.lock, bt.x + bt.w - 18, py + 16, 14, 14); }
          drawText(ctx, h.tdesc, cx, py + 72, { align: 'center', color: PAL.accent, outline: null });
          drawText(ctx, h.mastery, cx, py + 84, { align: 'center', color: INK, outline: null });
          drawText(ctx, `${st.m}/${MASTERY_MAX}`, cx, py + 93, { align: 'center', color: INK, outline: null });
          drawText(ctx, h.mdesc, cx, py + 104, { align: 'center', color: INK_SOFT, outline: null });
          if (this.save.hero === id) drawText(ctx, 'SELECTED', cx, py + 115, { align: 'center', color: PAL.good, outline: null });
          else if (st.u) drawText(ctx, 'TAP TO PICK', cx, py + 115, { align: 'center', color: INK_SOFT, outline: null });
        } }));
      const cost = st.u ? masteryCost(st.m) : h.unlock; const max = st.u && st.m >= MASTERY_MAX;
      b.push(new Button(x + 1, 166, 70, 18, max ? 'MASTERED' : `${st.u ? 'TRAIN' : 'UNLOCK'} ${shortNum(cost)}`, () => {
        if (max || this.save.coins < cost) { sfx.gateBad(); return; }
        this.save.coins -= cost; if (st.u) st.m++; else { st.u = true; this.save.hero = id; }
        this.persist(); sfx.pickup(); this.go('heroes');
      }, { kind: 'tile', disabled: max || this.save.coins < cost, fill: PAL.coinFill, edgeC: PAL.coinEdge, ink: PAL.gold }));
    });
    b.push(new Button(4, H - 26, 76, 22, '< CAMP', () => this.go('camp')));
    this.buttons = b;
  }

  buildLevels() {
    const b = []; const p = this.page; const start = p * 20 + 1;
    for (let i = 0; i < 20; i++) {
      const L = start + i; const col = i % 10, row = Math.floor(i / 10);
      const locked = L > this.save.unlocked; const boss = L % 5 === 0;
      b.push(new Button(38 + col * 31, 70 + row * 46, 27, 38, locked ? '' : String(L), () => this.startGame({ level: L }), {
        kind: 'tile', disabled: locked, fill: boss ? PAL.boss : PAL.fill, edgeC: boss ? PAL.bossEdge : PAL.edge,
        extra: (c, bt, py) => {
          if (locked) { c.drawImage(UI.lock, bt.x + 6, py + 11, 16, 16); return; }
          const st = this.save.stars[L] || 0;
          for (let s = 0; s < 3; s++) { c.fillStyle = s < st ? '#e8a020' : PAL.off; c.fillRect(bt.x + 4 + s * 7, py + 29, 5, 5); }
          if (boss) drawText(c, 'B', bt.x + 20, py + 3, { color: PAL.accent, outline: null });
        } }));
    }
    b.push(new Button(4, H - 26, 76, 22, '< CAMP', () => this.go('camp')));
    if (p > 0) b.push(new Button(DW / 2 - 100, H - 26, 64, 22, '< PREV', () => { this.page--; this.go('levels'); }));
    if (p < 4) b.push(new Button(DW / 2 + 36, H - 26, 64, 22, 'NEXT >', () => { this.page++; this.go('levels'); }, { disabled: (p + 1) * 20 + 1 > this.save.unlocked }));
    this.buttons = b;
  }

  buildCamp() {
    const b = []; const keys = Object.keys(CAMP);
    if (!this.campSel) this.campSel = keys[0];
    const PX = 190, PY = 6;
    keys.forEach((k, i) => {
      const def = CAMP[k]; const lv = this.save.camp[k]; const cost = campCost(k, lv); const max = lv >= def.max;
      const y = PY + 28 + i * 18;
      b.push(new Button(PX + 6, y, 128, 17, '', () => { this.campSel = k; this.go('camp'); }, {
        kind: 'tile', fill: this.campSel === k ? PAL.fillHi : PAL.fill, edgeC: this.campSel === k ? PAL.edgeHi : PAL.edge,
        extra: (ctx, bt, py) => {
          ctx.drawImage(this.assets.icons[def.icon], bt.x + 2, py + 1, 15, 15);
          drawText(ctx, def.name[this.fi], bt.x + 20, py + 5, { color: INK, outline: null });
          drawText(ctx, String(lv), bt.x + bt.w - 4, py + 5, { align: 'right', color: PAL.accent, outline: null });
        } }));
      b.push(new Button(PX + 137, y, 47, 17, max ? 'MAX' : shortNum(cost), () => {
        if (max || this.save.coins < cost) { sfx.gateBad(); this.campSel = k; this.go('camp'); return; }
        this.save.coins -= cost; this.save.camp[k]++; this.campSel = k; this.persist(); sfx.pickup(); this.campFlash = { k, t: this.t }; this.go('camp');
      }, { kind: 'tile', disabled: max || this.save.coins < cost, fill: PAL.coinFill, edgeC: PAL.coinEdge, ink: PAL.gold }));
    });
    const next = Math.min(this.save.unlocked, MAX_LEVEL);
    b.push(new Button(4, 4, 150, 22, `MARCH! LV ${next}`, () => this.startGame({ level: next }), { style: 'go' }));
    b.push(new Button(4, 28, 74, 22, 'LEVELS', () => { this.page = biomeOf(next); this.go('levels'); }));
    b.push(new Button(80, 28, 74, 22, 'ENDLESS', () => this.startGame({ endless: true })));
    b.push(new Button(4, 52, 150, 22, 'CHAMPIONS', () => this.go('heroes'), { icon: this.assets.icons.u_men }));
    b.push(new Button(4, 76, 74, 22, '< SAVES', () => { this.save = null; this.slot = 0; this.go('slots'); }));
    this.buttons = b;
  }

  startGame(opts) {
    initAudio();
    this.applyTheme();
    this.save.runs = (this.save.runs || 0) + 1;
    this.game = new Game(this, opts); this.screen = 'game'; this.overlay = null; this.lastOpts = opts;
    this.buttons = [];
    playMusic(opts.endless ? 1 : 0);
  }

  onDraft(game) {
    this.overlay = 'draft';
    if (this.input.bot) { setTimeout(() => { if (this.game === game && game.draft) { game.takeCard(game.draft[0]); this.overlay = null; this.buttons = []; } }, 10); return; }
    this.buttons = game.draft.map((c, i) => new Button(32 + i * 110, 74, 100, 104, '', () => { game.takeCard(c); this.overlay = null; this.buttons = []; }, {
      kind: 'tile', extra: (ctx, bt, py) => {
        ctx.drawImage(this.assets.icons[c.icon], bt.x + 34, py + 10, 32, 32);
        drawText(ctx, c.name, bt.x + 50, py + 52, { align: 'center', color: INK, outline: null });
        const words = c.text.split(' '); let line = '', ly = py + 68;
        for (const w of words) { if ((line + ' ' + w).trim().length > 14) { drawText(ctx, line, bt.x + 50, ly, { align: 'center', color: INK_SOFT, outline: null }); ly += 10; line = w; } else line = (line + ' ' + w).trim(); }
        if (line) drawText(ctx, line, bt.x + 50, ly, { align: 'center', color: INK_SOFT, outline: null });
        drawText(ctx, String(i + 1), bt.x + 6, py + 5, { color: INK_SOFT, outline: null });
      } }));
  }

  onLevelEnd(game, won) {
    this.save.coins += game.coins;
    if (game.endless) this.save.bestEndless = Math.max(this.save.bestEndless, game.endlessWave);
    else if (won) {
      this.save.stars[game.level] = Math.max(this.save.stars[game.level] || 0, game.stars);
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(MAX_LEVEL, game.level + 1));
      if (game.level >= MAX_LEVEL) this.save.beatGame = true;
    }
    this.persist();
    this.result = { won, coins: game.coins, level: game.level, endless: game.endless, wave: game.endlessWave, stars: game.stars, kills: game.kills, waveReached: game.wave };
    if (window.__ippResults) window.__ippResults.push({ ...this.result, count: game.count, t: game.t, cards: game.cardsTaken });
    setTimeout(() => this.showResults(), this.speed > 1 ? 50 : 1300);
  }
  showResults() {
    if (this.screen !== 'game') return;
    this.overlay = 'results'; const r = this.result; const cx = DW / 2;
    const b = [];
    if (r.endless) b.push(new Button(cx - 112, 168, 104, 22, 'AGAIN', () => this.startGame({ endless: true }), { style: 'go' }));
    else if (r.won && r.level < MAX_LEVEL) b.push(new Button(cx - 112, 168, 104, 22, 'NEXT', () => this.startGame({ level: r.level + 1 }), { style: 'go' }));
    else b.push(new Button(cx - 112, 168, 104, 22, 'RETRY', () => this.startGame(this.lastOpts), { style: 'go' }));
    b.push(new Button(cx + 8, 168, 104, 22, 'CAMP', () => this.go('camp'), { icon: this.assets.icons.u_dmg }));
    this.buttons = b;
    if (this.input.bot && params.has('chain') && r.won && !r.endless && r.level < MAX_LEVEL) setTimeout(() => this.startGame({ level: r.level + 1 }), 30);
  }
  pause() {
    if (this.screen !== 'game' || this.overlay || !this.game || this.game.state !== 'play') return;
    this.overlay = 'pause'; const cx = DW / 2;
    this.buttons = [
      new Button(cx - 60, 82, 120, 22, 'RESUME', () => { this.overlay = null; this.buttons = []; }, { style: 'go' }),
      new Button(cx - 60, 108, 120, 22, 'RESTART', () => this.startGame(this.lastOpts)),
      new Button(cx - 60, 134, 120, 22, 'RETREAT', () => { this.game.lose(); this.overlay = null; }, { style: 'danger' }),
    ];
  }

  // ----- input -----
  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    // menus and in-game overlays live in a DW-wide design space centred on the screen
    return [this.inDesignSpace() ? x - this.ox : x, y];
  }
  get ox() { return Math.floor((W - DW) / 2); }
  inDesignSpace() { return this.screen !== 'game' || !!this.overlay;
  }
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      initAudio(); if (this.screen !== 'loading') playMusic(this.screen === 'game' ? 0 : 2);
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [x, y] = this.toLogical(e);
      this.pressBtn = [...this.buttons].reverse().find(b => b.hit(x, y) && !b.disabled) || null;
      if (!this.pressBtn && this.screen === 'game' && !this.overlay) {
        if (x > DW - 22 && y < 16) { this.pause(); return; }
        this.drag = { y, id: e.pointerId };
      }
    });
    c.addEventListener('pointermove', e => {
      if (this.drag && this.drag.id === e.pointerId) {
        const [, y] = this.toLogical(e);
        this.input.dragDy += (y - this.drag.y) * 1.25; this.drag.y = y;
      }
    });
    const up = e => {
      const [x, y] = this.toLogical(e);
      if (this.pressBtn && this.pressBtn.hit(x, y)) { sfx.click(); const b = this.pressBtn; this.pressBtn = null; b.onClick(); }
      this.pressBtn = null; this.drag = null;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', () => { this.pressBtn = null; this.drag = null; });
    const key = (e, v) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.input.up = v;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.input.down = v;
      else if (v && (k === 'Escape' || k === 'p' || k === 'P')) { if (this.overlay === 'pause') { this.overlay = null; this.buttons = []; } else this.pause(); }
      else if (v && this.overlay === 'draft' && ['1', '2', '3'].includes(k)) { const b = this.buttons[+k - 1]; if (b) b.onClick(); }
      else return;
      e.preventDefault(); initAudio();
    };
    addEventListener('keydown', e => key(e, true)); addEventListener('keyup', e => key(e, false));
    if (!params.has('bot')) {
      addEventListener('blur', () => { this.input.up = this.input.down = false; this.pause(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    }
  }

  // ----- loop -----
  loop() {
    let last = performance.now();
    const frame = now => {
      const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
      try { this.update(dt); this.draw(); } catch (err) { this.error = err.stack || String(err); console.error(err); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  update(dt) {
    this.t += dt;
    if (this.screen === 'game' && this.game && this.overlay !== 'pause' && this.overlay !== 'draft') {
      for (let i = 0; i < this.speed; i++) this.game.update(dt, this.input);
    }
  }

  draw() {
    const ctx = this.ctx; ctx.imageSmoothingEnabled = false;
    if (this.error) { ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, H); drawText(ctx, 'ERROR', 4, 4, { color: '#f88' });
      this.error.split('\n').slice(0, 20).forEach((l, i) => drawText(ctx, l.slice(0, 62), 4, 16 + i * 9, { color: '#fff', outline: null })); return; }
    if (this.screen === 'loading') {
      ctx.fillStyle = '#2a1d12'; ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'LOADING...', W / 2, H / 2 - 12, { align: 'center', color: '#ead9b8', outline: null });
      ctx.fillStyle = '#4a3420'; ctx.fillRect(W / 2 - 60, H / 2 + 2, 120, 6); ctx.fillStyle = '#e8a020'; ctx.fillRect(W / 2 - 60, H / 2 + 2, 120 * this.progress, 6);
      return;
    }
    if (this.screen === 'game') this.game.draw(ctx); else this.drawMenuBackdrop(ctx);
    ctx.save(); if (this.inDesignSpace()) ctx.translate(this.ox, 0);
    if (this.screen === 'game') {
      if (this.overlay === 'pause') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-this.ox, 0, W, H);
        panel(ctx, DW / 2 - 84, 44, 168, 122);
        ribbon(ctx, 'PAUSED', DW / 2, 52, 1);
      } else if (this.overlay === 'results') this.drawResults(ctx);
      else if (this.overlay === 'draft') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-this.ox, 0, W, H);
        ribbon(ctx, 'CHOOSE A BOON', DW / 2, 40, 2);
      }
    } else {
      const d = { title: () => this.drawTitle(ctx), slots: () => ribbon(ctx, 'CHOOSE A SAVE', DW / 2, 10, 2),
        faction: () => ribbon(ctx, 'CHOOSE YOUR SIDE', DW / 2, 8, 2), heroes: () => this.drawHeroesHead(ctx),
        levels: () => this.drawLevels(ctx), camp: () => this.drawCamp(ctx) }[this.screen];
      if (d) d();
    }
    for (const b of this.buttons) b.draw(ctx, this);
    ctx.restore();
  }

  // draw a character sheet frame with feet at (x, y)
  drawChar(ctx, key, anim, x, y, { flip = false, scale = 1, speed = 8, phase = 0 } = {}) {
    const m = this.assets.manifest.chars[key]; const img = this.assets.chars[key];
    const a = m.anims[anim] || m.anims.idle; const f = Math.floor(this.t * speed + phase) % a.n;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, f * m.fw, a.row * m.fh, m.fw, m.fh, -m.ax * scale, -m.ay * scale, m.fw * scale, m.fh * scale);
    ctx.restore();
  }
  coinBadge(ctx, x, y, n) {
    smallTile(ctx, x, y, 70, 16, PAL.coinFill, PAL.coinEdge);
    ctx.drawImage(this.assets.icons.coin, x + 3, y + 2, 12, 12);
    drawText(ctx, shortNum(n), x + 18, y + 5, { color: PAL.gold, outline: null });
  }
  drawMenuBackdrop(ctx) {
    const them = this.save && this.save.faction === 'them' && this.screen !== 'title' && this.screen !== 'slots';
    const set = this.assets.biomeSet(them ? 'them' : 'us');
    const bi = this.screen === 'levels' ? this.page : this.screen === 'camp' ? (them ? 4 : 3) : 0;
    const b = set[bi]; const s = this.t * 30;
    for (const L of b.layers) { const off = (s * L.speed) % L.img.width; for (let x = -Math.round(off); x < W; x += L.img.width) ctx.drawImage(L.img, x, L.y || 0); }
    if (b.ground) { const g = groundTexture((them ? 'them' : 'us') + bi, bi); for (let x = -Math.round(s) % g.width; x < W; x += g.width) ctx.drawImage(g, x, 122 - 20); }
    ctx.fillStyle = them ? 'rgba(10,6,20,0.3)' : 'rgba(30,18,8,0.25)'; ctx.fillRect(0, 0, W, H);
  }
  drawTitle(ctx) {
    this.applyTheme();
    for (let i = 0; i < 6; i++) this.drawChar(ctx, ['archer', 'lancer', 'wizard'][i % 3], 'walk', 22 + (i % 3) * 14 + (i > 2 ? 7 : 0), 186 + (i > 2 ? 12 : 0), { phase: i * 2 });
    for (let i = 0; i < 6; i++) this.drawChar(ctx, ['orc', 'skeleton_archer', 'necromancer'][i % 3], 'walk', DW - 26 - (i % 3) * 16 - (i > 2 ? 8 : 0), 186 + (i > 2 ? 12 : 0), { flip: true, phase: i * 3 });
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    panel(ctx, DW / 2 - 122, 6 + bob, 244, 96, { ornate: true });
    drawText(ctx, 'GO FORTH', DW / 2, 16 + bob, { align: 'center', scale: 3, color: INK, outline: null });
    drawText(ctx, 'AND', DW / 2, 41 + bob, { align: 'center', scale: 2, color: INK_SOFT, outline: null });
    drawText(ctx, 'BREAK THINGS', DW / 2, 58 + bob, { align: 'center', scale: 3, color: PAL.accent, outline: null });
    drawText(ctx, 'US OR THEM? PICK A SIDE.', DW / 2, 84 + bob, { align: 'center', color: INK_SOFT, outline: null });
    drawText(ctx, 'UI', DW - 52, H - 15, { align: 'right', color: '#fff', outline: '#000' });
  }
  drawHeroesHead(ctx) {
    ribbon(ctx, 'CHAMPIONS', DW / 2, 6, 2);
    this.coinBadge(ctx, DW - 76, 8, this.save.coins);
  }
  drawLevels(ctx) {
    panel(ctx, 26, 30, DW - 52, 132);
    ribbon(ctx, this.assets.biomeSet(this.save.faction)[this.page].name.toUpperCase(), DW / 2, 12, 2);
    drawText(ctx, `LEVELS ${this.page * 20 + 1}-${this.page * 20 + 20}    B = BOSS LEVEL`, DW / 2, 50, { align: 'center', color: INK_SOFT, outline: null });
    drawText(ctx, `${this.page + 1}/5`, DW / 2, H - 17, { align: 'center', color: '#fff', outline: '#000' });
  }
  campAnim(ctx, k, cx, bottom, phase = 0) {
    const m = this.assets.manifest.campAnim[k]; const img = this.assets.campAnim[k];
    const f = Math.floor(this.t * 10 + phase) % m.n;
    ctx.drawImage(img, f * m.fw, 0, m.fw, m.fh, Math.round(cx - m.fw / 2), Math.round(bottom - m.fh), m.fw, m.fh);
  }
  // soft fire glow: concentric dithered ellipses (pixel-art friendly), cached per colour/size/flicker step
  glow(ctx, cx, cy, rx, ry, rgb) {
    this.glowCache = this.glowCache || {};
    const f = Math.floor(this.t * 6) % 3; const k = `${rgb}|${rx}|${ry}|${f}`;
    let c = this.glowCache[k];
    if (!c) {
      const grow = [0, 1, -1][f]; const RX = rx + grow, RY = ry + grow;
      c = document.createElement('canvas'); c.width = RX * 2 + 2; c.height = RY * 2 + 2; const g = c.getContext('2d');
      for (let y = -RY; y <= RY; y++) for (let x = -RX; x <= RX; x++) {
        const d = (x * x) / (RX * RX) + (y * y) / (RY * RY); if (d > 1) continue;
        const band = d < 0.18 ? 3 : d < 0.45 ? 2 : d < 0.75 ? 1 : 0;
        if (band === 0 && (x + y) & 1) continue;        // outer ring dithered 50%
        if (band === 1 && ((x & 1) && (y & 1))) continue; // middle ring dithered 75%
        g.fillStyle = `rgba(${rgb},${[0.13, 0.18, 0.24, 0.30][band]})`; g.fillRect(x + RX + 1, y + RY + 1, 1, 1);
      }
      this.glowCache[k] = c;
    }
    ctx.drawImage(c, Math.round(cx - c.width / 2), Math.round(cy - c.height / 2));
  }
  drawCamp(ctx) {
    const A = this.assets; const t = this.t; const them = this.save.faction === 'them';
    const C = (k, x, bottom) => { const im = A.camp[k]; ctx.drawImage(im, Math.round(x), Math.round(bottom - im.height)); };
    const hero = this.hero();
    const wander = (k, x, y, i, span = 14) => {
      const ph = (t * 0.2 + i * 0.37) % 2; const walking = (ph % 1) < 0.4; const pos = Math.min(1, (ph % 1) / 0.4); const dir = ph < 1 ? 1 : -1;
      this.drawChar(ctx, k, walking ? 'walk' : 'idle', x + (dir > 0 ? pos : 1 - pos) * span - span / 2, y, { flip: walking ? dir < 0 : i % 2 === 1, phase: i });
    };
    if (!them) {
      // Realm base camp: two tents, a practice target, the campfire and a couple of villagers
      C('officer_tent_0', 104, 188); C('bell_tent_0', 6, 180);
      C('archery_target_0', 160, 212);
      this.glow(ctx, 92, 198, 30, 17, '255,180,80');
      this.campAnim(ctx, 'campfire_0', 92, 208);
      this.drawChar(ctx, 'archer', 'atk1', 126, 206, { speed: 9 });
      wander('v_villagerman', 60, 202, 0); wander('v_oldwoman', 116, 214, 1);
    } else {
      // Horde war camp: palisade, yurt + tepee, roasting boar, one brazier and a couple of brutes
      for (let x = 0; x < 190; x += 7) { const h = 24 + ((x * 7) % 9); ctx.fillStyle = '#3a2418'; ctx.fillRect(x, 154 - h, 6, h); ctx.fillStyle = '#5a3a24'; ctx.fillRect(x + 1, 154 - h, 2, h); ctx.fillStyle = '#2a180e'; ctx.fillRect(x + 2, 154 - h - 3, 2, 3); }
      C('yurt_1', 104, 186); C('tepee_painted_0', 8, 182);
      this.glow(ctx, 172, 192, 16, 12, '255,120,50'); this.campAnim(ctx, 'brazier_stand_1', 172, 214, 2);
      this.glow(ctx, 92, 198, 30, 17, '255,110,50');
      this.campAnim(ctx, 'spit_roast_boar_0', 92, 210);
      wander('orc', 58, 202, 0); wander('skeleton', 132, 212, 1);
    }
    this.drawChar(ctx, hero.sheet, 'idle', 22, 214, {});  // your current champion
    // ledger
    panel(ctx, 190, 6, 190, 204);
    drawText(ctx, them ? 'WAR CAMP' : 'BASE CAMP', 198, 17, { scale: 1, color: INK, outline: null });
    this.coinBadge(ctx, 304, 13, this.save.coins);
    const sel = CAMP[this.campSel]; const lv = this.save.camp[this.campSel];
    const y = 6 + 28 + 8 * 18 + 3;
    ctx.fillStyle = PAL.edge; ctx.fillRect(196, y, 178, 1);
    drawText(ctx, `${sel.name[this.fi]} ${lv}/${sel.max}`, 198, y + 4, { color: PAL.accent, outline: null });
    drawText(ctx, sel.desc + ' EACH', 198, y + 13, { color: INK_SOFT, outline: null });
    if (this.campFlash && this.t - this.campFlash.t < 0.6) {
      const i = Object.keys(CAMP).indexOf(this.campFlash.k);
      ctx.fillStyle = `rgba(255,240,150,${0.6 - (this.t - this.campFlash.t)})`; ctx.fillRect(196, 34 + i * 18, 178, 17);
    }
  }
  drawResults(ctx) {
    const r = this.result;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-this.ox, 0, W, H);
    panel(ctx, DW / 2 - 124, 30, 248, 166);
    const title = r.endless ? 'OVERRUN!' : r.won ? 'VICTORY!' : 'DEFEAT';
    ribbon(ctx, title, DW / 2, 20, 2);
    if (r.won && !r.endless) for (let s = 0; s < 3; s++) drawStar(ctx, DW / 2 - 34 + s * 24, 52, s < r.stars);
    let y = r.won && !r.endless ? 80 : 58;
    const line = (t, c = INK) => { drawText(ctx, t, DW / 2, y, { align: 'center', color: c, outline: null }); y += 12; };
    if (r.endless) { line(`WAVES SURVIVED: ${r.wave}`); line(`BEST: ${this.save.bestEndless}`, PAL.accent); }
    else line(`LEVEL ${r.level}  ${r.won ? 'CLEARED' : `FELL ON WAVE ${Math.min(3, r.waveReached + 1)}/3`}`);
    line(`ENEMIES SLAIN: ${r.kills}`, INK_SOFT);
    ctx.drawImage(this.assets.icons.coin, DW / 2 - 34, y - 3, 12, 12);
    drawText(ctx, `+${r.coins} KEPT`, DW / 2 - 18, y, { color: PAL.gold, outline: null }); y += 16;
    if (!r.won) {
      const best = this.cheapestUpgrade();
      line('YOUR COINS ARE SAFE. UPGRADE AT CAMP', INK_SOFT);
      if (best) line(`NEXT: ${best.name} FOR ${shortNum(best.cost)}`, best.cost <= this.save.coins ? PAL.good : INK_SOFT);
    }
  }
  cheapestUpgrade() {
    let best = null;
    for (const [k, def] of Object.entries(CAMP)) { if (this.save.camp[k] >= def.max) continue; const c = campCost(k, this.save.camp[k]); if (!best || c < best.cost) best = { name: def.name[this.fi], cost: c }; }
    return best;
  }
}

// ---------------- boot ----------------
// Fill the screen: height is always 216 logical px; width follows the aspect ratio (clamped 384..520).
// Very tall/narrow screens (4:3 tablets, portrait phones) letterbox instead.
const canvas = document.getElementById('game');
let app = null;
function fit() {
  const aspect = innerWidth / innerHeight;
  const w = Math.max(DW, Math.min(520, Math.round(H * aspect / 2) * 2));
  if (w !== canvas.width || canvas.height !== H) {
    setW(w); canvas.width = w; canvas.height = H;
    if (app && app.ctx) { app.ctx.imageSmoothingEnabled = false; if (app.screen !== 'loading' && app.screen !== 'game') app.go(app.screen); }
  }
  const k = Math.min(innerWidth / w, innerHeight / H);
  canvas.style.width = Math.floor(w * k) + 'px'; canvas.style.height = Math.floor(H * k) + 'px';
  document.getElementById('rotate').style.display = innerHeight > innerWidth * 1.1 ? 'flex' : 'none';
}
addEventListener('resize', fit); fit();
app = new App(canvas); app.start();
