#!/usr/bin/env python3
"""Builds game/assets from the raw asset packs supplied by the project owner.
Run: python3 -I tools/build_assets.py <raw_root> <game_dir>
raw_root contains: raw/ (CraftPix zips), raw7/ (7z contents), rawchar/ (Tiny RPG packs)
"""
import sys, os, json, glob
from PIL import Image
import numpy as np

ROOT, GAME = sys.argv[1], sys.argv[2]
A = os.path.join(GAME, 'assets')
os.makedirs(A, exist_ok=True)
manifest = {}

def save(img, name):
    p = os.path.join(A, name); os.makedirs(os.path.dirname(p), exist_ok=True); img.save(p, optimize=True)
    return 'assets/' + name

# ---------- characters (Zerie, Tiny RPG Character Asset Pack) ----------
B1 = ROOT + '/rawchar/Tiny_RPG_Character_Asset_Pack_01_v2.0_-Free_SoldierOrc/Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc/Characters(100x100 split)/'
B2 = ROOT + '/rawchar/Tiny_RPG_Character_Asset_Pack_02_v1.01-Free_Demon_ABlood_Monster_A/Tiny RPG Character Asset Pack 02 -Free Demon_A&Blood Monster_A/Characters(100x100 split)/'
chars = {
    'soldier': (B1 + 'Soldier/Soldier with shadows/Soldier.png', ['idle', 'walk', 'atk1', 'atk2', 'bow', 'hurt', 'death']),
    'orc': (B1 + 'Orc/Orc with shadows/Orc.png', ['idle', 'walk', 'atk1', 'atk2', 'hurt', 'death']),
    'demon': (B2 + 'Demon_A/Demon_A with shadows/Demon_A.png', ['idle', 'walk', 'atk1', 'atk2', 'hurt', 'death']),
    'blood': (B2 + 'Blood Monster_A/Blood Monster_A with shadows/Blood Monster_A.png', ['idle', 'walk', 'atk1', 'atk2', 'hurt', 'death']),
}
# crop window inside each 100x100 cell; feet at y=59 -> anchor (24, 29)
CX, CY, CW, CH = 25, 30, 56, 34
manifest['chars'] = {}
for name, (path, anims) in chars.items():
    im = Image.open(path).convert('RGBA')
    rows = im.height // 100; cols = im.width // 100
    a = np.array(im)[:, :, 3]
    out = Image.new('RGBA', (CW * cols, CH * rows))
    info = {'fw': CW, 'fh': CH, 'ax': 49 - CX, 'ay': 59 - CY, 'anims': {}}
    for r in range(rows):
        n = 0
        for c in range(cols):
            if a[r*100:(r+1)*100, c*100:(c+1)*100].any(): n = c + 1
            cell = im.crop((c*100 + CX, r*100 + CY, c*100 + CX + CW, r*100 + CY + CH))
            out.paste(cell, (c * CW, r * CH))
        info['anims'][anims[r]] = {'row': r, 'n': n}
    info['src'] = save(out, f'chars/{name}.png')
    manifest['chars'][name] = info
arrow = Image.open(B1 + 'Soldier/Arrow(projectile)/Arrow01(32x32).png').convert('RGBA')
bb = arrow.getbbox(); arrow = arrow.crop(bb)  # points right
manifest['arrow'] = save(arrow, 'fx/arrow.png')

# ---------- props (Cainos Pixel Art Top Down - Basic) ----------
CAI = ROOT + '/raw7/Part_2/Part 2/Misc/Pixel Art Top Down - Basic v1.2.3_unz/Texture/'
props = Image.open(CAI + 'TX Props.png').convert('RGBA')
P = {
    'chest': (95, 29, 34, 33), 'crate_big': (159, 17, 34, 48), 'crate': (162, 85, 28, 41),
    'barrel': (161, 152, 30, 38), 'pot1': (164, 216, 23, 36), 'pot2': (163, 287, 27, 29), 'pot3': (164, 347, 23, 34),
    'tomb': (224, 238, 32, 43), 'cross': (226, 302, 28, 42), 'coffin': (287, 157, 34, 59), 'slab': (226, 182, 28, 40),
    'pillar': (351, 173, 34, 79), 'pillar_broken': (415, 193, 34, 59), 'statue': (444, 19, 43, 75),
    'bench': (291, 18, 58, 43), 'altar': (287, 86, 66, 38), 'shrine': (452, 117, 24, 40),
    'rock_big': (2, 429, 59, 46), 'rock1': (161, 481, 29, 29), 'rock2': (129, 483, 29, 24), 'rock3': (67, 486, 26, 21),
    'sign': (98, 159, 29, 34), 'stele': (287, 305, 34, 48), 'well': (419, 358, 57, 51),
}
manifest['props'] = {}
for k, (x, y, w, h) in P.items():
    manifest['props'][k] = save(props.crop((x, y, x + w, y + h)), f'props/{k}.png')
