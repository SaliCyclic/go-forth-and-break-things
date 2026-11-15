// Shared UI toolkit (MIT). Two themes drawn from licensed art packs:
//   'paper' — Humble Pixel "Paper UI System"   (default; The Realm)
//   'dark'  — Hypnobius "Dark Ages UI"         (default for The Horde; selectable in settings)
// STYLE RULES (keep the UI cohesive):
//   * Panels: panel().  Headings: ribbon() tag (never a button).  Small chips/cards: smallTile().  HUD: hudChip().
//   * Buttons: 'go' (green chevrons / gold-trimmed) is ONLY for actions that continue or advance.
//     Everything else is 'plain'; destructive actions are 'danger'. Text sits in the clear middle.
//   * Colours come from PAL, never hard-coded in screens.
import { drawText, textWidth } from './font.js';

export const UI = {};
export let THEME = 'paper';
export let INK = '#4a3420', INK_SOFT = '#7a5f40';
export const PAL = {};
const PALETTES = {
  paper: { ink: '#4a3420', soft: '#7a5f40', accent: '#a5322a', good: '#2f7a2a', gold: '#8a5a10', fill: '#ead9b8', fillHi: '#fbefcf', edge: '#b59a6c',
           edgeHi: '#a5322a', boss: '#e9c3b0', bossEdge: '#a55a4a', coinFill: '#f4e2a8', coinEdge: '#b58a2c', shade: 'rgba(40,25,10,0.35)',
           tagFill: '#a5322a', tagDark: '#6e1f1a', tagHi: '#c4473a', tagLine: '#e8c85a', tagText: '#fff4dc', off: '#cbb994', hud: '#ead9b8', hudEdge: '#8a6a3a' },
  dark:  { ink: '#dcc47c', soft: '#9f8873', accent: '#e07a5a', good: '#7fd28a', gold: '#dcc47c', fill: '#2e322a', fillHi: '#3d4436', edge: '#6b5d4c',
           edgeHi: '#dcc47c', boss: '#4a2a2a', bossEdge: '#a5604a', coinFill: '#2e322a', coinEdge: '#c19149', shade: 'rgba(0,0,0,0.45)',
           tagFill: '#15202f', tagDark: '#0b1018', tagHi: '#406c91', tagLine: '#c19149', tagText: '#dcc47c', off: '#4b4f45', hud: '#1d2129', hudEdge: '#c19149' },
};
export function setTheme(t) { THEME = PALETTES[t] ? t : 'paper'; Object.assign(PAL, PALETTES[THEME]); INK = PAL.ink; INK_SOFT = PAL.soft; }
setTheme('paper');

// tile a piece (sx,sy,sw,sh) across a rect
export function tile(ctx, img, x, y, w, h, sx = 0, sy = 0, sw = 32, sh = 32) {
  if (w <= 0 || h <= 0) return;
  for (let yy = 0; yy < h; yy += sh) for (let xx = 0; xx < w; xx += sw) {
    const cw = Math.min(sw, w - xx), ch = Math.min(sh, h - yy);
    ctx.drawImage(img, sx, sy, cw, ch, x + xx, y + yy, cw, ch);
  }
}
// 9-slice from one image (corner size c)
function nine(ctx, img, x, y, w, h, c) {
  const iw = img.width, ih = img.height, mw = iw - 2 * c, mh = ih - 2 * c;
  ctx.drawImage(img, 0, 0, c, c, x, y, c, c); ctx.drawImage(img, iw - c, 0, c, c, x + w - c, y, c, c);
  ctx.drawImage(img, 0, ih - c, c, c, x, y + h - c, c, c); ctx.drawImage(img, iw - c, ih - c, c, c, x + w - c, y + h - c, c, c);
  tile(ctx, img, x + c, y, w - 2 * c, c, c, 0, mw, c); tile(ctx, img, x + c, y + h - c, w - 2 * c, c, c, ih - c, mw, c);
  tile(ctx, img, x, y + c, c, h - 2 * c, 0, c, c, mh); tile(ctx, img, x + w - c, y + c, c, h - 2 * c, iw - c, c, c, mh);
  tile(ctx, img, x + c, y + c, w - 2 * c, h - 2 * c, c, c, mw, mh);
}
// 3-slice horizontally from one image (cap size c)
function three(ctx, img, x, y, w, c) {
  const iw = img.width, ih = img.height;
  ctx.drawImage(img, 0, 0, c, ih, x, y, c, ih); ctx.drawImage(img, iw - c, 0, c, ih, x + w - c, y, c, ih);
  tile(ctx, img, x + c, y, w - 2 * c, ih, c, 0, iw - 2 * c, ih);
}

