// Home camp scenes, drawn entirely in code (no image assets) (MIT)
// campBackdrop(): sky, hills, ground — full screen width, cached.
// campProps():    tents, fire pit, woodpile... — 384-wide design space, cached.
// campFlame():    the only animated scenery: a small pixel flame.

const csCache = {};
function csCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); return [c, g]; }
function csRng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function csLine(g, x0, y0, x1, y1, col) {
  g.fillStyle = col; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function csEllipse(g, cx, cy, rx, ry, col, dither = false) {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d > 1) continue;
    if (dither && d > 0.7 && ((x + y) & 1)) continue;
    g.fillRect(cx + x, cy + y, 1, 1);
  }
}

const CS_PAL = {
  us: { sky: ['#3d4a78', '#6a5e8e', '#b07a86', '#e3a275', '#f4c983'], far: '#6b6584', near: '#4c5d55', tree: '#2e4636', treeHi: '#3d5a44',
    grass: '#5d8a3e', grassHi: '#7aa64c', grassLo: '#4d7834', dirt: '#9c7a50', dirtLo: '#806240', fence: '#6e4a2c', fenceHi: '#8e6438' },
  them: { sky: ['#140c22', '#2c1434', '#561e36', '#8e3036', '#c4553a'], far: '#3a1e34', near: '#2a1828', tree: '#1e1220', treeHi: '#2c1a2a',
    grass: '#4a3a30', grassHi: '#5e4a38', grassLo: '#3a2c26', dirt: '#6a4a34', dirtLo: '#553a2a', fence: '#3a2418', fenceHi: '#5a3a24' },
};
const HORIZON = 132;

export function campBackdrop(w, them) {
  const key = `bg|${w}|${them}`; if (csCache[key]) return csCache[key];
  const P = CS_PAL[them ? 'them' : 'us']; const [c, g] = csCanvas(w, 216); const r = csRng(them ? 7 : 3);
  // sky in dithered bands
  const bandH = Math.ceil(HORIZON / P.sky.length);
  for (let i = 0; i < P.sky.length; i++) {
    g.fillStyle = P.sky[i]; g.fillRect(0, i * bandH, w, bandH);
    if (i > 0) { g.fillStyle = P.sky[i - 1]; for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) if ((x + y) % 2 === 0 && (y < 2 || x % 4 === 0)) g.fillRect(x, i * bandH + y, 1, 1); }
  }
  if (them) { for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.3 ? '#e8d0ff' : '#9a7ab0'; g.fillRect(Math.floor(r() * w), Math.floor(r() * 70), 1, 1); }
    csEllipse(g, Math.round(w * 0.72), 30, 11, 11, '#e8c8b0'); csEllipse(g, Math.round(w * 0.72) + 4, 27, 3, 2, '#d0a890'); }
  else { csEllipse(g, Math.round(w * 0.66), HORIZON - 26, 14, 14, '#fbe3a2'); }
  // two hill silhouettes
  const hills = (base, amp, f1, f2, col) => { g.fillStyle = col; for (let x = 0; x < w; x++) { const h = base - amp * (0.6 * Math.sin(x * f1 + 1.3) + 0.4 * Math.sin(x * f2 + 0.4)); g.fillRect(x, Math.round(h), 1, 216); } };
  hills(HORIZON - 16, 10, 0.021, 0.057, P.far);
  hills(HORIZON - 4, 6, 0.034, 0.081, P.near);
  // treeline (pines for the realm, jagged rocks for the horde)
  for (let x = -4; x < w; x += 7 + Math.floor(r() * 6)) {
    const h = 10 + Math.floor(r() * 12), b = HORIZON + 2;
    if (!them) for (let y = 0; y < h; y++) { const hw = Math.floor(y * 0.45) + 1; g.fillStyle = y % 4 === 3 ? P.treeHi : P.tree; g.fillRect(x - hw, b - h + y, hw * 2 + 1, 1); }
    else { g.fillStyle = P.tree; for (let y = 0; y < h; y++) { const hw = Math.floor((y / h) * 5) + (y % 3 === 0 ? 1 : 0); g.fillRect(x - hw, b - h + y, hw * 2 + 1, 1); } }
  }
  // ground
  g.fillStyle = P.grass; g.fillRect(0, HORIZON, w, 216 - HORIZON);
  g.fillStyle = P.grassHi; g.fillRect(0, HORIZON, w, 1);
  for (let i = 0; i < w * 1.4; i++) { const x = Math.floor(r() * w), y = HORIZON + 2 + Math.floor(r() * (214 - HORIZON)); g.fillStyle = r() < 0.5 ? P.grassHi : P.grassLo; g.fillRect(x, y, 1, 1); if (r() < 0.3) g.fillRect(x - 1, y + 1, 1, 1), g.fillRect(x + 1, y + 1, 1, 1); }
  // a beaten-earth clearing (centred on the design-space camp, which sits at x = (w-384)/2)
  const ox = Math.floor((w - 384) / 2);
  csEllipse(g, ox + 92, 198, 78, 17, P.dirtLo, true); csEllipse(g, ox + 92, 198, 70, 14, P.dirt, true);
  // path leading off to the right (where the march begins)
  for (let x = ox + 150; x < w; x++) { const y = 200 + Math.round(Math.sin(x * 0.05) * 3); g.fillStyle = P.dirt; g.fillRect(x, y - 3, 1, 7); g.fillStyle = P.dirtLo; if (x % 3 === 0) g.fillRect(x, y + 4, 1, 1); }
  // back fence / palisade
  if (!them) { for (let x = 0; x < w; x += 12) { g.fillStyle = P.fence; g.fillRect(x, HORIZON + 6, 2, 12); } g.fillStyle = P.fenceHi; g.fillRect(0, HORIZON + 9, w, 1); g.fillRect(0, HORIZON + 14, w, 1); }
  else for (let x = 0; x < w; x += 6) { const h = 22 + ((x * 7) % 9); g.fillStyle = P.fence; g.fillRect(x, HORIZON + 14 - h, 5, h); g.fillStyle = P.fenceHi; g.fillRect(x + 1, HORIZON + 14 - h, 1, h); g.fillStyle = P.fence; g.fillRect(x + 1, HORIZON + 11 - h, 3, 3); g.fillRect(x + 2, HORIZON + 9 - h, 1, 2); }
  return (csCache[key] = c);
}

