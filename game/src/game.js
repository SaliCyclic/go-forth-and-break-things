// Core gameplay (MIT). Side-scrolling: squad on the left moves up/down, fires right; world scrolls right->left.
// Coordinates: x = screen x (progress axis), y = feet line (lateral axis, inside LANE_T..LANE_B).
import { W, H, LANE_T, LANE_B, LANE_MID, SQUAD_X, SCROLL, WEAPONS, UPGRADES, HEROES, FACTIONS, TIERS, ROSTERS, BOSS_ROSTERS, E, MAX_SQUAD, CARDS,
  buildLevel, buildChunk, mulberry32, biomeOf } from './data.js';
import { drawText } from './font.js';
import { hudChip, ribbon, INK, PAL } from './ui.js';
import { sfx } from './audio.js';

const PHI = 2.39996323;
const MAX_DRAWN = 90;
const SPAWN_X = W + 26;

// generated, pixel-dithered ground strip for backdrops that have no walkable ground of their own
const GROUNDS = [['#4b5a3c', '#3a4830', '#2c3826', '#6f7f4f'], ['#7a4a3a', '#5e3a30', '#4a2c26', '#a06a4a'],
                 ['#3a6a3a', '#2c552e', '#214424', '#5f8f4a'], ['#3a9a74', '#2f8063', '#256a52', '#7fd0a0'], ['#3a3458', '#2e2948', '#221f38', '#5a5280']];