export function panel(ctx, x, y, w, h, { ornate = false } = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillStyle = PAL.shade; ctx.fillRect(x + 2, y + 3, w, h);
  if (THEME === 'dark') {
    if (ornate) { nine(ctx, UI.dk_frame, x, y, w, h, 26); return; }
    // slim gold-trimmed frame: keeps the Dark Ages palette without crowding content
    ctx.fillStyle = '#0b1018'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c19149'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#2e322a'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = 'rgba(220,196,124,0.35)'; ctx.fillRect(x + 5, y + 5, w - 10, 1); ctx.fillRect(x + 5, y + h - 6, w - 10, 1);
    for (const [cx, cy] of [[x + 1, y + 1], [x + w - 6, y + 1], [x + 1, y + h - 6], [x + w - 6, y + h - 6]]) {
      ctx.fillStyle = '#dcc47c'; ctx.fillRect(cx + 2, cy, 1, 5); ctx.fillRect(cx, cy + 2, 5, 1); ctx.fillStyle = '#fff2c0'; ctx.fillRect(cx + 2, cy + 2, 1, 1);
    }
    return;
  }
  const P = i => UI['paper' + i]; const c = 12;
  ctx.drawImage(P(1), 0, 0, c, c, x, y, c, c);
  ctx.drawImage(P(3), 32 - c, 0, c, c, x + w - c, y, c, c);
  ctx.drawImage(P(7), 0, 32 - c, c, c, x, y + h - c, c, c);
  ctx.drawImage(P(9), 32 - c, 32 - c, c, c, x + w - c, y + h - c, c, c);
  tile(ctx, P(2), x + c, y, w - 2 * c, c, 0, 0, 32, c);
  tile(ctx, P(8), x + c, y + h - c, w - 2 * c, c, 0, 32 - c, 32, c);
  tile(ctx, P(4), x, y + c, c, h - 2 * c, 0, 0, c, 32);
  tile(ctx, P(6), x + w - c, y + c, c, h - 2 * c, 32 - c, 0, c, 32);
  tile(ctx, P(5), x + c, y + c, w - 2 * c, h - 2 * c);
  if (w >= 56 && h >= 56) {
    const o = 2;
    ctx.drawImage(P(11), x + o - 6, y + o - 6); ctx.drawImage(P(13), x + w - 32 - o + 6, y + o - 6);
    ctx.drawImage(P(17), x + o - 6, y + h - 32 - o + 6); ctx.drawImage(P(15), x + w - 32 - o + 6, y + h - 32 - o + 6);
    tile(ctx, P(12), x + 26, y + o, w - 52, 1, 0, 6, 32, 1); tile(ctx, P(16), x + 26, y + h - o - 1, w - 52, 1, 0, 25, 32, 1);
    tile(ctx, P(10), x + o, y + 26, 1, h - 52, 6, 0, 1, 32); tile(ctx, P(14), x + w - o - 1, y + 26, 1, h - 52, 25, 0, 1, 32);
  }
}

const BTN = { go: [16, 17, 18], plain: [22, 23, 23], danger: [25, 26, 26] };
export function button3(ctx, x, y, w, style) {
  if (THEME === 'dark') {
    const img = style === 'go' ? UI.dk_btn_blue : style === 'danger' ? UI.dk_btn_gray : UI.dk_btn_dark;
    three(ctx, img, x, y + 1, w, 14);
    return;
  }
  const [l, m, r] = BTN[style] || BTN.go; const top = 5, hh = 22;
  ctx.drawImage(UI['btn' + l], 0, top, 32, hh, x, y, 32, hh);
  tile(ctx, UI['btn' + m], x + 32, y, w - 64, hh, 0, top, 32, hh);
  ctx.drawImage(UI['btn' + r], 0, top, 32, hh, x + w - 32, y, 32, hh);
}
export function smallTile(ctx, x, y, w, h, fill = PAL.fill, edge = PAL.edge) {
  ctx.fillStyle = PAL.shade; ctx.fillRect(x + 1, y + 2, w, h);
  ctx.fillStyle = edge; ctx.fillRect(x, y, w, h); ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = THEME === 'dark' ? 'rgba(220,196,124,0.12)' : 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}
