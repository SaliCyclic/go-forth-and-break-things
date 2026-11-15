// Go Forth and Break Things — game data + level generation (MIT)
// Logical screen: height is fixed at 216; width adapts to the device aspect (384 = 16:9 ... 520 ≈ 21:9).
export let W = 384; export const H = 216;
export const DW = 384;                       // design width for menus (centred on wider screens)
export function setW(w) { W = w; }
// battlefield band (lateral axis is screen Y; progress axis is screen X, right to left)
export const LANE_T = 122, LANE_B = 208, LANE_MID = 165;
export const SQUAD_X = 70;
export const SCROLL = 52; // px per second
export const MAX_LEVEL = 100;

// Crate pickups are MODIFIERS: they change how the chosen hero's attack behaves.
export const WEAPONS = {
  arrow:  { name: 'STANDARD',    icon: 'w_arrow',  rateM: 1,    dmgM: 1,    speedM: 1 },
  rapid:  { name: 'RAPID FIRE',  icon: 'w_rapid',  rateM: 1.9,  dmgM: 0.62, speedM: 1.2 },
  spread: { name: 'TRIPLE SHOT', icon: 'w_spread', rateM: 0.85, dmgM: 0.5,  speedM: 0.95, spread: 3 },
  lance:  { name: 'PIERCING',    icon: 'w_lance',  rateM: 0.7,  dmgM: 1.05, speedM: 1.35, pierce: 4 },
  fire:   { name: 'EXPLOSIVE',   icon: 'w_fire',   rateM: 0.7,  dmgM: 1.25, speedM: 0.8,  splash: 22 },
  storm:  { name: 'SEEKING',     icon: 'w_storm',  rateM: 1.15, dmgM: 0.95, speedM: 0.9,  homing: true },
};
export const WEAPON_ORDER = ['arrow', 'rapid', 'spread', 'lance', 'fire', 'storm'];

export const UPGRADES = {
  rate:   { name: 'ATTACK SPEED +', icon: 'u_rate' },
  dmg:    { name: 'DAMAGE +',    icon: 'u_dmg' },
  shield: { name: 'SHIELD',      icon: 'u_shield' },
  bomb:   { name: 'BOMB!',       icon: 'u_bomb' },
};

