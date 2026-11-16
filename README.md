# Go Forth and Break Things

A free pixel-art game loosely inspired by those dumb mobile game ads: your squad marches across the battlefield, picks a gate (`+5`, `x2`, `-3`…), smashes crates for upgrades, and mows down the opposing forces. I've added some roguelite elements to keep things interesting, but the goal was to have a quick on the toilet or waiting for the bus game, nothing too deep.

Available on Itch.io here: https://salicyclic.itch.io/go-forth-and-break-things

## Features

- **Two factions:** *Us* (The Realm, humans fighting monsters) or *Them* (The Horde, monsters fighting humans). Each has its own heroes, enemies, bosses, landscapes and camp.
- **10 heroes:** 5 per faction, each with its own upgradable attack.
  - The Realm: Archer, Lancer, Wizard, Priest, Swordsman.
  - The Horde: Orc Raider, Bone Archer, Imp, Necromancer, Orc Rider.
- **100 levels:**
  - 3 waves each, then a mini-boss, plus a full boss every 5th level.
  - Progress is automatically saved after every level.
- **Endless mode:** survive as many waves as you can.
- **Daily challenge:** one seeded level per day with a twist (Gold Rush, Swarm, Glass Cannon, Gate Storm) and a once-a-day reward.
- **Records:** lifetime stats and 14 achievements with coin rewards.
- **Rogue-lite camp:**
  - You keep your coins on defeat.
  - 8 permanent upgrades, plus hero unlocks and mastery.
- **Saves:** 3 save slots, with copyable save codes to move a save between devices (Export / Import on the save screen).

## Run it

```sh
# 1. get the art packs listed in CREDITS.md and put the downloads in ./downloads
python3 tools/unpack_art.py downloads art     # unpacks into the layout the build expects
python3 tools/build_assets.py art game         # crops/packs sprites into game/assets
python3 -m http.server -d game 8000            # play at http://localhost:8000
python3 tools/bundle.py game dist/go-forth.html   # optional: one self-contained HTML file
```

Python 3 with Pillow and NumPy is required. `.7z` files are read by `tools/un7z.py`, so no 7-Zip install is needed.

**Controls:**
- Move: drag up/down, or use the arrow keys / W-S.
- Pause: `P`. `Esc` (or the Android back button) pauses a run or goes back one screen.
- Pick a boon: `1`–`3`.

**Debug URL flags:** `?level=N`, `?endless`, `?faction=us|them`, `?hero=<id>`, `?camp=N`, `?coins=N`, `?bot=1` (autopilot), `?speed=N`, `?daily`, `?debug=1` (frame-time overlay), `?screen=camp|heroes|levels|slots|faction|options|records|credits`.

## Testing

`tools/test/` contains Playwright scripts:
- `sim.mjs`: runs levels with the autopilot.
- `career.mjs`: plays, buys upgrades and retries to check progression pacing.
- `shot.mjs`: takes screenshots.

Install with `npm i playwright`.

## License

The code is MIT (see `LICENSE`). The art belongs to its creators and is **not** included in this repository; see `CREDITS.md`.