export function hudChip(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.shade; ctx.fillRect(x + 1, y + 2, w, h);
  ctx.fillStyle = PAL.hudEdge; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.hud; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = THEME === 'dark' ? 'rgba(220,196,124,0.15)' : '#f6ead0'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}
export function ribbon(ctx, text, cx, y, scale = 2) {
  // heading tag (never looks clickable)
  const tw = textWidth(text, scale); const w = tw + 28, h = 7 * scale + 10;
  const x = Math.round(cx - w / 2); y = Math.round(y);
  ctx.fillStyle = PAL.shade; ctx.fillRect(x + 2, y + 3, w, h);
  ctx.fillStyle = PAL.tagDark; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = PAL.tagFill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.tagHi; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = PAL.tagLine; ctx.fillRect(x + 3, y + 3, w - 6, 1); ctx.fillRect(x + 3, y + h - 4, w - 6, 1);
  drawText(ctx, text, cx, y + 5, { align: 'center', scale, color: PAL.tagText, outline: PAL.tagDark });
}
export function shortNum(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'K' : String(n); }
export function drawTent(ctx, x, y, w, h, c1, c2, door = '#2a1a12', pennant = '#e8c85a') {
  // pixel-crisp A-frame tent built from horizontal spans; (x,y) = bottom-left
  for (let r = 0; r < h; r++) {
    const half = Math.round((r + 1) / h * w / 2); const cx = x + w / 2;
    ctx.fillStyle = c1; ctx.fillRect(Math.round(cx - half), y - h + r, half, 1);
    ctx.fillStyle = c2; ctx.fillRect(Math.round(cx), y - h + r, half, 1);
    if (r % 6 === 3) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(Math.round(cx - half), y - h + r, half * 2, 1); }
  }
  const dh = Math.round(h * 0.55), dw = Math.round(w * 0.22);
  for (let r = 0; r < dh; r++) { const hw = Math.round((r + 1) / dh * dw / 2); ctx.fillStyle = door; ctx.fillRect(Math.round(x + w / 2 - hw), y - dh + r, hw * 2, 1); }
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(Math.round(x + w / 2), y - h - 8, 1, 9);
  ctx.fillStyle = pennant; ctx.fillRect(Math.round(x + w / 2) + 1, y - h - 8, 5, 2); ctx.fillRect(Math.round(x + w / 2) + 1, y - h - 6, 3, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 2, y, w + 6, 2);
}
const STAR = ['....##....', '....##....', '...####...', '##########', '.########.', '..######..', '..######..', '.###..###.', '.##....##.', '##......##'];
export function drawStar(ctx, x, y, on, size = 2) {
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (STAR[r][c] === '#') {
    ctx.fillStyle = on ? (r < 4 ? '#ffd34d' : '#e8a020') : PAL.off; ctx.fillRect(x + c * size, y + r * size, size, size);
  }
}
export class Button {
  constructor(x, y, w, h, label, onClick, opt = {}) { Object.assign(this, { x, y, w, h, label, onClick, ...opt }); }
  hit(px, py) { return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h; }
  draw(ctx, app) {
    const pressed = app.pressBtn === this; const py = this.y + (pressed ? 1 : 0);
    if (this.disabled) ctx.globalAlpha = 0.5;
    const st = this.style || 'plain';
    if (this.kind === 'tile') smallTile(ctx, this.x, py, this.w, this.h, this.fill || PAL.fill, this.edgeC || PAL.edge);
    else button3(ctx, this.x, py, this.w, st);
    let ink = this.ink || INK;
    if (this.kind !== 'tile' && THEME === 'dark') ink = st === 'go' ? '#ffffff' : PAL.ink;
    const dark = THEME === 'dark';
    const padL = this.kind === 'tile' ? 0 : (dark ? 10 : 24);
    const padR = this.kind === 'tile' ? 0 : (dark ? 10 : (st === 'go' ? 22 : 6));
    let tx = this.x + padL + (this.w - padL - padR) / 2;
    if (this.icon) { ctx.drawImage(this.icon, Math.round(tx - textWidth(this.label || '', this.scale || 1) / 2 - 16), py + 3, 14, 14); tx += 8; }
    if (this.label) drawText(ctx, this.label, tx, py + Math.round((this.h - 7 * (this.scale || 1)) / 2), { align: 'center', scale: this.scale || 1, color: ink, outline: null });
    if (this.extra) this.extra(ctx, this, py);
    ctx.globalAlpha = 1;
  }
}