// ---- prop helpers (all in the 384-wide design space) ----
function csTent(g, cx, base, w, h, light, shade, edge, stripe) {
  for (let y = 0; y <= h; y++) {
    const hw = Math.round((y / h) * w / 2);
    for (let x = -hw; x <= hw; x++) {
      let col = x < 0 ? light : shade;
      if (stripe && Math.floor((x + 100) / 6) % 2 === 0) col = x < 0 ? stripe[0] : stripe[1];
      if (x === -hw || x === hw || y === h) col = edge;
      g.fillStyle = col; g.fillRect(cx + x, base - h + y, 1, 1);
    }
  }
  // doorway with one flap tied open
  const dh = Math.round(h * 0.55), dw = Math.round(w * 0.2);
  for (let y = 0; y < dh; y++) { const hw = Math.round((y / dh) * dw); g.fillStyle = '#2a1c12'; g.fillRect(cx - hw, base - dh + y, hw * 2 + 1, 1); g.fillStyle = light; g.fillRect(cx - hw - 2, base - dh + y, 2, 1); }
  g.fillStyle = edge; g.fillRect(cx, base - h - 4, 1, 4);
  csLine(g, cx - 1, base - h + 1, cx - w / 2 - 8, base, '#8a7a5a'); csLine(g, cx + 1, base - h + 1, cx + w / 2 + 8, base, '#8a7a5a');
  g.fillStyle = '#5a4430'; g.fillRect(cx - w / 2 - 9, base - 1, 2, 2); g.fillRect(cx + w / 2 + 7, base - 1, 2, 2);
}
function csPennant(g, x, y, col) { g.fillStyle = '#4a3420'; g.fillRect(x, y, 1, 12); g.fillStyle = col; for (let i = 0; i < 4; i++) g.fillRect(x + 1, y + i, 7 - i * 2, 1); }
function csLog(g, x, y, len) { g.fillStyle = '#5a3c22'; g.fillRect(x, y, len, 4); g.fillStyle = '#74502e'; g.fillRect(x, y, len, 1); g.fillStyle = '#c8a070'; g.fillRect(x + len - 3, y, 3, 4); g.fillStyle = '#9a7448'; g.fillRect(x + len - 2, y + 1, 1, 2); }
function csCrate(g, x, base, s) { g.fillStyle = '#6e4a2a'; g.fillRect(x, base - s, s, s); g.fillStyle = '#9a6e40'; g.fillRect(x + 1, base - s + 1, s - 2, s - 2); g.fillStyle = '#6e4a2a'; csLine(g, x + 1, base - 2, x + s - 2, base - s + 1, '#6e4a2a'); g.fillRect(x, base - s, s, 1); }
function csBarrel(g, x, base) { g.fillStyle = '#7a5230'; g.fillRect(x + 1, base - 11, 7, 11); g.fillRect(x, base - 9, 9, 7); g.fillStyle = '#9a6a3c'; g.fillRect(x + 2, base - 10, 2, 9); g.fillStyle = '#3a3a40'; g.fillRect(x, base - 9, 9, 1); g.fillRect(x, base - 3, 9, 1); }
function csWoodpile(g, x, base) {
  const ends = [[0, 0], [5, 0], [10, 0], [15, 0], [2, -4], [7, -4], [12, -4], [5, -8], [10, -8]];
  g.fillStyle = '#5a3c22'; g.fillRect(x - 1, base - 13, 21, 13);
  for (const [dx, dy] of ends) { g.fillStyle = '#c8a070'; g.fillRect(x + dx, base - 4 + dy, 4, 4); g.fillStyle = '#9a7448'; g.fillRect(x + dx + 1, base - 3 + dy, 2, 2); }
}
function csStump(g, x, base, axe) {
  g.fillStyle = '#5a3c22'; g.fillRect(x, base - 6, 10, 6); g.fillStyle = '#c8a070'; g.fillRect(x, base - 7, 10, 2); g.fillStyle = '#9a7448'; g.fillRect(x + 3, base - 7, 4, 1);
  if (axe) { csLine(g, x + 6, base - 7, x + 9, base - 14, '#8a6440'); g.fillStyle = '#b8c0c8'; g.fillRect(x + 4, base - 9, 3, 3); }
  g.fillStyle = '#c8a070'; g.fillRect(x - 6, base - 2, 3, 2); g.fillRect(x + 13, base - 1, 3, 2); // chips
}
function csFirePit(g, cx, cy) {
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * 12), y = Math.round(cy + Math.sin(a) * 4);
    g.fillStyle = '#5a5a60'; g.fillRect(x - 2, y - 1, 4, 3); g.fillStyle = '#8a8a90'; g.fillRect(x - 2, y - 1, 3, 1); }
  g.fillStyle = '#2a2020'; for (let x = -8; x <= 8; x++) g.fillRect(cx + x, cy - 1, 1, 2);
  csLine(g, cx - 7, cy + 1, cx + 6, cy - 3, '#5a3c22'); csLine(g, cx - 6, cy - 3, cx + 7, cy + 1, '#6e4a2a');
}
function csTarget(g, cx, base) {
  csLine(g, cx - 4, base, cx, base - 18, '#6e4a2a'); csLine(g, cx + 4, base, cx, base - 18, '#6e4a2a');
  csEllipse(g, cx, base - 16, 7, 7, '#d8c49a'); csEllipse(g, cx, base - 16, 5, 5, '#b03a30'); csEllipse(g, cx, base - 16, 3, 3, '#e8e0d0'); csEllipse(g, cx, base - 16, 1, 1, '#e8c040');
  g.fillStyle = '#6e4a2a'; g.fillRect(cx + 1, base - 18, 4, 1); // an arrow in it
}
function csYurt(g, cx, base, w) {
  const wallH = 14, domeH = 15, hw = w >> 1;
  for (let y = 0; y < wallH; y++) { g.fillStyle = y % 5 === 0 ? '#7a2a22' : '#8a6a4a'; g.fillRect(cx - hw, base - wallH + y, w, 1); g.fillStyle = '#6e5238'; g.fillRect(cx, base - wallH + y, hw, 1); }
  for (let y = 0; y < domeH; y++) { const k = Math.round(hw * Math.sqrt(1 - ((domeH - y) / domeH) ** 2)); g.fillStyle = '#9a7a56'; g.fillRect(cx - k, base - wallH - domeH + y, k, 1); g.fillStyle = '#7a5e40'; g.fillRect(cx, base - wallH - domeH + y, k, 1); }
  for (let i = -2; i <= 2; i++) csLine(g, cx, base - wallH - domeH, cx + i * hw * 0.45, base - wallH, '#5a4028');
  g.fillStyle = '#3a2418'; g.fillRect(cx - 5, base - 12, 10, 12); g.fillStyle = '#5a3a24'; g.fillRect(cx - 4, base - 11, 3, 11);
  g.fillStyle = '#e8e0d0'; g.fillRect(cx - 2, base - wallH - domeH - 5, 4, 3); g.fillStyle = '#1a1010'; g.fillRect(cx - 1, base - wallH - domeH - 4, 1, 1); g.fillRect(cx + 1, base - wallH - domeH - 4, 1, 1); // skull finial
  g.fillStyle = '#5a4028'; g.fillRect(cx, base - wallH - domeH - 2, 1, 2);
}
function csTepee(g, cx, base, w, h) {
  csLine(g, cx - 4, base - h - 6, cx + 2, base - h + 2, '#4a3020'); csLine(g, cx + 4, base - h - 6, cx - 2, base - h + 2, '#4a3020');
  for (let y = 0; y <= h; y++) { const hw = Math.round((y / h) * w / 2); g.fillStyle = '#b89a70'; g.fillRect(cx - hw, base - h + y, hw, 1); g.fillStyle = '#9a7e58'; g.fillRect(cx, base - h + y, hw + 1, 1);
    if (y > h * 0.55 && y < h * 0.55 + 4) { g.fillStyle = '#7a2a22'; for (let x = -hw; x <= hw; x++) if ((x + y) % 4 < 2) g.fillRect(cx + x, base - h + y, 1, 1); } }
  const dh = Math.round(h * 0.4); for (let y = 0; y < dh; y++) { const hw = Math.round((y / dh) * w * 0.14); g.fillStyle = '#2a1810'; g.fillRect(cx - hw, base - dh + y, hw * 2 + 1, 1); }
}
function csTotem(g, x, base) {
  g.fillStyle = '#4a3020'; g.fillRect(x, base - 30, 3, 30); g.fillStyle = '#6a4a30'; g.fillRect(x, base - 30, 1, 30);
  g.fillStyle = '#e8e0d0'; g.fillRect(x - 2, base - 36, 7, 6); g.fillStyle = '#1a1010'; g.fillRect(x - 1, base - 34, 2, 2); g.fillRect(x + 2, base - 34, 2, 2); g.fillRect(x, base - 31, 3, 1);
  g.fillStyle = '#d8c8a8'; g.fillRect(x - 5, base - 39, 3, 2); g.fillRect(x - 5, base - 41, 1, 2); g.fillRect(x + 5, base - 39, 3, 2); g.fillRect(x + 7, base - 41, 1, 2);
  g.fillStyle = '#7a2a22'; g.fillRect(x - 1, base - 24, 5, 2); g.fillRect(x - 1, base - 18, 5, 1);
}
function csDummy(g, cx, base) {
  g.fillStyle = '#5a3c22'; g.fillRect(cx, base - 26, 2, 26); g.fillRect(cx - 7, base - 20, 16, 2);
  g.fillStyle = '#c8a860'; g.fillRect(cx - 4, base - 19, 10, 11); g.fillStyle = '#a88a48'; g.fillRect(cx + 1, base - 19, 5, 11); g.fillStyle = '#7a5a30'; g.fillRect(cx - 4, base - 14, 10, 1);
  g.fillStyle = '#c8a860'; g.fillRect(cx - 2, base - 27, 6, 6); g.fillStyle = '#7a5a30'; g.fillRect(cx - 1, base - 25, 1, 1); g.fillRect(cx + 2, base - 25, 1, 1);
}

