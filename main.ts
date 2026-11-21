// Night Ledger — the hand-in program (Node 22, standard library only).
//
// What it does, and nothing else: it takes the game and its screenshots from
// beside this file, lays them out under the output directory the grader gives
// it (/output, or MAKEFUN_OUTPUT_DIR outside the grader), and writes the
// dossier the judge reads, using the kit's own library to build it.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The two runs the grader makes must write the same bytes, so there is no
// clock, no randomness and no network here — just copies and one build.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

mkdirSync(outDir, { recursive: true });

// The whole game, exactly as it ships: static files a desktop browser opens
// with no build step and no network request.
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

// The maker's own screenshots of the game running (the first by name is the
// cover). Absent only when someone runs this before taking any.
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The dossier, built by the kit's library from exactly what was just copied:
// the same bytes the gate rebuilds and compares against, so a mismatch can
// only mean the output was touched after this program ran.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Night Ledger handed in to ${outDir}`);