const groundCache = {};
export function groundTexture(key, bi) {
  if (groundCache[key]) return groundCache[key];
  const [base, mid, dark, hi] = GROUNDS[bi % GROUNDS.length];
  const c = document.createElement('canvas'); c.width = 128; c.height = H - LANE_T + 20; const g = c.getContext('2d');
  const rnd = mulberry32(bi * 77 + 5);
  g.fillStyle = base; g.fillRect(0, 6, c.width, c.height);
  for (let y = 6; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const r = rnd(); if (r < 0.07) { g.fillStyle = mid; g.fillRect(x, y, 1, 1); } else if (r < 0.1) { g.fillStyle = dark; g.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = dark; g.fillRect(Math.floor(rnd() * 128), 12 + Math.floor(rnd() * (c.height - 14)), 2, 1); }
  // ragged top edge with tufts
  for (let x = 0; x < c.width; x++) {
    const h = 3 + Math.floor(rnd() * 4) + (x % 9 === 0 ? 2 : 0);
    g.fillStyle = hi; g.fillRect(x, 9 - h, 1, h); g.fillStyle = mid; g.fillRect(x, 9, 1, 1);
  }
  // soft shading toward the top so it reads as a field receding into the backdrop
  for (let y = 0; y < 16; y++) { g.fillStyle = `rgba(0,0,0,${0.18 - y * 0.011})`; g.fillRect(0, 9 + y, c.width, 1); }
  return (groundCache[key] = c);
}

export class Game {
  constructor(app, { level = 1, endless = false }) {
    this.app = app; this.A = app.assets;
    this.level = level; this.endless = endless;
    this.biome = endless ? 0 : biomeOf(level);
    const camp = app.save.camp;
    this.count = 5 + camp.men * 3;
    this.peak = this.count;
    this.sy = LANE_MID; this.ty = LANE_MID;
    this.weapon = 'arrow'; this.wlv = 1 + camp.quart;
    this.heroId = app.save.hero || 'archer'; this.hero = HEROES[this.heroId];
    this.faction = this.hero.faction; this.foes = FACTIONS[this.faction].foes;
    this.mastery = (app.save.heroes && app.save.heroes[this.heroId] && app.save.heroes[this.heroId].m) || 0;
    this.rateMul = Math.pow(1.06, camp.rate); this.dmgMul = Math.pow(1.13, camp.dmg);
    this.shield = camp.shield * 3;
    this.gateBonus = camp.gate; this.siegeMul = 1 + camp.siege * 0.25; this.coinMul = 1 + camp.loot * 0.1;
    this.pierceBonus = 0; this.cardsTaken = [];
    this.draftRng = mulberry32((Math.random() * 1e9) | 0);
    this.scroll = 0; this.t = 0;
    this.enemies = []; this.objects = []; this.gates = []; this.shots = []; this.fx = []; this.floats = []; this.traps = [];
    this.decor = []; this.decorD = 0;
    this.fireAcc = 0; this.coins = 0; this.kills = 0; this.dps = 0;
    this.wave = 0; this.waveAlive = new Map(); this.waveSpawning = new Set();
    this.banner = null; this.state = 'play'; this.endTimer = 0;
    this.shake = 0; this.flash = 0;
    this.slots = [];
    this.endlessWave = 0; this.endlessWaves = 0;
    if (endless) {
      this.rng = mulberry32((Math.random() * 1e9) | 0);
      this.events = []; this.genD = 40; this.biomeSchedule = [];
      this.extendEndless(); this.extendEndless();
    } else {
      this.events = buildLevel(level);
    }
    this.evi = 0;
    this.decorRng = mulberry32(level * 31 + 7);
    for (let x = 0; x < W + 40; x += 26) this.addDecor(x);
    this.showBanner(endless ? 'ENDLESS!' : `LEVEL ${level}`, endless ? 'SURVIVE THE HORDE' : this.A.biomeSet(this.faction)[this.biome].name.toUpperCase(), 2.0);
  }

  get diffL() { return this.endless ? 1 + this.endlessWave * 2.6 : this.level; }

  extendEndless() {
    const waveNo = this.endlessWaves++;
    const L = Math.min(200, 1 + waveNo * 2.6);
    const c = buildChunk(this.rng, Math.round(L), waveNo % 3, this.genD, { endless: true, waveNo });
    c.ev.forEach(e => { if (e.wave !== undefined) e.wave = waveNo; });
    this.events.push(...c.ev); this.genD = c.d;
    this.biomeSchedule.push({ d: c.ev[0].d, biome: Math.floor(waveNo / 5) % 5 });
  }

  showBanner(text, sub, dur = 1.6) { this.banner = { text, sub, t: 0, dur }; }

  addDecor(x) {
    const r = this.decorRng; const P = this.A.props;
    const opts = this.faction === 'them'
      ? [['h_moss1', 'h_moss2', 'h_fern', 'h_rock', 'rock3'], ['h_crystal1', 'h_crystal2', 'h_plant1', 'h_plant2', 'rock2'], ['h_fern', 'h_moss1', 'h_moss2', 'h_rock'],
         ['grass1', 'grass2', 'h_fern', 'bush5'], ['h_moss1', 'h_rock', 'rock3', 'rock2']][this.biome]
      : ['grass1', 'grass2', 'grass3', 'grass1', 'grass2', 'rock3', 'rock2', 'bush5'];
    const k = opts[Math.floor(r() * opts.length)]; const img = P[k];
    if (!img) return;
    const front = r() < 0.25;
    const y = front ? H + 2 + r() * 6 : LANE_T + r() * (LANE_B - LANE_T);
    this.decor.push({ img, x: x + r() * 20, y, front });
  }

  // ------- formation ---------
  formation(n) {
    const pts = []; const s = 5.0;
    for (let i = 0; i < n; i++) { const r = s * Math.sqrt(i + 0.3); const a = i * PHI; pts.push([Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.5]); }
    return pts;
  }
  get radius() { return 5.0 * Math.sqrt(Math.min(this.count, MAX_DRAWN)) + 3; }
  get rx() { return this.radius * 0.85; }
  get ry() { return this.radius * 0.5; }

  // ------- update ---------
  update(dt, input) {
    this.t += dt;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 20);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.updateFx(dt);
    if (this.state === 'draft') return;
    if (this.clearT > 0) {
      this.clearT -= dt; this.slowmo = Math.max(0, (this.slowmo || 0) - dt);
      this.scroll += SCROLL * dt * 0.3;
      for (const e of this.enemies) { e.anim += dt; if (e.dead) e.deathT += dt; }
      this.enemies = this.enemies.filter(e => !e.dead || e.deathT < 0.6);
      if (this.clearT <= 0) this.win();
      return;
    }
    if (this.state !== 'play') { this.endTimer += dt; for (const e of this.enemies) { e.anim += dt; if (e.dead) e.deathT += dt; } return; }

    if (input.dragDy) { this.ty += input.dragDy; input.dragDy = 0; }
    if (input.up) this.ty -= 110 * dt; if (input.down) this.ty += 110 * dt;
    if (input.bot) this.ty = this.botTarget();
    const ry = this.ry;
    this.ty = Math.max(LANE_T + Math.min(ry, 20) + 2, Math.min(LANE_B - Math.min(ry, 20) * 0.6, this.ty));
    // approaching a gate pair: the squad must commit to ONE door and squeezes into that half
    const near = this.gates.find(g => !g.done && g.x - SQUAD_X < 70 && g.x > SQUAD_X - 10) || this.gates.find(g => g.done && g.passT < 0.25);
    if (near) {
      if (near.lock === undefined) near.lock = this.sy < LANE_MID ? 0 : 1;
      const side = near.done ? near.chosen : (this.sy < LANE_MID ? 0 : 1);
      const lo = side === 0 ? LANE_T + 4 : LANE_MID + 6, hi = side === 0 ? LANE_MID - 6 : LANE_B - 2;
      this.ty = Math.max(lo, Math.min(hi, this.ty));
      this.squeeze = Math.min(1, (this.squeeze || 0) + dt * 5); this.squeezeSide = side;
    } else this.squeeze = Math.max(0, (this.squeeze || 0) - dt * 3);
    this.sy += (this.ty - this.sy) * Math.min(1, dt * 14);

    const ds = SCROLL * dt; this.scroll += ds;
    while (this.evi < this.events.length && this.events[this.evi].d <= this.scroll) this.spawn(this.events[this.evi++]);
    if (this.endless) {
      if (this.genD - this.scroll < 900) this.extendEndless();
      for (const b of this.biomeSchedule) if (!b.done && b.d <= this.scroll) { b.done = true; if (b.biome !== this.biome) { this.biome = b.biome; } }
    }
    this.decorD += ds; while (this.decorD > 26) { this.decorD -= 26; this.addDecor(W + 10); }
    for (const d of this.decor) d.x -= ds;
    this.decor = this.decor.filter(d => d.x > -40);

    this.updateFiring(dt);
    this.updateShots(dt);
    this.updateGates(dt, ds);
    this.updateObjects(dt, ds);
    this.updateTraps(dt, ds);
    this.updateEnemies(dt, ds);
    this.updateWaves();
    if (this.pendingDraft !== undefined && this.pendingDraft !== null) { this.pendingDraft -= dt; if (this.pendingDraft <= 0 && this.count > 0) { this.pendingDraft = null; this.offerCards(); return; } }

    if (this.count <= 0) { this.count = 0; this.lose(); }
    else if (!this.endless && !this.clearT && this.evi >= this.events.length && this.wave >= 3 && !this.enemies.some(e => !e.dead)) this.win();
    this.peak = Math.max(this.peak, this.count);
  }

  spawn(ev) {
    const L = this.diffL; const e = E(L) * (this.endless ? Math.pow(1.1, this.endlessWave) : 1);
    if (ev.type === 'gate') {
      const [a, b] = ev.gates;
      this.gates.push({ x: SPAWN_X, sides: [{ ...a, acc: 0 }, { ...b, acc: 0 }], step: ev.step, done: false, flash: [0, 0] });
    } else if (ev.type === 'crate') {
      const it = ev.item;
      const img = it.kind === 'weapon' ? 'chest' : it.kind === 'men' ? 'crate_big' : 'barrel';
      this.objects.push({ x: SPAWN_X, y: ev.x, hp: ev.hp, maxHp: ev.hp, item: it, img, w: 28, hit: 0 });
    } else if (ev.type === 'barricade') {
      const imgs = this.biome >= 3 ? ['tomb', 'cross', 'stele'] : ['stele', 'tomb', 'pillar_broken'];
      const img = imgs[Math.floor(this.decorRng() * imgs.length)];
      this.objects.push({ x: SPAWN_X, y: ev.x, hp: ev.hp, maxHp: ev.hp, item: { kind: 'coins', val: 5 + Math.floor(L / 3) }, img, w: 24, hit: 0, barricade: true });
    } else if (ev.type === 'trap') {
      this.traps.push({ x: SPAWN_X, side: ev.side, kind: ev.kind, t: 0, acc: 0, len: 110 });
    } else if (ev.type === 'waveStart') {
      this.waveSpawning.add(ev.wave); if (!this.waveAlive.has(ev.wave)) this.waveAlive.set(ev.wave, 0);
      const n = ev.wave + 1;
      this.showBanner(this.endless ? `WAVE ${n}` : `WAVE ${n}/3`, n === 3 && !this.endless ? 'FINAL WAVE!' : 'HERE THEY COME!', 1.4);
    } else if (ev.type === 'enemies') {
      for (const g of ev.group) {
        const def = TIERS[g.kind]; const ros = ROSTERS[this.foes][g.kind]; const hp = def.hp * e;
        const sheet = ros.alt && Math.random() < 0.5 ? ros.alt : ros.sheet; const sc = def.scale * (ros.scale || 1);
        this.enemies.push({ x: SPAWN_X + Math.random() * 10, y: g.x, kind: g.kind, sheet, tint: ros.tint, scale: sc, hr: this.hitR(sheet, sc),
          hp, maxHp: hp, speed: def.speed * (0.9 + Math.random() * 0.2) * (1 + Math.min(0.6, L / 160)), power: Math.round(def.power * (1 + L / 30)), anim: Math.random() * 10, wave: ev.wave, hit: 0, coin: def.coin });
        this.waveAlive.set(ev.wave, (this.waveAlive.get(ev.wave) || 0) + 1);
      }
    } else if (ev.type === 'boss') {
      const list = BOSS_ROSTERS[this.foes][ev.mini ? 'mini' : 'boss']; const b = list[ev.boss % list.length];
      const bscale = b.scale ? b.scale * (ev.scale / (ev.mini ? 1.7 : 2.4)) : ev.scale;
      this.enemies.push({ x: SPAWN_X + 40, y: LANE_MID + 12, kind: 'boss', name: b.name, sheet: b.sheet, tint: b.tint, scale: bscale, hr: this.hitR(b.sheet, bscale),
        hp: ev.hp * (this.endless ? Math.pow(1.1, this.endlessWave) : 1), maxHp: ev.hp * (this.endless ? Math.pow(1.1, this.endlessWave) : 1), speed: ev.mini ? 11 : 8, power: 999, anim: 0, wave: ev.wave, hit: 0, boss: true, mini: !!ev.mini, final: !!ev.final,
        coin: ev.mini ? 25 + Math.floor(L) : 60 + Math.floor(L * 2) });
      this.waveAlive.set(ev.wave, (this.waveAlive.get(ev.wave) || 0) + 1);
      this.showBanner(ev.mini ? 'MINI-BOSS!' : 'BOSS!', `DEFEAT ${b.name} TO WIN`, 2.0); sfx.boss(); this.shake = ev.mini ? 3 : 5;
    } else if (ev.type === 'waveEnd') {
      this.waveSpawning.delete(ev.wave);
    }
  }

  hitR(sheet, scale) { const m = this.A.manifest.chars[sheet]; return (m.big ? m.fh * 0.28 : 7) * scale; }

  updateWaves() {
    for (const [w, n] of this.waveAlive) {
      if (n <= 0 && !this.waveSpawning.has(w)) {
        this.waveAlive.delete(w);
        this.wave = Math.max(this.wave, w + 1);
        if (this.endless) { this.endlessWave = Math.max(this.endlessWave, w + 1); const c = this.addCoins(10 + w * 3); this.showBanner(`WAVE ${w + 1} CLEAR`, `+${c} COINS`, 1.2); this.app.onEndlessWave?.(this); }
        else if (w < 2) this.showBanner(`WAVE ${w + 1} CLEAR!`, '', 1.1);
        if ((this.endless && (w + 1) % 4 === 0) || (!this.endless && w < 2)) this.pendingDraft = 0.9;
      }
    }
  }

  // ------- firing ---------
  weaponStats() {
    const w = WEAPONS[this.weapon]; const h = this.hero; const m = this.mastery;
    const st = { ...w, kind: h.proj, rate: h.rate * w.rateM * this.rateMul, dmg: h.dmg * w.dmgM * this.dmgMul * (1 + (this.wlv - 1) * 0.3), speed: h.speed * w.speedM };
    st.pierce = (w.pierce || 0) + (h.trait === 'pierce' ? 1 + Math.floor(m / 3) : 0);
    if (h.trait === 'splash') st.splash = Math.max(w.splash || 0, 14 + m * 3);
    if (h.homing) st.homing = true;
    if (h.pierce) st.pierce += h.pierce;
    return st;
  }
  updateFiring(dt) {
    if (this.count <= 0) return;
    const w = this.weaponStats();
    const k = Math.min(this.count, 14);
    const perArrow = w.dmg * this.count / k;
    const interval = 1 / (w.rate * k);
    this.dps = w.rate * w.dmg * this.count * (w.spread || 1);
    this.fireAcc += dt;
    let fired = false;
    while (this.fireAcc >= interval) {
      this.fireAcc -= interval;
      const p = this.slots.length ? this.slots[Math.floor(Math.random() * this.slots.length)] : { x: SQUAD_X, y: this.sy };
      const n = w.spread || 1;
      for (let i = 0; i < n; i++) {
        const ang = n > 1 ? (i - (n - 1) / 2) * 0.16 : (Math.random() - 0.5) * 0.03;
        this.shots.push({ x: p.x + 8, y: p.y, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, dmg: perArrow, kind: w.kind,
          pierce: (w.pierce || 0) + this.pierceBonus, splash: w.splash || 0, homing: w.homing, hitSet: null, life: 2.4 });
      }
      fired = true;
    }
    if (fired) sfx.shoot(w.kind);
  }

  updateShots(dt) {
    const live = [];
    for (const s of this.shots) {
      const px = s.x;
      if (s.homing) {
        let best = null, bd = 1e9;
        for (const e of this.enemies) { if (e.dead || e.x < s.x || e.x > W) continue; const d = (e.x - s.x) ** 2 + ((e.y - s.y) * 2) ** 2; if (d < bd) { bd = d; best = e; } }
        if (best && bd < 140 * 140) { const dx = best.x - s.x, dy = best.y - s.y, m = Math.hypot(dx, dy) || 1;
          s.vx += (dx / m * 220 - s.vx) * Math.min(1, dt * 6); s.vy += (dy / m * 220 - s.vy) * Math.min(1, dt * 6); }
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.x > W + 20 || s.x < -10 || s.y < LANE_T - 30 || s.y > H + 10 || s.life <= 0) continue;
      let alive = true;
      for (const g of this.gates) {
        if (g.done) continue;
        const gl = g.x - 6;
        if (px <= gl && s.x > gl) {
          const side = this.sy < LANE_MID ? 0 : 1; const gs = g.sides[side];
          if ((s.y < LANE_MID ? 0 : 1) === side && (gs.op === '+' || gs.op === '-')) {
            gs.acc += s.dmg;
            const step = Math.max(g.step, this.dps * 2);
            while (gs.acc >= step) {
              gs.acc -= step;
              if (gs.op === '+') gs.val++; else { gs.val--; if (gs.val <= 0) { gs.op = '+'; gs.val = 1; } }
              g.flash[side] = 0.12; sfx.gateTick();
            }
          }
        }
      }
      for (const o of this.objects) {
        if (o.dead) continue;
        if (Math.abs(s.y - o.y) < o.w / 2 && s.x > o.x - 10 && s.x < o.x + 14) {
          this.damageObject(o, s.dmg); alive = false; this.addFx('hit', s.x, s.y - 10, 0.5); break;
        }
      }
      if (alive) for (const e of this.enemies) {
        if (e.dead || e.x > W - 4) continue;
        const r = e.hr;
        if (Math.abs(s.x - e.x) < r && Math.abs(s.y - e.y) < r + 2) {
          if (s.hitSet && s.hitSet.has(e)) continue;
          let dmg = s.dmg; const tr = this.hero.trait, m = this.mastery;
          if (tr === 'crit' && Math.random() < 0.1 + 0.04 * m) { dmg *= 2.5; this.addFx('bad', s.x, s.y - 9 * e.scale, 0.5); }
          if (tr === 'knock' && !e.boss) e.x += (5 + m * 0.75) * (e.kind === 'brute' ? 0.3 : 1);
          if (tr === 'burn') e.burn = { dps: s.dmg * 0.35 * (1 + 0.15 * m), t: 2 };
          this.damageEnemy(e, dmg, true);
          if (s.splash) {
            this.addFx('nova', s.x, s.y + 4, 0.5);
            for (const o of this.enemies) if (o !== e && !o.dead && Math.hypot(o.x - s.x, (o.y - s.y) * 1.5) < s.splash) this.damageEnemy(o, s.dmg * 0.5);
          } else this.addFx(s.homing ? 'static' : 'hit', s.x, s.y - 9 * e.scale, 0.5);
          if (s.pierce > 0) { s.pierce--; (s.hitSet ||= new Set()).add(e); s.dmg *= 0.85; }
          else alive = false;
          break;
        }
      }
      if (alive) live.push(s);
    }
    this.shots = live;
  }

  damageEnemy(e, d, byShot) {
    e.hp -= d; e.hit = 0.1; if (byShot) sfx.hit();
    if (e.hp <= 0 && !e.dead) {
      if (this.hero.trait === 'bless' && Math.random() < 0.08 + 0.01 * this.mastery) this.shield = Math.min(60, this.shield + 1);
      if (this.hero.trait === 'leech' && !e.boss && Math.random() < 0.04 + 0.015 * this.mastery) { this.setCount(this.count + 1); if (Math.random() < 0.3) this.float(e.x, e.y - 24, '+1', '#ff8a9a'); }
      e.dead = true; e.deathT = 0; this.kills++;
      this.addCoins(e.coin * (1 + Math.min(this.diffL, 100) / 8));
      this.waveAlive.set(e.wave, (this.waveAlive.get(e.wave) || 1) - 1);
      if (e.boss) this.addFx('big', e.x, e.y + 4, 1); else this.addFx('puff', e.x, e.y + 2, 0.5);
      sfx.die();
      if (e.boss) { this.shake = 6; this.flash = 0.6; this.coinFloat(e.x, e.y - 40, `+${e.coin}`); }
      if (e.final && !this.endless && this.state === 'play') this.levelClear(e);
    }
  }

  damageObject(o, d) {
    o.hp -= d * this.siegeMul; o.hit = 0.08;
    if (o.hp <= 0 && !o.dead) {
      o.dead = true; sfx.crate(); this.shake = 2;
      this.addFx('shatter', o.x, o.y + 2, 1); this.addFx('boom', o.x, o.y - 4, 0.5);
      this.grant(o.item, o.x, o.y - 36);
    }
  }

  grant(it, x, y) {
    if (it.kind === 'weapon') {
      if (this.weapon === it.id) { this.wlv = Math.min(5, this.wlv + 1); this.float(x, y, `${WEAPONS[it.id].name} LV${this.wlv}`, '#ffd34d'); }
      else { this.weapon = it.id; this.wlv = 1; this.float(x, y, WEAPONS[it.id].name, '#ffd34d'); }
      this.addFx('levelup', SQUAD_X, this.sy + 4, 1); sfx.pickup();
    } else if (it.kind === 'men') {
      this.setCount(this.count + it.val); this.float(x, y, `+${it.val} ${this.hero.unit}`, '#7dff7a'); sfx.gateGood();
    } else if (it.kind === 'upgrade') {
      if (it.id === 'rate') this.rateMul *= 1.15; else if (it.id === 'dmg') this.dmgMul *= 1.2;
      else if (it.id === 'shield') this.shield = Math.min(30, this.shield + 8);
      else if (it.id === 'bomb') this.bomb();
      this.float(x, y, UPGRADES[it.id].name, '#8fe3ff'); sfx.pickup();
    } else if (it.kind === 'coins') {
      this.coinFloat(x, y, `+${this.addCoins(it.val)}`);
    }
  }

  bomb() {
    sfx.bomb(); this.flash = 1; this.shake = 8;
    const dmg = E(this.diffL) * 6;
    for (let i = 0; i < 5; i++) this.addFx('smite', 150 + i * 50 + Math.random() * 20, LANE_T + 10 + Math.random() * (LANE_B - LANE_T - 10), 1);
    for (const en of this.enemies) if (!en.dead && en.x < W + 10) this.damageEnemy(en, en.boss ? dmg * 3 : dmg);
  }

  addCoins(n) { const v = Math.round(n * this.coinMul * (this.endless ? 0.3 : 1)); this.coins += v; return v; }
  setCount(n) { this.count = Math.max(0, Math.min(MAX_SQUAD, Math.round(n))); }

  offerCards() {
    const pool = CARDS.slice(); const pick = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const tot = pool.reduce((a, c) => a + c.w, 0); let r = this.draftRng() * tot; let k = 0;
      for (; k < pool.length - 1; k++) { if ((r -= pool[k].w) <= 0) break; }
      pick.push(pool.splice(k, 1)[0]);
    }
    const menN = Math.max(4, Math.round(this.count * 0.25 + 3 + this.diffL * 0.15));
    this.draft = pick.map(c => ({ ...c, n: menN, text: c.desc(menN) }));
    this.state = 'draft';
    this.app.onDraft?.(this);
  }
  takeCard(c) {
    this.cardsTaken.push(c.id);
    if (c.id === 'men') this.setCount(this.count + c.n);
    else if (c.id === 'rate') this.rateMul *= 1.25;
    else if (c.id === 'dmg') this.dmgMul *= 1.3;
    else if (c.id === 'shield') this.shield += 12;
    else if (c.id === 'wlv') this.wlv = Math.min(6, this.wlv + 1);
    else if (c.id === 'gate') this.gateBonus += 3;
    else if (c.id === 'pierce') this.pierceBonus++;
    else if (c.id === 'greed') this.coinMul *= 1.5;
    this.draft = null; this.state = 'play'; sfx.pickup();
    this.addFx('levelup', SQUAD_X, this.sy + 4, 1);
  }

  pushFloat(f) {
    const hw = f.text.length * 3 + 10; f.x = Math.max(hw + 2, Math.min(W - hw - 2, f.x)); f.y = Math.max(44, f.y);
    for (let k = 0; k < 6; k++) {
      const hit = this.floats.find(o => Math.abs(o.x - f.x) < (o.text.length + f.text.length) * 3 + 12 && Math.abs(o.y - f.y) < 13);
      if (!hit) break; f.y = hit.y - 14;
    }
    this.floats.push(f);
  }
  float(x, y, text, color = '#fff') { this.pushFloat({ x, y, text, color, t: 0 }); }
  coinFloat(x, y, text) { this.pushFloat({ x, y, text, color: '#ffd34d', t: 0, coin: true }); }

  // ------- world objects ---------
  updateGates(dt, ds) {
    for (const g of this.gates) {
      g.x -= ds; g.flash[0] = Math.max(0, g.flash[0] - dt); g.flash[1] = Math.max(0, g.flash[1] - dt);
      if (!g.done && g.x <= SQUAD_X + 4) {
        g.done = true; g.passT = 0;
        const side = this.sy < LANE_MID ? 0 : 1; const gs = g.sides[side]; g.chosen = side;
        const before = this.count;
        if (gs.op === '+') this.setCount(this.count + gs.val + this.gateBonus); else if (gs.op === '-') this.setCount(this.count - gs.val);
        else if (gs.op === 'x') this.setCount(this.count * gs.val); else if (gs.op === '/') this.setCount(Math.ceil(this.count / gs.val));
        const diff = this.count - before;
        if (diff >= 0) { sfx.gateGood(); this.float(SQUAD_X + 30, this.sy - 40, `+${diff}`, '#7dff7a'); }
        else { sfx.gateBad(); this.float(SQUAD_X + 30, this.sy - 40, `${diff}`, '#ff5a5a'); this.shake = 3; }
        if (diff >= 0) this.addFx('star', SQUAD_X, this.sy - 12, 1); else this.addFx('bad', SQUAD_X, this.sy - 10, 0.5);
      }
      if (g.done) g.passT += dt;
    }
    this.gates = this.gates.filter(g => g.x > -30 && !(g.done && g.passT > 0.6));
  }

  updateObjects(dt, ds) {
    for (const o of this.objects) {
      o.x -= ds; o.hit = Math.max(0, o.hit - dt);
      if (!o.dead && o.x <= SQUAD_X + this.rx * 0.5 + 6 && o.x > SQUAD_X - 20) {
        if (Math.abs(o.y - this.sy) < o.w / 2 + this.ry * 0.75) {
          o.dead = true;
          const loss = Math.max(1, Math.ceil(3 + (o.hp / o.maxHp) * (4 + this.diffL * 0.15)));
          this.loseMen(loss, o.x + 20, o.y - 30);
          this.addFx('boom', o.x, o.y + 2, 1); sfx.crate(); this.shake = 4;
        }
      }
    }
    this.objects = this.objects.filter(o => !o.dead && o.x > -40);
  }

  updateTraps(dt, ds) {
    for (const t of this.traps) {
      t.x -= ds; t.t += dt;
      const y0 = t.side === 0 ? LANE_T : LANE_MID, y1 = t.side === 0 ? LANE_MID : LANE_B;
      const ry = this.ry * 0.6;
      if (t.x < SQUAD_X + 8 && t.x + t.len > SQUAD_X - 8 && this.sy + ry > y0 && this.sy - ry < y1) {
        t.acc += dt;
        while (t.acc > 0.12) { t.acc -= 0.12; this.loseMen(1 + Math.floor(this.diffL / 30), SQUAD_X + 20, this.sy - 30, true); }
      }
    }
    this.traps = this.traps.filter(t => t.x + t.len > -10);
  }

  loseMen(n, x, y, quiet) {
    if (this.shield > 0) { const s = Math.min(this.shield, n); this.shield -= s; n -= s; if (!this.fx.some(f => f.k === 'shield')) this.addFx('shield', SQUAD_X, this.sy + 6, 1); if (n <= 0) return; }
    const before = this.count; this.count = Math.max(0, this.count - n);
    const lost = before - this.count;
    if (lost > 0) {
      sfx.lose();
      for (let i = 0; i < Math.min(lost, 6); i++) {
        const p = this.slots[Math.floor(Math.random() * this.slots.length)] || { x: SQUAD_X, y: this.sy };
        this.addFx('hit', p.x, p.y - 8, 0.5);
      }
      if (!quiet || lost > 1) this.float(x, y, `-${lost}`, '#ff5a5a');
    }
  }

  updateEnemies(dt, ds) {
    const rx = this.rx, ry = this.ry;
    for (const e of this.enemies) {
      e.anim += dt; e.hit = Math.max(0, e.hit - dt);
      if (e.dead) { e.deathT += dt; e.x -= ds; continue; }
      if (e.burn) { e.burn.t -= dt; this.damageEnemy(e, e.burn.dps * dt); if (e.burn.t <= 0) e.burn = null; else if (Math.random() < dt * 3) this.addFx('hit', e.x, e.y - 10 * e.scale, 0.35); if (e.dead) continue; }
      e.x -= ds * 0.5 + e.speed * dt;
      if (e.x < 260) {
        const pull = Math.min(1, (260 - e.x) / 160) * (e.boss ? 14 : 26);
        e.y += Math.max(-pull, Math.min(pull, (this.sy - e.y) * 1.2)) * dt;
      }
      e.y = Math.max(LANE_T + 2, Math.min(LANE_B, e.y));
      const dx = (e.x - SQUAD_X) / (rx + e.hr), dy = (e.y - this.sy) / (ry + e.hr * 0.8);
      if (dx * dx + dy * dy < 1) {
        if (e.boss) {
          e.trample = (e.trample || 0) + dt;
          const tr = e.mini ? 0.14 : 0.08; while (e.trample > tr) { e.trample -= tr; this.loseMen(1 + Math.floor(this.diffL / 25), e.x + 20, e.y - 40, true); if (this.count <= 0) break; }
          e.x += (ds * 0.5 + e.speed * dt); // holds position while trampling
        } else {
          e.dead = true; e.deathT = 0;
          this.waveAlive.set(e.wave, (this.waveAlive.get(e.wave) || 1) - 1);
          this.loseMen(e.power, e.x + 16, e.y - 24);
          this.addFx('bad', e.x, e.y - 8, 0.5);
        }
      }
      if (e.x < -30 && !e.dead) {
        e.dead = true; e.deathT = 9;
        this.waveAlive.set(e.wave, (this.waveAlive.get(e.wave) || 1) - 1);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead || e.deathT < 0.6);
  }

  addFx(k, x, y, scale = 1) {
    if (this.fx.length > 140 && (k === 'hit' || k === 'puff')) return;
    const m = this.A.manifest.fx[k]; if (!m.total) { m.total = m.durs.reduce((a, b) => a + b, 0) / 1000; }
    this.fx.push({ k, x, y, scale, t: 0 });
  }
  fxFrame(m, t) { let ms = t * 1000; for (let i = 0; i < m.n; i++) { ms -= m.durs[i]; if (ms < 0) return i; } return m.n - 1; }
  updateFx(dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < this.A.manifest.fx[f.k].total);
    for (const f of this.floats) { f.t += dt; f.y -= dt * 20; }
    this.floats = this.floats.filter(f => f.t < 1.2);
  }

  levelClear(boss) {
    // clear signal: remaining horde routs, slow-mo, banner, then victory
    for (const o of this.enemies) if (!o.dead && o !== boss) {
      o.dead = true; o.deathT = 0; this.addFx('puff', o.x, o.y + 2, 0.5);
      this.waveAlive.set(o.wave, (this.waveAlive.get(o.wave) || 1) - 1);
    }
    for (const o of this.objects) if (!o.dead) { o.dead = true; this.addFx('boom', o.x, o.y + 2, 0.5); }
    this.traps = []; this.shots = [];
    this.clearT = 1.8; this.slowmo = 0.7; this.wave = 3;
    this.showBanner('LEVEL CLEAR!', `${boss.name} DEFEATED`, 1.8);
    this.addFx('levelup', SQUAD_X, this.sy + 4, 1);
  }

  win() {
    if (this.state !== 'play') return;
    this.state = 'won'; this.endTimer = 0; sfx.win();
    const ratio = this.count / Math.max(1, this.peak);
    this.stars = ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
    this.addCoins(20 + this.level * 4 + this.stars * 5);
    this.app.onLevelEnd(this, true);
  }
  lose() {
    if (this.state !== 'play') return;
    this.state = 'lost'; this.endTimer = 0; sfx.defeat(); this.shake = 6;
    this.app.onLevelEnd(this, false);
  }

  // simple autopilot for automated balance testing (?bot=1)
  botTarget() {
    const top = (LANE_T + LANE_MID) / 2, bot = (LANE_MID + LANE_B) / 2;
    for (const g of this.gates) {
      if (g.done || g.x > 300) continue;
      const val = gs => gs.op === '+' ? gs.val + this.gateBonus : gs.op === '-' ? -gs.val : gs.op === 'x' ? this.count * (gs.val - 1) : -this.count / 2;
      return val(g.sides[0]) >= val(g.sides[1]) ? top : bot;
    }
    for (const t of this.traps) if (t.x < SQUAD_X + 140 && t.x + t.len > SQUAD_X - 20) return t.side === 0 ? bot : top;
    const threat = this.objects.find(o => o.x < SQUAD_X + 110 && Math.abs(o.y - this.sy) < 34);
    if (threat) {
      if (threat.barricade) { const gaps = [LANE_T + 14, LANE_MID, LANE_B - 12].filter(y => !this.objects.some(o => o.barricade && Math.abs(o.y - y) < 6 && Math.abs(o.x - threat.x) < 10)); if (gaps.length) return gaps[0]; }
      return threat.y < LANE_MID ? bot : top;
    }
    const target = this.objects.filter(o => !o.barricade && o.x < 330).sort((a, b) => a.x - b.x)[0];
    if (target) return target.y;
    const en = this.enemies.filter(e => !e.dead && e.x < W);
    if (en.length) return en.reduce((s, e) => s + e.y, 0) / en.length;
    return LANE_MID;
  }

  // ------- draw ---------
  draw(ctx) {
    const A = this.A;
    this.drawBackdrop(ctx);
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    for (const d of this.decor) if (!d.front) ctx.drawImage(d.img, Math.round(d.x), Math.round(d.y - d.img.height));
    for (const t of this.traps) {
      const tr = A.manifest.traps[t.kind]; const img = A.traps[t.kind];
      const fr = Math.floor(t.t * 12) % tr.n;
      const y0 = t.side === 0 ? LANE_T : LANE_MID;
      for (let y = y0 - 8; y < y0 + (LANE_MID - LANE_T) - 16; y += 22)
        for (let x = t.x; x < t.x + t.len; x += 28) ctx.drawImage(img, fr * tr.fw, 0, tr.fw, tr.fh, Math.round(x), Math.round(y), tr.fw, tr.fh);
    }
    for (const g of this.gates) this.drawGate(ctx, g, 0);
    // depth-sorted entities
    const list = [];
    for (const o of this.objects) list.push([o.y, 0, o]);
    for (const e of this.enemies) list.push([e.y, 1, e]);
    const n = Math.min(this.count, MAX_DRAWN);
    this.layoutSquad(n);
    this.slots.forEach((s, i) => list.push([s.y, 2, i]));
    list.sort((a, b) => a[0] - b[0]);
    const m = A.manifest.chars[this.hero.sheet]; const simg = A.sheet(this.hero.sheet);
    for (const [, k, o] of list) {
      if (k === 0) this.drawObject(ctx, o);
      else if (k === 1) this.drawEnemy(ctx, o);
      else this.drawSoldier(ctx, m, simg, o);
    }
    for (const s of this.shots) this.drawShot(ctx, s);
    for (const f of this.fx) {
      const mm = A.manifest.fx[f.k]; const img = A.fx[f.k]; const fr = this.fxFrame(mm, f.t); const k = f.scale;
      ctx.drawImage(img, fr * mm.fw, 0, mm.fw, mm.fh, Math.round(f.x - mm.px * k), Math.round(f.y - mm.py * k), Math.round(mm.fw * k), Math.round(mm.fh * k));
    }
    for (const d of this.decor) if (d.front) ctx.drawImage(d.img, Math.round(d.x), Math.round(d.y - d.img.height));
    // labels go last so arrows and effects never cover them
    for (const o of this.objects) this.drawObjectLabel(ctx, o);
    for (const g of this.gates) this.drawGate(ctx, g, 1);
    this.drawSquadHud(ctx);
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, 2 - f.t * 1.6));
      const tw = f.text.length * 6 + (f.coin ? 14 : 4);
      ctx.fillStyle = 'rgba(15,10,25,0.55)'; ctx.fillRect(Math.round(f.x - tw / 2 - 2), Math.round(f.y - 3), tw + 4, 13);
      if (f.coin) ctx.drawImage(A.icons.coin, Math.round(f.x - tw / 2), Math.round(f.y - 2), 10, 10);
      drawText(ctx, f.text, f.x + (f.coin ? 6 : 0), f.y, { align: 'center', color: f.color });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,230,${this.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud(ctx);
  }

  drawBackdrop(ctx) {
    const b = this.A.biomeSet(this.faction)[this.biome];
    for (const L of b.layers) {
      const img = L.img; const off = (this.scroll * L.speed) % img.width;
      for (let x = -Math.round(off); x < W; x += img.width) ctx.drawImage(img, x, L.y || 0);
    }
    if (b.ground) {
      const g = groundTexture(this.faction + this.biome, this.biome);
      const off = Math.round(this.scroll) % g.width;
      for (let x = -off; x < W; x += g.width) ctx.drawImage(g, x, LANE_T - 20);
    }
    // subtle darkening of the battlefield band for readability
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, LANE_T - 14, W, H);
  }

  drawGate(ctx, g, pass) {
    // pass 0: back post + panels; pass 1: labels on top
    const x = Math.round(g.x);
    if (pass === 0) {
      // solid divider post: you go through one door or the other, never both
      ctx.fillStyle = '#3b3030'; ctx.fillRect(x - 3, LANE_T - 26, 8, LANE_B - LANE_T + 32);
      ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x - 2, LANE_T - 26, 6, LANE_B - LANE_T + 32);
      ctx.fillStyle = '#b8a890'; ctx.fillRect(x - 2, LANE_T - 26, 2, LANE_B - LANE_T + 32);
      ctx.fillStyle = '#e8c85a'; ctx.fillRect(x - 4, LANE_T - 30, 10, 5);
    }
    for (let i = 0; i < 2; i++) {
      const gs = g.sides[i];
      const y0 = i === 0 ? LANE_T - 22 : LANE_MID + 1, y1 = i === 0 ? LANE_MID - 1 : LANE_B + 4;
      const good = gs.op === '+' || gs.op === 'x';
      let alpha = 1;
      if (g.done) alpha = g.chosen === i ? Math.max(0, 1 - g.passT * 2) : 0.35;
      const committed = !g.done && g.lock !== undefined && (this.sy < LANE_MID ? 0 : 1) !== i;
      if (committed) alpha = 0.55;
      ctx.globalAlpha = alpha;
      if (pass === 0) {
        ctx.fillStyle = good ? 'rgba(40,150,255,0.42)' : 'rgba(230,40,60,0.42)';
        if (g.flash[i] > 0) ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(x - 9, y0, 20, y1 - y0);
        ctx.fillStyle = good ? '#9fd8ff' : '#ff9aa4';
        ctx.fillRect(x - 9, y0, 20, 2); ctx.fillRect(x - 9, y1 - 2, 20, 2); ctx.fillRect(x - 9, y0, 2, y1 - y0); ctx.fillRect(x + 9, y0, 2, y1 - y0);
      } else {
        const label = gs.op === '/' ? `÷${gs.val}` : gs.op === '+' ? `+${gs.val + this.gateBonus}` : `${gs.op}${gs.val}`;
        const tw = label.length * 12 + 4, cy = Math.round((y0 + y1) / 2);
        ctx.fillStyle = good ? '#1d4f9a' : '#8a1a2a'; ctx.fillRect(x + 1 - (tw >> 1) - 2, cy - 10, tw + 4, 20);
        ctx.fillStyle = good ? '#9fd8ff' : '#ff9aa4'; ctx.fillRect(x + 1 - (tw >> 1) - 2, cy - 10, tw + 4, 1); ctx.fillRect(x + 1 - (tw >> 1) - 2, cy + 9, tw + 4, 1);
        drawText(ctx, label, x + 1, cy - 7, { align: 'center', scale: 2, color: '#fff', outline: null });
        if ((g.done && g.chosen !== i) || committed) {
          ctx.fillStyle = 'rgba(20,10,10,0.7)';
          for (let k = -8; k <= 8; k++) { ctx.fillRect(x + 1 + k, cy + k, 2, 2); ctx.fillRect(x + 1 + k, cy - k, 2, 2); }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  drawObject(ctx, o) {
    const img = this.A.props[o.img]; const x = Math.round(o.x - img.width / 2), y = Math.round(o.y - img.height);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 2, Math.round(o.y) - 3, img.width - 4, 4);
    ctx.drawImage(img, x, y);
    if (o.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(img, x, y); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  drawObjectLabel(ctx, o) {
    const img = this.A.props[o.img]; const top = o.barricade ? Math.round(o.y - img.height / 2) + 6 : Math.round(o.y - img.height) - 4;
    const it = o.item; let icon = null;
    if (it.kind === 'weapon') icon = this.A.icons[WEAPONS[it.id].icon];
    else if (it.kind === 'upgrade') icon = this.A.icons[UPGRADES[it.id].icon];
    else if (it.kind === 'men') icon = this.A.icons.u_men;
    const hp = String(Math.ceil(o.hp)); const extra = it.kind === 'men' ? `+${it.val}` : '';
    const w = Math.max(hp.length * 6 + 4, icon ? 18 : 0, extra.length * 6 + 4);
    const x = Math.round(o.x);
    let y = top - 9;
    ctx.fillStyle = o.barricade ? 'rgba(70,25,10,0.8)' : 'rgba(15,10,25,0.75)'; ctx.fillRect(x - (w >> 1) - 1, y - 2, w + 2, 11);
    drawText(ctx, hp, x, y, { align: 'center', color: o.barricade ? '#ffc890' : '#fff', outline: null });
    if (icon) { y -= 19; ctx.fillStyle = 'rgba(15,10,25,0.75)'; ctx.fillRect(x - 10, y - 1, 20, 19); ctx.drawImage(icon, x - 8, y + 1, 16, 16); }
    if (extra) { y -= 11; ctx.fillStyle = 'rgba(15,60,15,0.8)'; ctx.fillRect(x - (w >> 1) - 1, y - 2, w + 2, 11); drawText(ctx, extra, x, y, { align: 'center', color: '#9dff8a', outline: null }); }
  }

  drawEnemy(ctx, e) {
    const m = this.A.manifest.chars[e.sheet];
    const img = this.A.sheet(e.sheet, e.tint);
    let anim = 'walk', fr;
    if (e.dead) { anim = 'death'; fr = Math.min(m.anims.death.n - 1, Math.floor(e.deathT * 10)); }
    else fr = Math.floor(e.anim * 10) % m.anims.walk.n;
    const a = m.anims[anim]; const s = e.scale;
    const dw = Math.round(m.fw * s), dh = Math.round(m.fh * s);
    // sprites face right; enemies walk left -> mirror around their anchor
    const x = Math.round(e.x + m.ax * s), y = Math.round(e.y - m.ay * s);
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.deathT * 1.6);
    ctx.drawImage(img, fr * m.fw, a.row * m.fh, m.fw, m.fh, 0, 0, dw, dh);
    if (e.hit > 0 && !e.dead) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(img, fr * m.fw, a.row * m.fh, m.fw, m.fh, 0, 0, dw, dh); }
    ctx.restore();
    if (!e.dead && !e.boss && e.hp < e.maxHp && e.maxHp > E(this.diffL) * 1.5) {
      const bx = Math.round(e.x - 7), by = Math.round(e.y - 22 * s);
      ctx.fillStyle = '#000a'; ctx.fillRect(bx, by, 14, 2);
      ctx.fillStyle = '#e33'; ctx.fillRect(bx, by, Math.round(14 * e.hp / e.maxHp), 2);
    }
  }

  layoutSquad(n) {
    const pts = this.formation(n);
    while (this.slots.length < n) this.slots.push({ x: SQUAD_X - 20, y: this.sy, seed: Math.random() * 10 });
    this.slots.length = n;
    for (let i = 0; i < n; i++) {
      const s = this.slots[i];
      let ox = pts[i][0], oy = pts[i][1];
      if (this.squeeze > 0) { const maxY = (LANE_MID - LANE_T) / 2 - 6; const k = Math.min(1, maxY / Math.max(1, this.ry)); oy *= 1 - this.squeeze * (1 - k); ox *= 1 + this.squeeze * (1 - k) * 0.6; }
      const tx = SQUAD_X + ox, ty = this.sy + oy;
      s.x += (tx - s.x) * 0.3; s.y += (ty - s.y) * 0.3;
    }
  }

  drawSoldier(ctx, m, img, i) {
    const s = this.slots[i];
    const a = this.state !== 'play' ? m.anims.idle : (m.anims[this.hero.atk] || m.anims.idle);
    const fr = Math.floor(this.t * (this.state === 'play' ? 12 : 6) + s.seed * 3) % a.n;
    ctx.drawImage(img, fr * m.fw, a.row * m.fh, m.fw, m.fh, Math.round(s.x - m.ax), Math.round(s.y - m.ay), m.fw, m.fh);
  }

  drawSquadHud(ctx) {
    if (this.shield > 0) {
      ctx.strokeStyle = `rgba(140,220,255,${0.45 + 0.2 * Math.sin(this.t * 8)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(SQUAD_X, Math.round(this.sy - 8), this.rx + 10, this.ry + 14, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const label = String(this.count);
    const bx = SQUAD_X, by = Math.max(42, Math.round(this.sy - this.ry - 42));
    const w = label.length * 12 + 8;
    ctx.fillStyle = '#1c3d7a'; ctx.fillRect(bx - w / 2, by - 2, w, 18);
    ctx.fillStyle = '#4b8cff'; ctx.fillRect(bx - w / 2 + 1, by - 1, w - 2, 16);
    ctx.fillStyle = '#1c3d7a'; ctx.fillRect(bx - 2, by + 16, 4, 3);
    drawText(ctx, label, bx, by + 1, { align: 'center', scale: 2, outline: '#0b2050' });
  }

  drawShot(ctx, s) {
    const x = Math.round(s.x), y = Math.round(s.y - 10);
    if (s.kind === 'arrow' || s.kind === 'bone') {
      const img = s.kind === 'bone' ? this.A.arrows.arrow3 : this.A.arrows.arrow1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
    } else if (s.kind === 'lance' || s.kind === 'spear') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s.vy, s.vx));
      if (s.kind === 'lance') { ctx.fillStyle = 'rgba(140,210,255,0.45)'; ctx.fillRect(-14, -2, 18, 4); }
      ctx.fillStyle = s.kind === 'lance' ? '#e8e0cc' : '#7a5230'; ctx.fillRect(-12, -1, 14, 2);
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(2, -2, 3, 4); ctx.fillRect(5, -1, 2, 2);
      ctx.restore();
    } else if (s.kind === 'wave') {
      ctx.fillStyle = 'rgba(200,230,255,0.35)'; ctx.fillRect(x - 7, y - 7, 6, 14);
      ctx.fillStyle = '#e8f6ff'; for (let k = -6; k <= 6; k++) ctx.fillRect(x + Math.round(3 - (k * k) / 12), y + k, 2, 1);
    } else if (s.kind === 'holy') {
      ctx.fillStyle = 'rgba(255,240,150,0.45)'; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = '#fff2a8'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 3, y - 1, 6, 2);
    } else if (s.kind === 'dark') {
      ctx.fillStyle = 'rgba(90,220,120,0.35)'; ctx.fillRect(x - 6, y - 3, 7, 6);
      ctx.fillStyle = '#5a2a7a'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = '#7dff9a'; ctx.fillRect(x - 1, y - 1, 3, 2);
    } else if (s.kind === 'fork') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-9, -1, 12, 2); ctx.fillStyle = '#c9ced6'; ctx.fillRect(3, -3, 1, 6); ctx.fillRect(3, -3, 5, 1); ctx.fillRect(3, 0, 5, 1); ctx.fillRect(3, 2, 5, 1);
      ctx.restore();
    } else if (s.kind === 'hammer' || s.kind === 'axe') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(s.life * 14);
      ctx.fillStyle = '#6a4424'; ctx.fillRect(-1, -5, 2, 10);
      if (s.kind === 'hammer') { ctx.fillStyle = '#8a8f99'; ctx.fillRect(-4, -6, 8, 4); ctx.fillStyle = '#c9ced6'; ctx.fillRect(-4, -6, 8, 1); }
      else { ctx.fillStyle = '#c9ced6'; ctx.fillRect(1, -6, 4, 5); ctx.fillStyle = '#8a8f99'; ctx.fillRect(4, -6, 1, 5); }
      ctx.restore();
    } else if (s.kind === 'fireball') {
      ctx.fillStyle = 'rgba(255,90,20,0.45)'; ctx.fillRect(x - 6, y - 3, 6, 6);
      ctx.fillStyle = 'rgba(255,140,30,0.7)'; ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - 1, y - 2, 4, 4); ctx.fillStyle = '#fff6c8'; ctx.fillRect(x, y - 1, 2, 2);
    } else if (s.kind === 'blood') {
      ctx.fillStyle = 'rgba(120,10,30,0.5)'; ctx.fillRect(x - 5, y - 2, 5, 4);
      ctx.fillStyle = '#b0182e'; ctx.fillRect(x - 2, y - 3, 5, 6); ctx.fillStyle = '#ff5a6e'; ctx.fillRect(x, y - 2, 2, 2);
    } else if (s.kind === 'lance') {
      ctx.fillStyle = 'rgba(120,220,255,0.4)'; ctx.fillRect(x - 8, y - 2, 14, 4);
      ctx.fillStyle = '#bff4ff'; ctx.fillRect(x - 9, y - 1, 16, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 9, y, 16, 1);
    } else if (s.kind === 'fire') {
      ctx.fillStyle = 'rgba(255,120,20,0.5)'; ctx.fillRect(x - 4, y - 3, 7, 6);
      ctx.fillStyle = '#ffb23e'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (s.kind === 'storm') {
      ctx.fillStyle = 'rgba(200,170,255,0.55)'; ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = '#fffbe0'; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  drawProgress(ctx) {
    if (!this.endD) {
      this.endD = this.events[this.events.length - 1].d;
      this.waveDs = this.events.filter(e => e.type === 'waveStart').map(e => e.d);
      this.bossD = (this.events.find(e => e.type === 'boss') || { d: this.endD }).d;
    }
    const x0 = W / 2 - 50, bw = 100, y = 4;
    const p = Math.min(1, this.scroll / this.bossD);
    ctx.fillStyle = PAL.hudEdge; ctx.fillRect(x0 - 1, y - 1, bw + 2, 7); ctx.fillStyle = PAL.off; ctx.fillRect(x0, y, bw, 5);
    ctx.fillStyle = '#d99a20'; ctx.fillRect(x0, y, Math.round(bw * p), 5);
    this.waveDs.forEach((d, i) => {
      const mx = Math.round(x0 + bw * Math.min(1, d / this.bossD));
      ctx.fillStyle = i < this.wave ? PAL.good : INK; ctx.fillRect(mx - 1, y - 2, 2, 9);
    });
    // boss marker: little red skull-ish crest
    const bx = x0 + bw + 4; const sk = ['.###.', '#####', '#.#.#', '#####', '.#.#.'];
    sk.forEach((row, r) => [...row].forEach((c, k) => { if (c === '#') { ctx.fillStyle = this.wave >= 3 ? PAL.good : PAL.accent; ctx.fillRect(bx + k, y - 1 + r, 1, 1); } }));
  }

  drawHud(ctx) {
    const A = this.A;
    // paper strip HUD (matches menus)
    ctx.fillStyle = PAL.hudEdge; ctx.fillRect(0, 0, W, 14); ctx.fillStyle = PAL.hud; ctx.fillRect(0, 0, W, 13);
    drawText(ctx, this.endless ? `ENDLESS  WAVE ${this.endlessWave + 1}` : `LEVEL ${this.level}`, 4, 3, { color: INK, outline: null });
    if (!this.endless) this.drawProgress(ctx);
    ctx.drawImage(A.icons.coin, W - 82, 1, 11, 11);
    drawText(ctx, this.app.save.coins + this.coins, W - 68, 3, { color: PAL.gold, outline: null });
    ctx.fillStyle = PAL.tagFill; ctx.fillRect(W - 18, 1, 17, 11); ctx.fillStyle = PAL.tagText; ctx.fillRect(W - 13, 3, 2, 7); ctx.fillRect(W - 8, 3, 2, 7);
    const boss = this.enemies.find(e => e.boss && !e.dead);
    if (boss) {
      const bw = 170, bx = Math.round(W / 2 - bw / 2) + 20;
      hudChip(ctx, bx - 2, 16, bw + 4, 21);
      drawText(ctx, (boss.mini ? 'MINI-BOSS: ' : 'BOSS: ') + boss.name, bx + 2, 19, { color: PAL.accent, outline: null });
      ctx.fillStyle = '#3a0d14'; ctx.fillRect(bx + 2, 28, bw - 4, 5);
      ctx.fillStyle = '#e0334a'; ctx.fillRect(bx + 2, 28, Math.max(0, Math.round((bw - 4) * boss.hp / boss.maxHp)), 5);
      ctx.fillStyle = '#ff8a9a'; ctx.fillRect(bx + 2, 28, Math.max(0, Math.round((bw - 4) * boss.hp / boss.maxHp)), 1);
    }
    const w = WEAPONS[this.weapon];
    const l2 = `${w.name} LV${this.wlv}`; const cw = Math.max(this.hero.name.length, l2.length) * 6 + 28;
    hudChip(ctx, 2, 16, cw, 21);
    ctx.drawImage(A.icons[w.icon], 4, 18, 17, 17);
    drawText(ctx, this.hero.name, 24, 19, { color: INK, outline: null });
    drawText(ctx, l2, 24, 28, { color: PAL.soft, outline: null });
    if (this.shield > 0) { const sw = String(this.shield).length * 6 + 22; hudChip(ctx, 2, 39, sw, 12); ctx.drawImage(A.icons.u_shield, 3, 40, 10, 10); drawText(ctx, this.shield, 16, 42, { color: INK, outline: null }); }
    if (this.banner) {
      const b = this.banner; const p = b.t / b.dur;
      ctx.globalAlpha = Math.max(0, p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1);
      const cx = W / 2 + 24;
      if (b.sub) { const sw = b.sub.length * 6 + 16; hudChip(ctx, Math.round(cx - sw / 2), 64, sw, 16); drawText(ctx, b.sub, cx, 69, { align: 'center', color: INK, outline: null }); }
      ribbon(ctx, b.text, cx, 44, 2);
      ctx.globalAlpha = 1;
    }
  }
}