// ---------------- factions & heroes ----------------
export const FACTIONS = {
  us:   { name: 'THE REALM', short: 'US',   blurb: 'HUMANS DEFEND THE LAND', foes: 'monsters', heroes: ['archer', 'lancer', 'wizard', 'priest', 'swordsman'] },
  them: { name: 'THE HORDE', short: 'THEM', blurb: 'MONSTERS RAID THE LAND', foes: 'humans',   heroes: ['orc', 'bonearcher', 'imp', 'necro', 'rider'] },
};
// trait: crit | pierce | splash | bless | knock | burn | leech. Names/descriptions kept short to fit hero cards.
export const HEROES = {
  archer:     { faction: 'us',   name: 'ARCHER',      unit: 'ARCHERS',   sheet: 'archer',          atk: 'atk1', proj: 'arrow',    rate: 2.6, dmg: 1.0,  speed: 240, unlock: 0,
                trait: 'crit',   tdesc: 'CRIT SHOTS',  mastery: 'EAGLE EYE',  mdesc: '+4% CRIT' },
  lancer:     { faction: 'us',   name: 'LANCER',      unit: 'LANCERS',   sheet: 'lancer',          atk: 'atk2', proj: 'lance',    rate: 2.0, dmg: 1.2,  speed: 260, unlock: 600,
                trait: 'pierce', tdesc: 'PIERCING',    mastery: 'LONG REACH', mdesc: '+1 PIERCE/3' },
  wizard:     { faction: 'us',   name: 'WIZARD',      unit: 'WIZARDS',   sheet: 'wizard',          atk: 'atk2', proj: 'fireball', rate: 1.6, dmg: 1.55, speed: 185, unlock: 1500,
                trait: 'splash', tdesc: 'EXPLOSIVE',   mastery: 'PYROMANCY',  mdesc: '+3 RADIUS' },
  priest:     { faction: 'us',   name: 'PRIEST',      unit: 'PRIESTS',   sheet: 'priest',          atk: 'atk1', proj: 'holy',     rate: 2.2, dmg: 1.0,  speed: 200, unlock: 3500, homing: true,
                trait: 'bless',  tdesc: 'BLESSES', mastery: 'DEVOTION',  mdesc: '+1% BLESS' },
  swordsman:  { faction: 'us',   name: 'SWORDSMAN',   unit: 'SWORDSMEN', sheet: 'swordsman',       atk: 'atk3', proj: 'wave',     rate: 1.9, dmg: 1.35, speed: 230, unlock: 7000,
                trait: 'knock',  tdesc: 'KNOCKBACK',   mastery: 'STEEL WIND', mdesc: '+15% KNOCK', pierce: 1 },
  orc:        { faction: 'them', name: 'ORC RAIDER',  unit: 'ORCS',      sheet: 'orc',             atk: 'atk1', proj: 'axe',      rate: 2.3, dmg: 1.1,  speed: 205, unlock: 0,
                trait: 'knock',  tdesc: 'KNOCKBACK',   mastery: 'BRUTE ARMS', mdesc: '+15% KNOCK' },
  bonearcher: { faction: 'them', name: 'BONE ARCHER', unit: 'SKELETONS', sheet: 'skeleton_archer', atk: 'atk1', proj: 'bone',     rate: 2.6, dmg: 1.0,  speed: 240, unlock: 600,
                trait: 'crit',   tdesc: 'CRIT SHOTS',  mastery: 'DEAD EYE',   mdesc: '+4% CRIT' },
  imp:        { faction: 'them', name: 'IMP',         unit: 'IMPS',      sheet: 'demon',           atk: 'atk1', proj: 'fireball', rate: 2.4, dmg: 0.85, speed: 200, unlock: 1500,
                trait: 'burn',   tdesc: 'BURNING',     mastery: 'HELLFIRE',   mdesc: '+15% BURN' },
  necro:      { faction: 'them', name: 'NECROMANCER', unit: 'CULTISTS',  sheet: 'necromancer',     atk: 'atk2', proj: 'dark',     rate: 1.9, dmg: 1.3,  speed: 190, unlock: 3500,
                trait: 'leech',  tdesc: 'RAISES DEAD', mastery: 'DARK PACT',  mdesc: '+1.5% RAISE' },
  rider:      { faction: 'them', name: 'ORC RIDER',   unit: 'RIDERS',    sheet: 'orc_rider',       atk: 'atk2', proj: 'spear',    rate: 2.0, dmg: 1.25, speed: 260, unlock: 7000,
                trait: 'pierce', tdesc: 'PIERCING',    mastery: 'WAR BOAR',   mdesc: '+1 PIERCE/3' },
};
export const MASTERY_MAX = 10;
export const masteryCost = lv => Math.round(150 * Math.pow(1.55, lv));