// Positions shared with the live (animated) layer in main.js
export const CAMP_FIRE = { x: 92, y: 198 };

export function campProps(them) {
  const key = `props|${them}`; if (csCache[key]) return csCache[key];
  const [c, g] = csCanvas(384, 216);
  if (!them) {
    csTent(g, 30, 176, 44, 34, '#e8dcc0', '#c9b893', '#6e5a3e');
    csTent(g, 142, 170, 54, 44, '#e8dcc0', '#c9b893', '#6e5a3e', ['#b4483c', '#94382e']);
    csPennant(g, 142, 112, '#3a6ab0');
    csCrate(g, 56, 180, 10); csCrate(g, 60, 172, 8); csBarrel(g, 68, 181);
    csWoodpile(g, 162, 190); csStump(g, 148, 206, false);
    csLog(g, 62, 199, 18);   // seat beside the fire
    // lantern post
    g.fillStyle = '#4a3420'; g.fillRect(110, 152, 2, 26); g.fillRect(110, 152, 6, 1); g.fillStyle = '#2a2020'; g.fillRect(114, 153, 4, 5); g.fillStyle = '#f8d878'; g.fillRect(115, 154, 2, 3);
    csTarget(g, 180, 210);
  } else {
    csTepee(g, 28, 178, 36, 44);
    csYurt(g, 142, 172, 56);
    csTotem(g, 106, 176);
    csWoodpile(g, 164, 192); csDummy(g, 168, 212);
    csLog(g, 64, 201, 16);
    // bones scattered by the fire
    g.fillStyle = '#d8d0c0'; g.fillRect(118, 206, 5, 1); g.fillRect(117, 205, 1, 3); g.fillRect(123, 205, 1, 3); g.fillRect(44, 196, 4, 1);
  }
  csFirePit(g, CAMP_FIRE.x, CAMP_FIRE.y);
  return (csCache[key] = c);
}