plant = Image.open(CAI + 'TX Plant.png').convert('RGBA')
PL = {'tree1': (23, 13, 115, 141), 'tree2': (160, 16, 99, 138), 'tree3': (294, 30, 81, 122),
      'bush1': (215, 184, 49, 44), 'bush2': (281, 185, 41, 47), 'bush3': (155, 189, 40, 34), 'bush4': (345, 189, 42, 37),
      'bush5': (97, 194, 29, 27), 'grass1': (7, 393, 19, 11), 'grass2': (40, 393, 18, 12), 'grass3': (101, 393, 17, 13)}
for k, (x, y, w, h) in PL.items():
    manifest['props'][k] = save(plant.crop((x, y, x + w, y + h)), f'props/{k}.png')

# ---------- biome backdrops: layered parallax landscapes (CraftPix) ----------
SUM = ROOT + '/raw/Free-Summer-Pixel-Art-Backgrounds/PNG/'
NAT = ROOT + '/raw/Nature_Landscapes_Free_Pixel_Art/'
BIOMES = [('Green Meadows', SUM + 'summer 2/'), ('Mountain Pass', SUM + 'summer5/'), ('Rolling Hills', NAT + 'nature_2/'),
          ('Stormy Plains', SUM + 'summer 3/'), ('Stone Spires', NAT + 'nature_7/')]
OFF = 108  # image row drawn at screen y=0 (screen is 216 tall, image 324)
manifest['biomes'] = []
for i, (n, d) in enumerate(BIOMES):
    fs = sorted([f for f in glob.glob(d + '*.png') if os.path.basename(f).split('.')[0].isdigit()], key=lambda f: int(os.path.basename(f).split('.')[0]))
    layers = []
    for j, f in enumerate(fs):
        im = Image.open(f).convert('RGBA').crop((0, OFF, 576, 324))
        a = np.array(im)[:, :, 3]; rows = a.any(axis=1).nonzero()[0]
        layers.append({'src': save(im, f'bg/b{i}_{j}.png'), 'top': int(rows.min()), 'bottom': int(rows.max())})
    reach = [k for k, L in enumerate(layers) if L['bottom'] >= 210]
    ground = reach[-1]
    for k, L in enumerate(layers):
        if k == 0: L['speed'] = 0.03
        elif k == ground: L['speed'] = 1.0 if L['top'] > 60 else 0.45
        elif L['bottom'] < 200: L['speed'] = 0.08
        elif k < ground: L['speed'] = 0.1 + 0.6 * (k / ground) ** 2
        else: L['speed'] = 1.0
    manifest['biomes'].append({'name': n, 'layers': layers})

# ---------- FX (PVFX Foundry, CC0) ----------
PV = ROOT + '/raw2/pvfx/effects/'
FXSEL = {'hit': 'impacts/hit-spark', 'arrowhit': 'projectiles/arrow-impact', 'boom': 'explosions/small-explosion',
         'big': 'explosions/big-explosion', 'nova': 'explosions/fire-nova', 'static': 'lightning/static-burst',
         'levelup': 'ui/level-up', 'star': 'ui/star-burst-pickup', 'bad': 'impacts/crit-hit', 'puff': 'smoke/dust-puff',
         'shatter': 'impacts/rock-shatter', 'shield': 'holy/shield-bubble', 'smite': 'holy/holy-smite', 'coin': 'ui/coin-pickup',
         'shock': 'impacts/shockwave-ring', 'aura': 'status/power-up-aura', 'campfire': 'fire/campfire'}