// enemy tiers; each faction fights the other faction's roster. hp in units of E(level)
export const TIERS = {
  basic: { hp: 1.0, speed: 20, power: 1, scale: 1,   coin: 1 },
  fast:  { hp: 0.8, speed: 34, power: 1, scale: 1,   coin: 1 },
  tough: { hp: 1.8, speed: 22, power: 1, scale: 1,   coin: 2 },
  heavy: { hp: 3.2, speed: 15, power: 2, scale: 1.15, coin: 3 },
  swift: { hp: 1.5, speed: 40, power: 1, scale: 1,   coin: 2 },
  brute: { hp: 10,  speed: 13, power: 5, scale: 1.4, coin: 8 },
};
export const ROSTERS = {
  monsters: { basic: { sheet: 'orc', alt: 'skeleton' }, fast: { sheet: 'demon', alt: 'bat' }, tough: { sheet: 'armored_orc', alt: 'armored_skeleton' },
              heavy: { sheet: 'werebear', alt: 'blood' }, swift: { sheet: 'werewolf' }, brute: { sheet: 'elite_orc', alt: 'greatsword_skeleton' } },
  humans:   { basic: { sheet: 'soldier' }, fast: { sheet: 'swordsman' }, tough: { sheet: 'armored_axeman' },
              heavy: { sheet: 'knight' }, swift: { sheet: 'lancer' }, brute: { sheet: 'knight_templar' } },
};
// mini-bosses: elite troops scaled up. bosses: large CC0 characters (scale relative to native size)
export const BOSS_ROSTERS = {
  monsters: {
    mini: [{ sheet: 'orc_rider', name: 'BOAR CHIEF' }, { sheet: 'greatsword_skeleton', name: 'GRAVE BLADE' }, { sheet: 'armored_skeleton', name: 'BONE WARDEN' },
           { sheet: 'werebear', name: 'URSA' }, { sheet: 'elite_orc', name: 'RED REAVER', tint: 'red' }, { sheet: 'slime', name: 'THE OOZE' }],
    boss: [{ sheet: 'evil_wizard', name: 'MALGRATH', scale: 1.1 }, { sheet: 'evil_wizard3', name: 'THE HOLLOW', scale: 1.1 },
           { sheet: 'evil_wizard2', name: 'ARCHLICH', scale: 0.6 }, { sheet: 'werewolf', name: 'FENRIC', scale: 2.4, tint: 'dark' },
           { sheet: 'evil_wizard', name: 'VOID TYRANT', scale: 1.2, tint: 'ghost' }],
  },
  humans: {
    mini: [{ sheet: 'knight_templar', name: 'TEMPLAR' }, { sheet: 'knight', name: 'SIR GARETH' }, { sheet: 'armored_axeman', name: 'HEADSMAN' },
           { sheet: 'priest', name: 'HIGH PRIEST' }, { sheet: 'wizard', name: 'COURT MAGE' }, { sheet: 'swordsman', name: 'BLADEMASTER' }],
    boss: [{ sheet: 'king', name: 'THE KING', scale: 1.1 }, { sheet: 'hero_knight', name: 'SIR ALDRIC', scale: 1.15 },
           { sheet: 'huntress', name: 'THE HUNTRESS', scale: 1.1 }, { sheet: 'warrior', name: 'IRON CAPTAIN', scale: 1.1 },
           { sheet: 'huntress2', name: 'WILD ARCHER', scale: 1.5 }],
  },
};
// enemy strength curve: quadratic early, flattening after level 40 so the mid-game is a slope, not a wall
export const E = L => { const k = L - 1, q = Math.min(k, 39), r = Math.max(0, k - 39);
  return 1 + 0.6 * k + 0.09 * q * q + 7.0 * r + 0.045 * r * r; };
export const MAX_SQUAD = 999;

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function biomeOf(L) { return Math.min(4, Math.floor((L - 1) / 20)); }

function pickEnemy(rng, L) {
  const pool = [['basic', 10]];
  if (L >= 4) pool.push(['fast', 4 + Math.min(6, L / 8)]);
  if (L >= 9) pool.push(['heavy', 2 + Math.min(4, L / 15)]);
  if (L >= 16) pool.push(['tough', 3 + Math.min(6, L / 10)]);
  if (L >= 30) pool.push(['swift', 3 + Math.min(5, L / 15)]);
  if (L >= 40) pool.push(['brute', 0.6 + Math.min(1.8, L / 50)]);
  const tot = pool.reduce((s, p) => s + p[1], 0); let r = rng() * tot;
  for (const [k, w] of pool) { if ((r -= w) <= 0) return k; }
  return 'basic';
}

function gatePair(rng, L, forceGood) {
  const plus = () => ({ op: '+', val: 2 + Math.floor(rng() * (3 + L * 0.1)) + Math.floor(L * 0.06) });
  const minus = () => ({ op: '-', val: 2 + Math.floor(rng() * (2 + L * 0.06)) + Math.floor(L * 0.04) });
  const mult = () => ({ op: 'x', val: 2 });
  const div = () => ({ op: '/', val: 2 });
  const good = () => { const r = rng();
    if (r < 0.07) return mult();
    if (L >= 8 && r < 0.12) return { op: 'lv', val: 1 };                                   // attack level +1
    if (L >= 5 && r < 0.19) return { op: 'sh', val: 4 + Math.floor(L / 6) };                // shield
    if (L >= 4 && r < 0.25) return { op: '?', val: 0 };                                     // mystery
    return plus(); };
  const bad = () => { const r = rng();
    if (L > 6 && r < 0.22) return div();
    if (L >= 15 && r < 0.4) return { op: 'pct', val: 20 + 5 * Math.floor(rng() * 3) };      // lose a percentage
    return minus(); };
  let a, b; const r = rng();
  if (forceGood || r < 0.5) { a = good(); b = rng() < 0.65 ? bad() : good(); }
  else { a = good(); b = good(); }
  if (rng() < 0.5) [a, b] = [b, a];
  return [a, b];
}

