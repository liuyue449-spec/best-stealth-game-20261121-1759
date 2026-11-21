# Night Ledger

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/liuyue449-spec/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/liuyue449-spec/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game in three nights. You are the courier. The archive is
guarded, the seals are scattered, and the east door only opens when you hold
them all.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no
network request — everything the game loads is a file in `game/`.

## How to play

- **WASD / arrows** — move
- **Shift (hold)** — sneak: slow, quiet, harder to spot
- **Click / Q** — toss a coin: the clink pulls a nearby guard over to look
- **M** — mute · **R** — restart

Stay out of the yellow vision cones. Bushes hide you, crates block sight, and
a guard who grows sure gives chase — break line of sight and he will search
where he last saw you, then go back to his patrol. Walking feet are heard up
close; sneaking feet are not. Collect every seal, then reach the exit unseen.
Three levels, three lives. Finish without ever being spotted for the GHOST rank.

## Layout

- `game/index.html` + `game/style.css` — page shell and HUD
- `game/src/config.js` — all tuning in one place
- `game/src/levels.js` — the three level maps and patrol routes
- `game/src/world.js` — map parsing, collision, line of sight
- `game/src/guards.js` — patrols, vision cones, suspicion and pursuit
- `game/src/player.js` — movement, sneaking, the tossed coin
- `game/src/simulate.js` — one tick of the game (pure logic, no drawing)
- `game/src/render.js` — everything you see on the canvas
- `game/src/audio.js` — footsteps and stings, synthesized live with WebAudio
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the autopilot behind the `?shot=` screenshot scenes
- `game/src/main.js` — screens, the loop, the HUD
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `serve.ts` — a tiny static server for local play

## Screenshots

The shots in `screenshots/` are real renders of the game's own code in a
browser: each `?shot=` scene in `shots.json` plays the actual simulation
forward with an autopilot and freezes one frame.

---

<sub>Entered on [make.fun](https://make.fun/?ref=41fgp6ys&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
