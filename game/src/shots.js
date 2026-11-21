// Night Ledger — the screenshot scenes behind ?shot=start|play|end.
// One file, one job: each scene plays the real rules forward from a fresh level
// for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like — and the same seed always gives the same
// frame. Nothing here is a mock: it is the same simulation the player plays.

import { COLS, GUARD, ROWS, TILE } from './config.js';
import { findPath } from './world.js';
import { createGame, stepGame, PHASE_PLAY } from './simulate.js';
import { GUARD_CHASE } from './guards.js';

const STEP = 1 / 60;
const START_SECONDS = 3;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 180;

// Tiles a guard can currently see: the autopilot treats them as expensive, so
// it prefers routes through shadow and behind cover.
function dangerTiles(game) {
  const danger = new Set();
  for (const guard of game.guards) {
    const gx = guard.x;
    const gy = guard.y;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE + TILE / 2;
        const y = row * TILE + TILE / 2;
        const dx = x - gx;
        const dy = y - gy;
        if (Math.hypot(dx, dy) > GUARD.viewRange) continue;
        const toTile = Math.atan2(dy, dx);
        let diff = toTile - guard.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > GUARD.viewAngle / 2) continue;
        danger.add(`${col},${row}`);
      }
    }
  }
  return danger;
}

// A path that avoids danger tiles where it can. Falls back to the plain
// shortest path when no safe route exists.
function safePath(game, fromCol, fromRow, toCol, toRow) {
  const world = game.world;
  const danger = dangerTiles(game);
  const key = (c, r) => `${c},${r}`;
  const cameFrom = new Map();
  const queue = [[fromCol, fromRow]];
  cameFrom.set(key(fromCol, fromRow), null);
  let head = 0;
  while (head < queue.length) {
    const [c, r] = queue[head];
    head += 1;
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = [c, r];
      while (cur !== null) {
        path.push(cur);
        cur = cameFrom.get(key(cur[0], cur[1]));
      }
      return path.reverse();
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= 32 || nr < 0 || nr >= 18 || world.solid[nr][nc]) continue;
      if (cameFrom.has(key(nc, nr))) continue;
      if (danger.has(key(nc, nr)) && !(nc === toCol && nr === toRow)) continue;
      cameFrom.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  return findPath(world, fromCol, fromRow, toCol, toRow);
}

// Steer the player along a tile path. Sneak while any guard is close.
function autopilotInput(game, path) {
  const input = { up: false, down: false, left: false, right: false, sneak: false, toss: false };
  if (!path || path.length < 2) return input;
  const [col, row] = path[1];
  const targetX = col * TILE + TILE / 2;
  const targetY = row * TILE + TILE / 2;
  const dx = targetX - game.player.x;
  const dy = targetY - game.player.y;
  if (Math.abs(dx) > 6) input[dx > 0 ? 'right' : 'left'] = true;
  if (Math.abs(dy) > 6) input[dy > 0 ? 'down' : 'up'] = true;
  let nearestGuard = Infinity;
  for (const guard of game.guards) {
    nearestGuard = Math.min(nearestGuard, Math.hypot(guard.x - game.player.x, guard.y - game.player.y));
  }
  input.sneak = nearestGuard < 240 || game.guards.some((g) => g.state === GUARD_CHASE);
  return input;
}

// Play forward until `seconds` pass (or the level ends). Returns the game.
function playForward(game, seconds, levelIndex) {
  let path = null;
  let replanIn = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.phase !== PHASE_PLAY) break;
    replanIn -= STEP;
    if (replanIn <= 0 || path === null || path.length < 2) {
      replanIn = 0.5;
      const fromCol = Math.floor(game.player.x / TILE);
      const fromRow = Math.floor(game.player.y / TILE);
      let target = null;
      const remaining = game.world.seals.find((seal) => !seal.taken);
      if (remaining) target = remaining;
      else if (game.sealsTaken >= game.world.sealTotal) target = game.world.exit;
      if (target) path = safePath(game, fromCol, fromRow, target.col, target.row);
    }
    const input = autopilotInput(game, path);
    stepGame(game, input, STEP);
    // Drop the reached waypoint so the path keeps advancing.
    if (path && path.length >= 2) {
      const [col, row] = path[1];
      if (Math.hypot(col * TILE + TILE / 2 - game.player.x, row * TILE + TILE / 2 - game.player.y) < 10) {
        path = path.slice(1);
      }
    }
  }
  void levelIndex;
  return game;
}

// Run one named scene and return the finished game state for the renderer.
//   start: the level just opened, guards mid-patrol, player at the door.
//   play:  mid-level, seals half taken, a guard turning suspicious.
//   end:   the level played to its clear screen (or as far as it gets).
export function runScene(name, levelIndex = 0) {
  const game = createGame(levelIndex);
  if (name === 'start') {
    return playForward(game, START_SECONDS, levelIndex);
  }
  if (name === 'play') {
    return playForward(game, PLAY_SECONDS, levelIndex);
  }
  if (name === 'end') {
    const played = playForward(game, END_LIMIT_SECONDS, levelIndex);
    return played;
  }
  return game;
}