function crateItem(rng, L, lastWeapon) {
  const r = rng();
  if (r < 0.32) {
    const avail = WEAPON_ORDER.filter((w, i) => i === 0 || L >= [0, 2, 3, 6, 9, 13][i]);
    let w = avail[Math.floor(rng() * avail.length)];
    if (w === lastWeapon && avail.length > 1) w = avail[(avail.indexOf(w) + 1) % avail.length];
    return { kind: 'weapon', id: w };
  }
  if (r < 0.62) return { kind: 'men', val: 3 + Math.floor(rng() * (3 + L * 0.12)) };
  if (r < 0.8) return { kind: 'upgrade', id: 'rate' };
  if (r < 0.93) return { kind: 'upgrade', id: 'dmg' };
  if (r < 0.97 && L >= 5) return { kind: 'upgrade', id: 'shield' };
  if (L >= 8) return { kind: 'upgrade', id: 'bomb' };
  return { kind: 'men', val: 4 };
}

// Build a segment (gates, crates, traps) + wave. Returns events with distance offsets.
export function buildChunk(rng, L, waveIdx, d, opts = {}) {
  const ev = [];
  if (opts.mod === 'gates') { ev.push({ d, type: 'gate', gates: gatePair(rng, L, true), step: E(L) * 1.6 }); d += 110; }
  const e = E(L);
  // --- pre-wave segment ---
  ev.push({ d, type: 'gate', gates: gatePair(rng, L, waveIdx === 0), step: e * 1.6 });
  d += 120;
  const nCrates = 1 + Math.floor(rng() * (L < 3 ? 1.5 : 2.6));
  let lastW = null;
  for (let i = 0; i < nCrates; i++) {
    const item = crateItem(rng, L, lastW); if (item.kind === 'weapon') lastW = item.id;
    const lane = nCrates === 1 ? (rng() < 0.5 ? 0 : 1) : i % 2;
    const x = lane === 0 ? LANE_T + 22 + rng() * 6 - 3 : LANE_B - 20 + rng() * 6 - 3;
    const hpMul = item.kind === 'weapon' ? 1.5 : item.kind === 'men' ? 1.0 : 1.2;
    ev.push({ d: d + i * 52, type: 'crate', x, item, hp: e * (7 + L * 0.35) * hpMul });
  }
  d += nCrates * 52 + 40;
  if (L >= 6 && rng() < 0.45) {
    // barricade row with a gap, or spike trap on one side
    if (rng() < 0.5 || L < 10) {
      const gapLane = Math.floor(rng() * 3);
      const xs = [LANE_T + 14, LANE_MID, LANE_B - 12];
      xs.forEach((x, i) => { if (i !== gapLane) ev.push({ d, type: 'barricade', x, hp: e * (10 + L * 0.4) }); });
    } else {
      ev.push({ d, type: 'trap', side: rng() < 0.5 ? 0 : 1, kind: rng() < 0.5 ? 'spike' : 'fire' });
    }
    d += 90;
  }
  if (rng() < 0.35 + Math.min(0.3, L * 0.006)) {
    ev.push({ d, type: 'gate', gates: gatePair(rng, L, false), step: e * 1.6 });
    d += 110;
  }
  // --- wave ---
  const count = Math.min(160, Math.round((7 + L * 0.55 + waveIdx * 4) * (opts.mod === 'swarm' ? 1.5 : 1)));
  const perRow = Math.min(6, 3 + Math.floor(L / 15));
  const rows = Math.ceil(count / perRow);
  ev.push({ d, type: 'waveStart', wave: waveIdx });
  let left = count;
  // cap elites per wave so one unlucky roll can't turn a level into a wall
  const cap = { brute: waveIdx + 1, heavy: Math.ceil(count * 0.12) + waveIdx }; const used = { brute: 0, heavy: 0 };
  for (let r = 0; r < rows; r++) {
    const n = Math.min(perRow, left); left -= n;
    const group = [];
    for (let i = 0; i < n; i++) {
      const x = LANE_T + 6 + (LANE_B - LANE_T - 10) * ((i + 0.5 + (rng() - 0.5) * 0.6) / n);
      let kind = pickEnemy(rng, L);
      if (cap[kind] !== undefined && used[kind]++ >= cap[kind]) kind = L >= 16 ? 'tough' : 'basic';
      group.push({ kind, x });
    }
    ev.push({ d: d + r * 22, type: 'enemies', group, wave: waveIdx });
  }
  d += rows * 22;
  const bossLevel = !opts.endless && waveIdx === 2 && L % 5 === 0;
  const endlessBoss = opts.endless && opts.waveNo % 5 === 4;
  const miniLevel = !opts.endless && waveIdx === 2 && !bossLevel;
  if (miniLevel) {
    const mi = Math.floor(rng() * 6);
    ev.push({ d: d + 40, type: 'boss', mini: true, boss: mi, hp: e * (40 + L * 1.0), scale: 1.7, wave: waveIdx, final: true });
    d += 70;
  }
  if (bossLevel || endlessBoss) {
    const bi = Math.floor((opts.endless ? opts.waveNo / 5 : L / 5)) % 5;
    const big = opts.endless ? 1 + opts.waveNo / 40 : (L % 10 === 0 ? 1.6 : 1);
    ev.push({ d: d + 40, type: 'boss', boss: bi, hp: e * (90 + L * 2.0) * big, scale: 2.4 + (big > 1 ? 0.5 : 0), wave: waveIdx, final: !opts.endless });
    d += 80;
  }
  ev.push({ d: d + 1, type: 'waveEnd', wave: waveIdx });
  return { ev, d: d + 150 };
}

