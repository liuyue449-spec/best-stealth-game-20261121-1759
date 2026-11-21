// Night Ledger — one tick of the game: player, guards, seals and the exit.
// One file, one job: it wires the other modules together into a single step.
// Pure logic, no drawing and no sound, so the screenshot autopilot and the
// tests can run it headlessly exactly as the browser does.

import { GAME, PLAYER } from './config.js';
import { parseWorld } from './world.js';
import { createGuard, hearNoise, stepGuard, GUARD_CHASE } from './guards.js';
import { createPlayer, stepPlayer, tossCoin } from './player.js';
import { LEVELS } from './levels.js';

export const PHASE_PLAY = 'play';
export const PHASE_CAUGHT = 'caught';
export const PHASE_LEVEL_CLEAR = 'level-clear';
export const PHASE_GAME_OVER = 'game-over';
export const PHASE_WIN = 'win';

// Fresh state for one level. `seed` only feeds the coin-toss wobble and the
// ambient details; the level layout itself is fixed by design.
export function createGame(levelIndex) {
  const level = LEVELS[levelIndex];
  const world = parseWorld(level, levelIndex);
  const player = createPlayer(world.start);
  const guards = level.guards.map(createGuard);
  return {
    levelIndex,
    world,
    player,
    guards,
    phase: PHASE_PLAY,
    sealsTaken: 0,
    lives: GAME.lives,
    timeSeconds: 0,
    // How many times any guard got sure enough to chase, this level.
    spottedCount: 0,
    // Total across the whole run, for the win-screen rank.
    runSpottedCount: 0,
    caughtTimer: 0,
    levelClearTimer: 0,
    // Noise ripples the renderer draws: {x, y, radius, age}.
    noises: [],
    // One-line feed for the HUD: what just happened, in plain words.
    message: world.sealTotal === 1
      ? 'Find the seal, then reach the east door.'
      : `Find ${world.sealTotal} seals, then reach the east door.`,
    messageTimer: 0,
    // Events this tick produced, for sound and the HUD: 'spotted' | 'coin' |
    // 'seal' | 'caught' | 'clear' | 'exit-locked'.
    events: [],
  };
}

export function setMessage(game, text, seconds = 4) {
  game.message = text;
  game.messageTimer = seconds;
}

// Advance the game one tick. `input` is the shape input.js produces, plus an
// optional {tossX, tossY} mouse target when the player throws a coin.
export function stepGame(game, input, dt) {
  game.events = [];
  if (game.phase === PHASE_CAUGHT) {
    game.caughtTimer -= dt;
    if (game.caughtTimer <= 0) respawnAfterCaught(game);
    return;
  }
  if (game.phase !== PHASE_PLAY) return;

  game.timeSeconds += dt;
  if (game.messageTimer > 0) game.messageTimer -= dt;

  // Coin toss: the click (or Q) starts the throw; the landing makes the noise.
  if (input.toss && input.tossX !== undefined && input.tossY !== undefined) {
    const landing = tossCoin(game.player, input.tossX, input.tossY);
    if (landing !== null) game.events.push('coin-throw');
  }
  stepPlayer(game.world, game.player, input, dt);

  // A landed coin clinks: guards in earshot come to look.
  const coin = game.player.coin;
  if (coin !== null && coin.t >= 1) {
    game.player.coin = null;
    game.noises.push({ x: coin.x, y: coin.y, radius: PLAYER.coinNoiseRadius, age: 0 });
    if (hearNoise(game.guards, coin.x, coin.y, PLAYER.coinNoiseRadius)) {
      setMessage(game, 'The clink pulls a guard over to look.', 3);
    }
    game.events.push('coin-land');
  }

  // Guards see, suspect, chase and catch.
  for (const guard of game.guards) {
    const event = stepGuard(game.world, guard, game.player, dt);
    if (event === 'spotted') {
      game.spottedCount += 1;
      game.runSpottedCount += 1;
      setMessage(game, 'Spotted! Break line of sight — now!', 3);
      game.events.push('spotted');
    } else if (event === 'lost') {
      setMessage(game, 'You lost them. They are searching where they last saw you.', 3);
    } else if (event === 'caught') {
      onCaught(game);
      return;
    }
  }

  // Noise ripples age out.
  for (const noise of game.noises) noise.age += dt;
  game.noises = game.noises.filter((noise) => noise.age < 0.9);

  // Seals: walk over one to take it.
  for (const seal of game.world.seals) {
    if (seal.taken) continue;
    if (Math.hypot(game.player.x - seal.x, game.player.y - seal.y) < 26) {
      seal.taken = true;
      game.sealsTaken += 1;
      game.events.push('seal');
      if (game.sealsTaken >= game.world.sealTotal) {
        setMessage(game, 'All seals found — the east door is open. Go!', 5);
      } else {
        setMessage(game, `Seal ${game.sealsTaken} of ${game.world.sealTotal}. Keep low.`, 3);
      }
    }
  }

  // Exit: open only once every seal is taken.
  const exit = game.world.exit;
  if (Math.hypot(game.player.x - exit.x, game.player.y - exit.y) < 28) {
    if (game.sealsTaken >= game.world.sealTotal) {
      onLevelClear(game);
    } else if (!game.events.includes('exit-locked')) {
      setMessage(game, `Locked. ${game.world.sealTotal - game.sealsTaken} seal${game.world.sealTotal - game.sealsTaken === 1 ? '' : 's'} still to find.`, 3);
      game.events.push('exit-locked');
    }
  }
}

// The highest detection meter among the guards, 0..100 — the HUD's alarm eye.
export function alarmLevel(game) {
  let top = 0;
  for (const guard of game.guards) top = Math.max(top, guard.meter);
  return top;
}

// True when any guard is actively chasing the player.
export function isBeingChased(game) {
  return game.guards.some((guard) => guard.state === GUARD_CHASE);
}

function onCaught(game) {
  game.lives -= 1;
  game.events.push('caught');
  if (game.lives <= 0) {
    game.phase = PHASE_GAME_OVER;
    setMessage(game, 'Caught for the last time. The night wins this round.', 60);
  } else {
    game.phase = PHASE_CAUGHT;
    game.caughtTimer = GAME.caughtPauseSeconds;
    setMessage(game, `Caught! ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left — back to the start.`, 3);
  }
}

function respawnAfterCaught(game) {
  const fresh = createGame(game.levelIndex);
  // Seals already taken stay taken; the run's spot count stays counted.
  for (let i = 0; i < game.world.seals.length; i += 1) {
    if (game.world.seals[i].taken) {
      fresh.world.seals[i].taken = true;
      fresh.sealsTaken += 1;
    }
  }
  fresh.lives = game.lives;
  fresh.timeSeconds = game.timeSeconds;
  fresh.runSpottedCount = game.runSpottedCount;
  fresh.spottedCount = game.spottedCount;
  fresh.player.coins = game.player.coins;
  game.world = fresh.world;
  game.player = fresh.player;
  game.guards = fresh.guards;
  game.noises = [];
  game.phase = PHASE_PLAY;
  game.levelClearTimer = 0;
  setMessage(game, 'Back at the start. The guards have settled — go again, quieter.', 4);
}

// Move to the next level, or to the win screen after the last one.
// The caller (main.js) owns the run totals; this only flips the phase.
function onLevelClear(game) {
  game.events.push('clear');
  game.phase = PHASE_LEVEL_CLEAR;
  game.levelClearTimer = 0;
  if (game.levelIndex >= LEVELS.length - 1) {
    game.phase = PHASE_WIN;
  }
}
