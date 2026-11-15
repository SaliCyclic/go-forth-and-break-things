// Procedural chiptune SFX + music via WebAudio (original, MIT). No audio files needed.
let ac = null, master = null, sfxBus = null, musBus = null;
let sfxOn = true, musOn = true;
const last = {};

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.5 : 0; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = musOn ? 0.22 : 0; musBus.connect(master);
}
export function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.5 : 0; }
export function setMusic(on) { musOn = on; if (musBus) musBus.gain.value = on ? 0.22 : 0; }

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
}
function tone(type, f0, f1, dur, vol, t = 0, bus = sfxBus) {
  const now = ac.currentTime + t;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, now);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.connect(g); g.connect(bus); o.start(now); o.stop(now + dur + 0.02);
}
function burst(dur, vol, freq, t = 0) {
  const now = ac.currentTime + t; const s = noise();
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, now);
  f.frequency.exponentialRampToValueAtTime(80, now + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(now); s.stop(now + dur + 0.02);
}
function throttle(k, ms) {
  const t = performance.now(); if (last[k] && t - last[k] < ms) return true; last[k] = t; return false;
}

export const sfx = {
  shoot(kind) {
    if (!ac || !sfxOn || throttle('shoot', 70)) return;
    if (kind === 'fire') burst(0.12, 0.25, 1800);
    else if (kind === 'storm') tone('square', 1400, 300, 0.06, 0.08);
    else if (kind === 'lance') tone('sawtooth', 900, 1500, 0.07, 0.07);
    else tone('triangle', 1100, 500, 0.05, 0.12);
  },
  hit() { if (!ac || !sfxOn || throttle('hit', 45)) return; tone('square', 300, 120, 0.04, 0.06); },
  die() { if (!ac || !sfxOn || throttle('die', 50)) return; burst(0.15, 0.3, 1200); tone('square', 220, 60, 0.12, 0.08); },
  crate() { if (!ac || !sfxOn) return; burst(0.3, 0.5, 2500); tone('square', 160, 50, 0.25, 0.15); },
  pickup() { if (!ac || !sfxOn) return; [660, 880, 1320].forEach((f, i) => tone('square', f, f, 0.08, 0.1, i * 0.06)); },
  gateGood() { if (!ac || !sfxOn) return; [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.1, 0.18, i * 0.05)); },
  gateBad() { if (!ac || !sfxOn) return; [400, 300, 200].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.12, 0.1, i * 0.07)); },
  lose() { if (!ac || !sfxOn || throttle('lose', 60)) return; tone('square', 500, 200, 0.08, 0.07); },
  gateTick() { if (!ac || !sfxOn || throttle('gtick', 60)) return; tone('square', 1500, 1500, 0.03, 0.04); },
  bomb() { if (!ac || !sfxOn) return; burst(0.8, 0.7, 3000); tone('sine', 120, 30, 0.7, 0.4); },
  boss() { if (!ac || !sfxOn) return; [110, 104, 98].forEach((f, i) => tone('sawtooth', f, f, 0.35, 0.18, i * 0.35)); },
  win() { if (!ac || !sfxOn) return; [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, f, 0.14, 0.12, i * 0.11)); },
  defeat() { if (!ac || !sfxOn) return; [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, 0.25, 0.2, i * 0.2)); },
  click() { if (!ac || !sfxOn) return; tone('square', 800, 800, 0.03, 0.08); },
};

// --- tiny sequencer: bass + arpeggio in a minor key, tempo changes with intensity ---
let musTimer = null, step = 0, nextT = 0, song = 0;
const SONGS = [
  { bpm: 132, bass: [45, 45, 48, 43], arp: [[57, 60, 64], [57, 60, 64], [60, 64, 67], [55, 59, 62]] },
  { bpm: 150, bass: [40, 40, 43, 38], arp: [[52, 55, 59], [52, 55, 59], [55, 59, 62], [50, 54, 57]] },
  { bpm: 96, bass: [45, 41, 43, 40], arp: [[64, 69, 72], [65, 69, 72], [67, 71, 74], [64, 68, 71]] },
];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export function playMusic(i) {
  if (!ac) return; song = i; if (musTimer) return;
  nextT = ac.currentTime + 0.05; step = 0;
  musTimer = setInterval(() => {
    if (!ac) return;
    const s = SONGS[song]; const st = 60 / s.bpm / 4;
    while (nextT < ac.currentTime + 0.2) {
      const bar = Math.floor(step / 16) % 4, b = step % 16;
      if (b % 4 === 0) tone('triangle', mtof(s.bass[bar]), mtof(s.bass[bar]), st * 3.5, 0.5, nextT - ac.currentTime, musBus);
      if (b % 2 === 0) { const a = s.arp[bar]; const n = a[(b / 2) % a.length] + (b >= 8 ? 12 : 0);
        tone('square', mtof(n), mtof(n), st * 0.9, 0.12, nextT - ac.currentTime, musBus); }
      if (song !== 2 && (b === 4 || b === 12)) { const now = nextT; const sN = noise(); const g = ac.createGain();
        g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
        sN.connect(f); f.connect(g); g.connect(musBus); sN.start(now); sN.stop(now + 0.07); }
      nextT += st; step++;
    }
  }, 50);
}
export function stopMusic() { if (musTimer) clearInterval(musTimer); musTimer = null; }