export function buildLevel(L, opts = {}) {
  const rng = mulberry32(opts.seed ?? (L * 9973 + 17));
  let d = 40; const events = [];
  for (let w = 0; w < 3; w++) { const c = buildChunk(rng, L, w, d, { mod: opts.mod }); events.push(...c.ev); d = c.d; }
  return events;
}

// ---- daily challenge: same seed for everyone on a given (local) date, one mutator ----
export const DAILY_MODS = {
  gold:  'GOLD RUSH: x2 COINS, TOUGHER FOES',
  swarm: 'SWARM: 50% MORE, WEAKER FOES',
  glass: 'GLASS CANNON: HALF TROOPS, +60% DMG',
  gates: 'GATE STORM: EXTRA GATES',
};
export function dailyInfo(date = new Date()) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const mods = Object.keys(DAILY_MODS); const mod = mods[h % mods.length];
  return { key, seed: h, mod, label: DAILY_MODS[mod] };
}

// ---- achievements (checked against the save + the run that just ended) ----
export const ACHIEVEMENTS = [
  { id: 'first',   name: 'FIRST STEPS',   desc: 'CLEAR LEVEL 1',          reward: 50,   test: s => s.unlocked > 1 },
  { id: 'ten',     name: 'ON THE MARCH',  desc: 'CLEAR LEVEL 10',         reward: 200,  test: s => s.unlocked > 10 },
  { id: 'fifty',   name: 'HALFWAY THERE', desc: 'CLEAR LEVEL 50',         reward: 2000, test: s => s.unlocked > 50 },
  { id: 'hundred', name: 'CONQUEROR',     desc: 'CLEAR LEVEL 100',        reward: 0,    test: s => !!s.beatGame },
  { id: 'boss',    name: 'GIANT SLAYER',  desc: 'DEFEAT A BIG BOSS',      reward: 150,  test: s => s.unlocked > 5 },
  { id: 'army100', name: 'CENTURION',     desc: 'LEAD 100 TROOPS',        reward: 150,  test: s => (s.stats.bestSquad || 0) >= 100 },
  { id: 'army500', name: 'WARLORD',       desc: 'LEAD 500 TROOPS',        reward: 1000, test: s => (s.stats.bestSquad || 0) >= 500 },
  { id: 'stars',   name: 'FLAWLESS',      desc: '3 STARS ON 10 LEVELS',   reward: 300,  test: s => Object.values(s.stars).filter(v => v >= 3).length >= 10 },
  { id: 'endless', name: 'SURVIVOR',      desc: 'ENDLESS WAVE 20',        reward: 500,  test: s => s.bestEndless >= 20 },
  { id: 'daily',   name: 'DAILY GRIND',   desc: 'WIN A DAILY CHALLENGE',  reward: 200,  test: s => (s.stats.dailyWins || 0) >= 1 },
  { id: 'dodge',   name: 'LIGHT FEET',    desc: 'DODGE 25 BOSS SLAMS',    reward: 250,  test: s => (s.stats.dodges || 0) >= 25 },
  { id: 'kills',   name: 'BUTCHER',       desc: 'SLAY 10,000 FOES',       reward: 800,  test: s => (s.stats.kills || 0) >= 10000 },
  { id: 'camp',    name: 'BUILDER',       desc: '50 CAMP UPGRADES',       reward: 400,  test: s => Object.values(s.camp).reduce((a, b) => a + b, 0) >= 50 },
  { id: 'heroes',  name: 'FULL ROSTER',   desc: 'UNLOCK ALL 5 CHAMPIONS', reward: 1000, test: s => Object.values(s.heroes).filter(h => h.u).length >= 5 },
];