// spit roast over the horde fire (drawn after the flame so the meat sits over it)
export function campSpit(ctx, t) {
  const { x, y } = CAMP_FIRE;
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 15, y - 18, 2, 18); ctx.fillRect(x + 14, y - 18, 2, 18); ctx.fillRect(x - 16, y - 19, 4, 2); ctx.fillRect(x + 13, y - 19, 4, 2);
  ctx.fillStyle = '#6a6a70'; ctx.fillRect(x - 16, y - 17, 33, 1);
  const turn = Math.floor(t * 2) % 2;
  ctx.fillStyle = '#7a4024'; ctx.fillRect(x - 8, y - 21, 16, 7); ctx.fillRect(x - 10, y - 19, 20, 4);
  ctx.fillStyle = turn ? '#a05a30' : '#8a4a28'; ctx.fillRect(x - 7, y - 21, 12, 2);
  ctx.fillStyle = '#5a2c18'; ctx.fillRect(x - 6, y - 14, 2, 3); ctx.fillRect(x + 4, y - 14, 2, 3);
}
// cooking pot on a tripod over the realm fire
export function campPot(ctx) {
  const { x, y } = CAMP_FIRE;
  ctx.fillStyle = '#4a3420';
  for (let i = 0; i < 20; i++) { ctx.fillRect(Math.round(x - 10 + i * 0.5), y - i, 1, 1); ctx.fillRect(Math.round(x + 10 - i * 0.5), y - i, 1, 1); }
  ctx.fillStyle = '#5a5a60'; ctx.fillRect(x, y - 20, 1, 6);
  ctx.fillStyle = '#26262c'; ctx.fillRect(x - 5, y - 14, 11, 6); ctx.fillRect(x - 4, y - 8, 9, 1); ctx.fillStyle = '#44444c'; ctx.fillRect(x - 5, y - 14, 11, 1);
}

// small animated pixel flame; base at (x, y)
export function campFlame(ctx, x, y, t, s = 1) {
  const f = Math.floor(t * 9) % 4;
  const cols = [[3, 5, 8, 10, 8, 6, 3], [4, 7, 9, 8, 10, 5, 2], [2, 6, 10, 9, 7, 6, 4], [3, 6, 8, 11, 8, 5, 3]][f];
  const layers = [['#c8401c', 1, 0], ['#f08a24', 0.72, 1], ['#ffd860', 0.42, 2]];
  for (const [col, k, inset] of layers) {
    ctx.fillStyle = col;
    cols.forEach((h, i) => { if (i < inset || i > 6 - inset) return; const hh = Math.round(h * k * s); if (hh > 0) ctx.fillRect(x - 3 + i, y - hh, 1, hh); });
  }
  // sparks
  ctx.fillStyle = '#ffd860';
  for (let i = 0; i < 3; i++) { const p = (t * 0.9 + i * 0.37) % 1; ctx.fillRect(Math.round(x + Math.sin((t + i) * 3) * 3), Math.round(y - 10 * s - p * 22), 1, 1); }
}
