#!/usr/bin/env python3
"""Compose app-icon options from built game assets. Usage: make_icons.py <game_dir> <out_dir>"""
import sys, json, os
from PIL import Image, ImageDraw
G, OUT = sys.argv[1], sys.argv[2]
M = json.load(open(f'{G}/assets/manifest.json'))
S = 64  # pixel-art canvas, scaled x8 -> 512
GLYPH = {'+': ['00000','00100','00100','11111','00100','00100','00000'], 'x': ['00000','00000','10001','01010','00100','01010','10001'],
         '5': ['11111','10000','11110','00001','00001','10001','01110'], '9': ['01110','10001','10001','01111','00001','00010','01100'],
         '2': ['01110','10001','00001','00010','00100','01000','11111'], 'V': ['10001','10001','10001','10001','10001','01010','00100'],
         'S': ['01111','10000','10000','01110','00001','00001','11110'], '0': ['01110','10001','10011','10101','11001','10001','01110']}
def text(im, s, x, y, col, scale=1, outline=None):
    d = ImageDraw.Draw(im)
    def put(ox, oy, c):
        for i, ch in enumerate(s):
            for r, row in enumerate(GLYPH[ch]):
                for k, b in enumerate(row):
                    if b == '1': d.rectangle([x + (i * 6 + k) * scale + ox, y + r * scale + oy, x + (i * 6 + k) * scale + ox + scale - 1, y + r * scale + oy + scale - 1], fill=c)
    if outline:
        for ox, oy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)]: put(ox, oy, outline)
    put(0, 0, col)
def frame(key, anim, idx=0, flip=False):
    m = M['chars'][key]; sh = Image.open(f"{G}/{m['src']}").convert('RGBA'); a = m['anims'][anim]
    f = sh.crop((idx % a['n'] * m['fw'], a['row'] * m['fh'], idx % a['n'] * m['fw'] + m['fw'], a['row'] * m['fh'] + m['fh']))
    if flip: f = f.transpose(Image.FLIP_LEFT_RIGHT)
    ax = m['fw'] - m['ax'] if flip else m['ax']
    return f, ax, m['ay']
def put_char(im, key, anim, x, y, idx=0, flip=False, scale=1):
    f, ax, ay = frame(key, anim, idx, flip)
    if scale != 1: f = f.resize((f.width * scale, f.height * scale), Image.NEAREST); ax *= scale; ay *= scale
    im.alpha_composite(f, (int(x - ax), int(y - ay)))
def bg(layers, crop_x=0, crop_y=None, scale=1):
    """compose a backdrop from layer images, crop a SxS window"""
    base = None
    for src, yoff in layers:
        L = Image.open(f'{G}/{src}').convert('RGBA')
        if base is None: base = Image.new('RGBA', (max(L.width, 384), 216), (0, 0, 0, 255))
        for xx in range(0, base.width, L.width): base.alpha_composite(L, (xx, yoff))
    if scale != 1: base = base.resize((base.width * scale, base.height * scale), Image.NEAREST)
    cy = base.height - S if crop_y is None else crop_y
    return base.crop((crop_x, cy, crop_x + S, cy + S))
def realm_bg(cx=150, cy=90): return bg([(l['src'], 0) for l in M['biomes'][0]['layers']], cx, cy)
def horde_bg(cx=40, cy=40): return bg([(l['src'], l['y']) for l in M['biomesH'][0]['layers']], cx, cy)
def finish(im, name, border=(40, 25, 10, 255)):
    d = ImageDraw.Draw(im)
    big = im.resize((512, 512), Image.NEAREST); big.save(f'{OUT}/{name}.png')
    return big