// Camp: permanent upgrades bought with coins between runs (rogue-lite meta progression)
export const CAMP = {
  men:    { name: ['RECRUITS', 'SPAWN PITS'],     desc: '+3 TROOPS',     icon: 'u_men',    max: 30, base: 30 },
  dmg:    { name: ['SHARP TIPS', 'WAR PAINT'],    desc: '+13% DAMAGE',   icon: 'u_dmg',    max: 30, base: 35 },
  rate:   { name: ['DRILL YARD', 'BLOOD DRUMS'],  desc: '+6% ATK SPEED', icon: 'u_rate',   max: 30, base: 35 },
  gate:   { name: ['WAR BANNERS', 'TOTEMS'],      desc: '+1 PER GATE',   icon: 'star',     max: 15, base: 60 },
  siege:  { name: ['SIEGE TOOLS', 'RAM CREW'],    desc: '+25% VS CRATE', icon: 'w_spread', max: 15, base: 45 },
  shield: { name: ['FIELD MEDIC', 'BONE ARMOR'],  desc: '+3 SHIELD',     icon: 'u_shield', max: 15, base: 50 },
  quart:  { name: ['QUARTERMASTER', 'WARCHIEF'],  desc: '+1 ATTACK LV',  icon: 'w_arrow',  max: 4,  base: 400, grow: 2.6 },
  loot:   { name: ['SCAVENGERS', 'LOOTERS'],      desc: '+10% COINS',    icon: 'coin',     max: 20, base: 80 },
};
export const campCost = (k, lv) => Math.round(CAMP[k].base * 1.6 * Math.pow(CAMP[k].grow || 1.41, lv));

// Run cards: pick 1 of 3 after each cleared wave. Effects last for the current run only.
export const CARDS = [
  { id: 'men',    name: 'REINFORCE',   desc: n => `+${n} TROOPS`, icon: 'u_men',    w: 10 },
  { id: 'rate',   name: 'FRENZY',      desc: () => 'FIRE RATE +25%', icon: 'u_rate', w: 8 },
  { id: 'dmg',    name: 'BROADHEADS',  desc: () => 'DAMAGE +30%',  icon: 'u_dmg',    w: 8 },
  { id: 'shield', name: 'AEGIS',       desc: () => 'SHIELD +12',   icon: 'u_shield', w: 5 },
  { id: 'wlv',    name: 'MASTERWORK',  desc: () => 'ATTACK LEVEL +1', icon: 'star',  w: 5 },
  { id: 'gate',   name: 'RALLY CRY',   desc: () => '+ GATES GIVE +3', icon: 'w_arrow', w: 5 },
  { id: 'pierce', name: 'PIERCING',    desc: () => 'SHOTS PIERCE +1', icon: 'w_lance', w: 4 },
  { id: 'greed',  name: 'PLUNDER',     desc: () => 'COINS +50% THIS RUN', icon: 'coin', w: 4 },
];