manifest['fx'] = {}
for k, e in FXSEL.items():
    m = json.load(open(PV + e + '/lit/grid/manifest.json')); fr = m['frames']
    sh = Image.open(PV + e + '/lit/grid/sprite-sheet.png').convert('RGBA')
    fw, fh = fr[0]['sheet']['width'], fr[0]['sheet']['height']
    strip = Image.new('RGBA', (fw * len(fr), fh))
    for i, f in enumerate(fr):
        q = f['sheet']; strip.paste(sh.crop((q['x'], q['y'], q['x'] + fw, q['y'] + fh)), (i * fw, 0))
    durs = [round(f['duration']['numerator_ms'] / f['duration']['denominator']) for f in fr]
    manifest['fx'][k] = {'src': save(strip, f'fx/{k}.png'), 'n': len(fr), 'fw': fw, 'fh': fh, 'px': m['pivot'][0], 'py': m['pivot'][1], 'durs': durs}

# ---------- villagers (Minifolks Villagers) for the camp ----------
VL = ROOT + '/raw2/08671237-MinifolksVillagers/MinifolksVillagers/Outline/'
manifest['villagers'] = {}
for n in ['MiniPeasant', 'MiniWorker', 'MiniVillagerMan', 'MiniVillagerWoman', 'MiniOldMan', 'MiniOldWoman', 'MiniNobleMan', 'MiniNobleWoman', 'MiniQueen', 'MiniPrincess']:
    im = Image.open(VL + n + '.png').convert('RGBA'); a_ = np.array(im)[:, :, 3]
    rows = []
    for r in range(im.height // 32):
        rows.append(sum(1 for c in range(im.width // 32) if a_[r*32:(r+1)*32, c*32:(c+1)*32].any()))
    manifest['villagers'][n] = {'src': save(im, f'villagers/{n}.png'), 'fw': 32, 'fh': 32, 'rows': rows}
    # also register as a character sheet (same schema as the Tiny RPG sheets)
    names = {5: ['idle', 'walk', 'emote', 'hurt', 'death'], 6: ['idle', 'walk', 'emote', 'atk1', 'hurt', 'death'],
             7: ['idle', 'walk', 'emote', 'atk1', 'atk2', 'hurt', 'death']}[len(rows)]
    src = manifest['villagers'][n]['src']
    manifest['chars']['v_' + n[4:].lower()] = {'src': src, 'fw': 32, 'fh': 32, 'ax': 15, 'ay': 30,
        'anims': {nm: {'row': r, 'n': rows[r]} for r, nm in enumerate(names)}}

# ---------- traps (CC0) ----------
TR = ROOT + '/raw7/Art_Update_-_Nov_8/VFX/Traps_unz/'
manifest['traps'] = {}
for k, f, fw in [('spike', 'Spike Trap.png', 32), ('fire', 'Fire_Trap.png', 32)]:
    im = Image.open(TR + f).convert('RGBA')
    manifest['traps'][k] = {'src': save(im, f'traps/{k}.png'), 'n': im.width // fw, 'fw': fw, 'fh': im.height}

# ---------- icons (CraftPix paladin + loot) ----------
PI = ROOT + '/raw7/f48b86d0-Part_4/Companion Ability Icons/free-paladin-pixel-art-skill-icons_unz/PNG/'
LI = ROOT + '/raw7/f48b86d0-Part_4/Companion Ability Icons/free-40-loot-icons-pixel-art_unz/1 Icons/'
ICONS = {'w_arrow': PI + 'Icon14.png', 'w_rapid': PI + 'Icon23.png', 'w_spread': PI + 'Icon22.png',
         'w_lance': PI + 'Icon12.png', 'w_fire': PI + 'Icon13.png', 'w_storm': PI + 'Icon19.png',
         'u_rate': PI + 'Icon11.png', 'u_dmg': PI + 'Icon10.png', 'u_shield': PI + 'Icon16.png',
         'u_men': PI + 'Icon15.png', 'u_bomb': LI + 'Icons_31.png', 'coin': LI + 'Icons_01.png',
         'skull': LI + 'Icons_40.png', 'star': PI + 'Icon35.png'}
manifest['icons'] = {k: save(Image.open(v).convert('RGBA'), f'icons/{k}.png') for k, v in ICONS.items()}


# ---------- UI (Humble Pixel - Paper UI System) ----------
UI = ROOT + '/rawui/Humble Gift - Paper UI System v1.1/Sprites/'
ui_map = {}
for i in range(1, 27): ui_map[f'paper{i}'] = UI + f'Paper UI Pack/Plain/1 Paper/{i}.png'
for i in range(1, 34): ui_map[f'btn{i}'] = UI + f'Content/4 Buttons/Sliced/{i}.png'
for i in range(1, 16): ui_map[f'bar{i}'] = UI + f'Content/3 Progress Bars/{i}.png'
for k, i in [('check', 10), ('cross', 11), ('lock', 12), ('coins', 21)]: ui_map[k] = UI + f'Content/2 Icons/{i}.png'
for k, i in [('ribbonL', 6), ('ribbonM', 7), ('ribbonR', 8)]: ui_map[k] = UI + f'Content/10 Banners & Headers/Cutout/{i}.png'
manifest['ui'] = {k: save(Image.open(v).convert('RGBA'), f'ui/{k}.png') for k, v in ui_map.items()}

# ---------- dark UI theme (Hypnobius - Dark Ages UI) ----------
DK = Image.open(ROOT + '/raw3/DarkAgesUi_v1.0/DarkAgesUi_v1.0/32x32-Tilesheet.png').convert('RGBA')
for k, box in {'dk_frame': (0, 0, 96, 96), 'dk_parch': (96, 0, 192, 96), 'dk_btn_dark': (0, 104, 64, 124),
               'dk_btn_gray': (64, 104, 128, 124), 'dk_btn_blue': (128, 104, 192, 124)}.items():
    manifest['ui'][k] = save(DK.crop(box), f'ui/{k}.png')

# ---------- Horde campaign backdrops (ansimuz, CC0 / free to redistribute) ----------
A3 = ROOT + '/raw3/'
HB = [
  ('Dusk Peaks', A3 + 'Super_Mountain_Dusk_Files/Super Mountain Dusk Files/Assets/version A/Layers/', ['sky', 'far-clouds', 'near-clouds', 'far-mountains', 'mountains', 'trees']),
  ('Rocky Pass', A3 + 'Rocky_Pass_Files/Rocky Pass Files/PNG/', ['back', 'middle', 'near']),
  ('Tall Forest', A3 + 'Tall_Forest_Files/Tall Forest Files/Assets/Layers/', ['back', 'far', 'middle']),
  ('Magic Road', A3 + 'Magical_Road_Files/Magical Road Files/Layers/', ['back', 'middle']),
  ('Twilight Range', A3 + 'Super_Mountain_Dusk_Files/Super Mountain Dusk Files/Assets/version B/Layers/', ['sky', 'far-mountains', 'middle-mountains', 'far-trees', 'myst', 'near-trees']),
]
manifest['biomesH'] = []
for i, (n, d, ls) in enumerate(HB):
    layers = []
    for j, l in enumerate(ls):
        im = Image.open(d + l + '.png').convert('RGBA')
        sp = 0.03 if j == 0 else round(0.08 + 0.5 * (j / max(1, len(ls) - 1)) ** 1.5, 3)
        layers.append({'src': save(im, f'bgh/h{i}_{j}.png'), 'speed': sp, 'y': 216 - im.height})
    # sample ground palette from the bottom of the front-most layer
    front = Image.open(d + ls[-1] + '.png').convert('RGBA'); arr = np.array(front)
    rows = arr[-30:].reshape(-1, 4); rows = rows[rows[:, 3] > 200][:, :3]
    base = rows.mean(axis=0) if len(rows) else np.array([60, 70, 50])
    manifest['biomesH'].append({'name': n, 'layers': layers, 'ground': [int(c) for c in base]})
# ansimuz props for Horde-campaign decor
for k, f in {'h_crystal1': 'Rocky_Pass_Files/Rocky Pass Files/PNG/Props/crystal-1.png', 'h_crystal2': 'Rocky_Pass_Files/Rocky Pass Files/PNG/Props/crystal-2.png',
             'h_plant1': 'Rocky_Pass_Files/Rocky Pass Files/PNG/Props/plant-1.png', 'h_plant2': 'Rocky_Pass_Files/Rocky Pass Files/PNG/Props/plant-2.png',
             'h_rock': 'Tall_Forest_Files/Tall Forest Files/Assets/Layers/Props/Rock.png', 'h_fern': 'Tall_Forest_Files/Tall Forest Files/Assets/Layers/Props/Plant.png',
             'h_moss1': 'Tall_Forest_Files/Tall Forest Files/Assets/Layers/Props/moss-1.png', 'h_moss2': 'Tall_Forest_Files/Tall Forest Files/Assets/Layers/Props/moss-2.png',
             'h_tree': 'Magical_Road_Files/Magical Road Files/Layers/tree.png'}.items():
    manifest['props'][k] = save(Image.open(A3 + f).convert('RGBA'), f'props/{k}.png')

# ---------- full Tiny RPG roster (Zerie, full 22-character pack) ----------
FULL = ROOT + '/raw4/full/Tiny RPG Character Asset Pack 01 v2.0 -Full 22 Characters/Characters(100x100 split)/'
FX0, FY0, FW, FH = 10, 12, 80, 52      # crop window inside each 100x100 cell
def find_anim(folder, name, keys):
    fs = sorted(os.listdir(folder))
    for k in keys:
        for f in fs:
            base = f[:-4]
            if 'ffect' in base or 'With magic' in base: continue
            suf = base[len(name):].lstrip('_-').lower()
            if suf == k.lower(): return os.path.join(folder, f)
    return None
for name in sorted(os.listdir(FULL)):
    sub = os.path.join(FULL, name, name + ' with shadows')
    if not os.path.isdir(sub): sub = os.path.join(FULL, name, name)
    plan = [('idle', ['Idle', 'Flying']), ('walk', ['Walk', 'Walk01', 'Flying']), ('atk1', ['Attack01', 'Attack']),
            ('atk2', ['Attack02', 'Attack01', 'Attack']), ('atk3', ['Attack03', 'Attack3', 'Attack02', 'Attack01', 'Attack']),
            ('hurt', ['Hurt']), ('death', ['Death', 'DEATH'])]
    rows = []
    for an, keys in plan:
        f = find_anim(sub, name, keys)
        im = Image.open(f).convert('RGBA'); n = im.width // 100
        rows.append((an, im, n))
    maxn = max(n for _, _, n in rows)
    sheet = Image.new('RGBA', (FW * maxn, FH * len(rows)))
    anims = {}
    for r, (an, im, n) in enumerate(rows):
        for c in range(n): sheet.paste(im.crop((c * 100 + FX0, FY0, c * 100 + FX0 + FW, FY0 + FH)), (c * FW, r * FH))
        anims[an] = {'row': r, 'n': n}
    key = name.lower().replace(' ', '_')
    manifest['chars'][key] = {'src': save(sheet, f'chars/{key}.png'), 'fw': FW, 'fh': FH, 'ax': 49 - FX0, 'ay': 59 - FY0, 'anims': anims}
manifest['arrows'] = {}
for i in (1, 2, 3):
    a = Image.open(FULL + f'../Arrow(Projectile)/Arrow0{i}(32x32).png').convert('RGBA'); a = a.crop(a.getbbox())
    manifest['arrows'][f'arrow{i}'] = save(a, f'fx/arrow{i}.png')

# ---------- big boss sheets (LuizMelo packs, CC0) ----------
BX = ROOT + '/raw4/more2/x/'
BIG = {
  'evil_wizard':  ('Evil Wizard/Evil Wizard/Sprites', {'idle': 'Idle', 'walk': 'Move', 'atk1': 'Attack', 'hurt': 'Take Hit', 'death': 'Death'}),
  'evil_wizard2': ('EVil Wizard 2/EVil Wizard 2/Sprites', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack1', 'hurt': 'Take hit', 'death': 'Death'}),
  'evil_wizard3': ('Evil Wizard 3/Evil Wizard 3/Sprites', {'idle': 'Idle', 'walk': 'Walk', 'atk1': 'Attack', 'hurt': 'Get hit', 'death': 'Death'}),
  'king':         ('Medieval King Pack 2/Medieval King Pack 2/Sprites', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack1', 'hurt': 'Take Hit', 'death': 'Death'}),
  'hero_knight':  ('Hero Knight 2/Hero Knight 2/Sprites', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack', 'hurt': 'Take Hit', 'death': 'Death'}),
  'huntress':     ('Huntress/Huntress/Sprites', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack1', 'hurt': 'Take hit', 'death': 'Death'}),
  'huntress2':    ('Huntress 2/Huntress 2/Sprites/Character', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack', 'hurt': 'Get Hit', 'death': 'Death'}),
  'warrior':      ('Fantasy Warrior/Fantasy Warrior/Sprites', {'idle': 'Idle', 'walk': 'Run', 'atk1': 'Attack1', 'hurt': 'Take hit', 'death': 'Death'}),
}
for key, (d, files) in BIG.items():
    ims = {}
    for an, f in files.items():
        im = Image.open(BX + d + '/' + f + '.png').convert('RGBA')
        fw = im.height if im.width % im.height == 0 else 160
        ims[an] = (im, fw, im.width // fw)
    fw = ims['idle'][1]; fh = ims['idle'][0].height
    # common bbox over all frames so every frame shares one anchor
    xs0, ys0, xs1, ys1 = fw, fh, 0, 0
    for im, _, n in ims.values():
        for c in range(n):
            bb = im.crop((c * fw, 0, c * fw + fw, fh)).getbbox()
            if bb: xs0, ys0, xs1, ys1 = min(xs0, bb[0]), min(ys0, bb[1]), max(xs1, bb[2]), max(ys1, bb[3])
    ib = None
    for c in range(ims['idle'][2]):
        bb = ims['idle'][0].crop((c * fw, 0, c * fw + fw, fh)).getbbox()
        if bb: ib = bb if ib is None else (min(ib[0], bb[0]), min(ib[1], bb[1]), max(ib[2], bb[2]), max(ib[3], bb[3]))
    cw, ch = xs1 - xs0, ys1 - ys0
    order = ['idle', 'walk', 'atk1', 'hurt', 'death']; maxn = max(ims[a][2] for a in order)
    sheet = Image.new('RGBA', (cw * maxn, ch * len(order))); anims = {}
    for r, an in enumerate(order):
        im, _, n = ims[an]
        for c in range(n): sheet.paste(im.crop((c * fw + xs0, ys0, c * fw + xs1, ys1)), (c * cw, r * ch))
        anims[an] = {'row': r, 'n': n}
    ax = (ib[0] + ib[2]) // 2 - xs0; ay = ib[3] - ys0
    manifest['chars'][key] = {'src': save(sheet, f'chars/{key}.png'), 'fw': cw, 'fh': ch, 'ax': ax, 'ay': ay, 'anims': anims, 'big': True}

# ---------- camp props (Adventurer's Camp) ----------
CP = ROOT + '/raw4/more2/x/camp-v11/camp/assets/'
manifest['camp'] = {}
for k in ['pavilion_tent_0', 'pavilion_tent_1', 'big_tent_0', 'officer_tent_0', 'bell_tent_0', 'tent_1', 'supply_tent_0', 'tepee_painted_0', 'tepee_painted_1',
          'yurt_1', 'patched_tent_0', 'hunting_lodge_1', 'covered_wagon_0', 'supply_wagon_0']:
    manifest['camp'][k] = save(Image.open(CP + 'tents/' + k + '.png').convert('RGBA'), f'camp/{k}.png')
for k in ['archery_target_0', 'barrels_0', 'supply_crates_0', 'weapon_rack_0', 'stacked_shields_0', 'log_seat_0', 'ammo_crates_0', 'hide_frame_0',
          'trophy_rack_0', 'trophy_rack_1', 'firewood_0', 'signpost_0', 'sentry_box_0', 'notice_board_0', 'hide_rack_1', 'log_pile_axe_0']:
    manifest['camp'][k] = save(Image.open(CP + 'props/' + k + '.png').convert('RGBA'), f'camp/{k}.png')
manifest['campAnim'] = {}
for k in ['campfire_0', 'campfire_2', 'brazier_stand_0', 'brazier_stand_1', 'flag_0', 'flag_1', 'spit_roast_boar_0', 'smoke_signal_fire_1', 'lantern_0']:
    im = Image.open(CP + 'animations/' + k + '_anim.png').convert('RGBA')
    manifest['campAnim'][k] = {'src': save(im, f'camp/{k}_anim.png'), 'fw': im.width // 8, 'fh': im.height, 'n': 8}

with open(os.path.join(A, 'manifest.json'), 'w') as f: json.dump(manifest, f, indent=1)
print('ok', sum(len(fs) for _, _, fs in os.walk(A)), 'files')