opts = []
# 1) Gate Rush: archer squad charging through a blue +5 gate
im = realm_bg(170, 110)
d = ImageDraw.Draw(im)
d.rectangle([36, 8, 55, 50], fill=(40, 150, 255, 140)); d.rectangle([36, 8, 55, 9], fill=(159, 216, 255, 255)); d.rectangle([36, 49, 55, 50], fill=(159, 216, 255, 255))
d.rectangle([36, 8, 37, 50], fill=(159, 216, 255, 255)); d.rectangle([54, 8, 55, 50], fill=(159, 216, 255, 255))
d.rectangle([33, 20, 58, 36], fill=(29, 79, 154, 255))
text(im, '+5', 34, 22, (255, 255, 255, 255), 2)
for i, (x, y) in enumerate([(14, 58), (24, 60), (8, 52), (20, 50), (30, 54), (12, 62)]): put_char(im, 'archer', 'walk', x, y, idx=i * 2)
opts.append(('icon_gate_rush', finish(im, 'icon_gate_rush')))
# 2) Us vs Them: split diagonal, archer vs orc
im = Image.new('RGBA', (S, S))
a = realm_bg(120, 100); h = horde_bg(120, 120)
mask = Image.new('L', (S, S)); md = ImageDraw.Draw(mask); md.polygon([(0, 0), (S, 0), (0, S)], fill=255)
im.alpha_composite(h); im.paste(a, (0, 0), mask)
d = ImageDraw.Draw(im); d.line([(S, 0), (0, S)], fill=(255, 230, 150, 255), width=2)
put_char(im, 'archer', 'atk1', 16, 32, idx=5, scale=1); put_char(im, 'orc', 'atk1', 50, 60, idx=3, flip=True)
text(im, 'VS', 24, 26, (255, 230, 150, 255), 1, outline=(40, 20, 10, 255))
opts.append(('icon_us_vs_them', finish(im, 'icon_us_vs_them')))
# 3) Horde: a mass of troops under a big count bubble
im = horde_bg(200, 60)
for r in range(4):
    for c in range(7):
        put_char(im, 'orc' if (r + c) % 3 else 'skeleton', 'walk', 4 + c * 9 + (r % 2) * 4, 40 + r * 7, idx=r + c, flip=False)
d = ImageDraw.Draw(im); d.rectangle([14, 6, 49, 24], fill=(28, 61, 122, 255)); d.rectangle([15, 7, 48, 23], fill=(75, 140, 255, 255)); d.rectangle([30, 25, 33, 27], fill=(28, 61, 122, 255))
text(im, '999', 16, 9, (255, 255, 255, 255), 2, outline=None) if all(ch in GLYPH for ch in '999') else None
opts.append(('icon_horde_999', finish(im, 'icon_horde_999')))
# 4) Break Things: lancer smashing a crate apart with an explosion
im = realm_bg(60, 100)
crate = Image.open(f"{G}/{M['props']['crate_big']}").convert('RGBA')
im.alpha_composite(crate, (34, 62 - crate.height))
fx = M['fx']['boom']; sheet = Image.open(f"{G}/{fx['src']}").convert('RGBA'); fr = 4
boom = sheet.crop((fr * fx['fw'], 0, fr * fx['fw'] + fx['fw'], fx['fh']))
im.alpha_composite(boom, (50 - fx['px'], 40 - fx['py'] + 20))
put_char(im, 'swordsman', 'atk3', 20, 60, idx=7, scale=1)
opts.append(('icon_break_things', finish(im, 'icon_break_things')))
# contact sheet: each option at 512 and as it would look at launcher size (96 px, rounded)
sheet = Image.new('RGBA', (4 * 280, 400), (32, 28, 40, 255)); sd = ImageDraw.Draw(sheet)
for i, (n, big) in enumerate(opts):
    sheet.alpha_composite(big.resize((256, 256), Image.NEAREST), (i * 280 + 12, 12))
    small = big.resize((96, 96), Image.LANCZOS); mk = Image.new('L', (96, 96)); ImageDraw.Draw(mk).rounded_rectangle([0, 0, 95, 95], 24, fill=255)
    sheet.paste(small, (i * 280 + 92, 285), mk)
    sd.text((i * 280 + 14, 272), f'{i + 1}. ' + n.replace('icon_', '').replace('_', ' ').upper(), fill=(230, 220, 190, 255))
sheet.save(f'{OUT}/icon_options.png')
print('ok')
