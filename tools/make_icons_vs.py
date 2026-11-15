#!/usr/bin/env python3
"""'Us vs Them' app-icon variants. 42x42 pixel grid, each art pixel = 12x12 output pixels (504px + 4px frame = 512)."""
import sys, json
from PIL import Image, ImageDraw
sys.path.insert(0, sys.argv[3] if len(sys.argv) > 3 else '.')
G, OUT = sys.argv[1], sys.argv[2]
M = json.load(open(f'{G}/assets/manifest.json'))
N = 42
def layers(biome_list, i, horde=False):
    base = Image.new('RGBA', (384, 216), (0, 0, 0, 255))
    for l in biome_list[i]['layers']:
        L = Image.open(f"{G}/{l['src']}").convert('RGBA')
        for xx in range(0, 384, L.width): base.alpha_composite(L, (xx, l.get('y', 0) if horde else 0))
    return base
def char(key, anim, idx=0, flip=False):
    m = M['chars'][key]; sh = Image.open(f"{G}/{m['src']}").convert('RGBA'); a = m['anims'][anim]; c = idx % a['n']
    f = sh.crop((c * m['fw'], a['row'] * m['fh'], c * m['fw'] + m['fw'], a['row'] * m['fh'] + m['fh']))
    ax = m['ax']
    if flip: f = f.transpose(Image.FLIP_LEFT_RIGHT); ax = m['fw'] - ax
    return f, ax, m['ay']
def put(im, key, anim, x, y, idx=0, flip=False):
    f, ax, ay = char(key, anim, idx, flip); im.alpha_composite(f, (int(x - ax), int(y - ay)))
GLYPH = {'V': ['10001','10001','10001','10001','10001','01010','00100'], 'S': ['01111','10000','10000','01110','00001','00001','11110']}
def vs_badge(im, cx, cy):
    d = ImageDraw.Draw(im)
    d.rectangle([cx - 7, cy - 5, cx + 6, cy + 5], fill=(42, 26, 16, 255)); d.rectangle([cx - 6, cy - 4, cx + 5, cy + 4], fill=(165, 50, 42, 255))
    d.rectangle([cx - 6, cy - 4, cx + 5, cy - 4], fill=(232, 200, 90, 255)); d.rectangle([cx - 6, cy + 4, cx + 5, cy + 4], fill=(110, 31, 26, 255))
    for i, ch in enumerate('VS'):
        for r, row in enumerate(GLYPH[ch]):
            for k, b in enumerate(row):
                if b == '1': d.point((cx - 5 + i * 6 + k, cy - 3 + r), fill=(255, 244, 220, 255))
def split(a, b, diag=True):
    im = Image.new('RGBA', (N, N)); im.alpha_composite(b)
    mask = Image.new('L', (N, N)); md = ImageDraw.Draw(mask)
    md.polygon([(0, 0), (N, 0), (0, N)] if diag else [(0, 0), (N // 2, 0), (N // 2, N), (0, N)], fill=255)
    im.paste(a, (0, 0), mask)
    d = ImageDraw.Draw(im)
    if diag: d.line([(N, 0), (0, N)], fill=(255, 230, 150, 255), width=1)
    else: d.line([(N // 2, 0), (N // 2, N)], fill=(255, 230, 150, 255), width=1)
    return im
realm = layers(M['biomes'], 0); horde = layers(M['biomesH'], 0, True)
def crop(img, x, y): return img.crop((x, y, x + N, y + N))
def save(im, name):
    big = Image.new('RGBA', (512, 512), (42, 26, 16, 255)); big.alpha_composite(im.resize((504, 504), Image.NEAREST), (4, 4))
    big.save(f'{OUT}/{name}.png'); return big
out = []
# four "duel" variants: one champion per side of a diagonal, idle poses so silhouettes stay clean
DUELS = [('vs_archer_orc', 'archer', 'orc', 150, 104, 150, 122),
         ('vs_archer_bonearcher', 'archer', 'skeleton_archer', 60, 104, 250, 122),
         ('vs_wizard_necromancer', 'wizard', 'necromancer', 250, 100, 60, 118),
         ('vs_swordsman_rider', 'swordsman', 'orc_rider', 300, 104, 300, 122)]
for name, us, them, rx, ry, hx, hy in DUELS:
    im = split(crop(realm, rx, ry), crop(horde, hx, hy))
    sh = Image.new('RGBA', (N, N)); d = ImageDraw.Draw(sh)
    d.ellipse([3, 21, 21, 25], fill=(0, 0, 0, 70)); d.ellipse([21, 37, 41, 41], fill=(0, 0, 0, 70)); im.alpha_composite(sh)
    put(im, us, 'idle', 12, 23, 1); put(im, them, 'idle', 31, 39, 2, flip=True)
    vs_badge(im, 29, 12)
    out.append((name, save(im, name)))
sheet = Image.new('RGBA', (4 * 280, 400), (32, 28, 40, 255)); sd = ImageDraw.Draw(sheet)
for i, (n, big) in enumerate(out):
    sheet.alpha_composite(big.resize((256, 256), Image.NEAREST), (i * 280 + 12, 12))
    small = big.resize((96, 96), Image.LANCZOS); mk = Image.new('L', (96, 96)); ImageDraw.Draw(mk).rounded_rectangle([0, 0, 95, 95], 24, fill=255)
    sheet.paste(small, (i * 280 + 92, 285), mk)
    sd.text((i * 280 + 14, 272), n.upper().replace('_', ' '), fill=(230, 220, 190, 255))
sheet.save(f'{OUT}/vs_options.png'); print('ok')
