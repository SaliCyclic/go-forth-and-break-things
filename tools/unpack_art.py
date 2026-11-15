#!/usr/bin/env python3
"""Unpack the original art-pack downloads into the folder layout tools/build_assets.py expects.

Usage:
    python3 tools/unpack_art.py <downloads_dir> art
    python3 tools/build_assets.py art game

<downloads_dir> holds the original .zip / .7z files exactly as downloaded (see CREDITS.md for the list).
.7z files are read with tools/un7z.py (no 7-Zip install needed).
"""
import os, sys, re, zipfile, subprocess, glob

SRC, ART = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))

def unzip(path, dest):
    os.makedirs(dest, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for m in z.infolist():
            p = os.path.normpath(os.path.join(dest, m.filename))
            if not p.startswith(os.path.abspath(dest)): raise SystemExit('unsafe path in ' + path)
        z.extractall(dest)

def un7z(path, dest):
    os.makedirs(dest, exist_ok=True)
    subprocess.run([sys.executable, '-I', os.path.join(HERE, 'un7z.py'), path, dest], check=True)

def find(pattern):
    hits = [f for f in os.listdir(SRC) if re.search(pattern, f, re.I)]
    if not hits: print('  missing:', pattern); return None
    return os.path.join(SRC, hits[0])

def strip_id(name):  # downloads sometimes carry a short hex prefix like "0bbb6a72-"
    return re.sub(r'^[0-9a-f]{8}-', '', name)

# 1) CraftPix backgrounds -> art/raw/<name>
for pat in [r'Nature_Landscapes', r'sky-with-clouds', r'Summer-Pixel-Art-Backgrounds', r'New_free_backgrounds_part\d']:
    for f in sorted(os.listdir(SRC)):
        if re.search(pat, f, re.I) and f.endswith('.zip'):
            unzip(os.path.join(SRC, f), os.path.join(ART, 'raw', strip_id(f[:-4])))

# 2) the three mixed .7z bundles -> art/raw7/<name>, with every nested zip unzipped next to itself as <zip>_unz
for pat, name in [(r'Art_Update.*\.7z$', 'Art_Update_-_Nov_8'), (r'Part_2\.7z$', 'Part_2'), (r'Part_4\.7z$', 'f48b86d0-Part_4')]:
    f = find(pat)
    if f: un7z(f, os.path.join(ART, 'raw7', name))
for z in glob.glob(os.path.join(ART, 'raw7', '**', '*.zip'), recursive=True):
    unzip(z, z[:-4] + '_unz')

# 3) Tiny RPG character packs (free samples) -> art/rawchar/<name>
for pat in [r'Tiny_RPG.*01_v2\.0_-Free', r'Tiny_RPG.*02_v1\.01']:
    f = find(pat)
    if f: unzip(f, os.path.join(ART, 'rawchar', strip_id(os.path.basename(f)[:-4])))

# 4) Paper UI -> art/rawui
f = find(r'Paper_UI_System')
if f: unzip(f, os.path.join(ART, 'rawui'))

# 5) Minifolks villagers + PVFX -> art/raw2
f = find(r'MinifolksVillagers\.7z$')
if f: un7z(f, os.path.join(ART, 'raw2', '08671237-MinifolksVillagers'))
f = find(r'pvfx-foundry')
if f: unzip(f, os.path.join(ART, 'raw2', 'pvfx'))

# 6) Dark Ages UI + ansimuz backgrounds -> art/raw3/<name>
for pat in [r'DarkAgesUi', r'Fort_of_Illusion', r'Jungle_ruins', r'Magical_Road', r'Rocky_Pass', r'Sunny-land', r'Super_Mountain_Dusk', r'Tall_Forest']:
    f = find(pat)
    if f: unzip(f, os.path.join(ART, 'raw3', strip_id(os.path.basename(f)[:-4])))

# 7) full Tiny RPG pack + "More 2" bundle -> art/raw4
f = find(r'Full_22_Characters')
if f: unzip(f, os.path.join(ART, 'raw4', 'full'))
f = find(r'More_2\.7z$')
if f:
    un7z(f, os.path.join(ART, 'raw4', 'more2'))
    for z in glob.glob(os.path.join(ART, 'raw4', 'more2', 'More 2', '*.zip')):
        unzip(z, os.path.join(ART, 'raw4', 'more2', 'x', os.path.basename(z)[:-4]))
print('done -> now run: python3 tools/build_assets.py', ART, 'game')
