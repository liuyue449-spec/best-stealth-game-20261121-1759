// Night Ledger — the level world: map parsing, collision and line of sight.
// One file, one job: it knows what is solid, what blocks sight, and whether two
// points can see each other. It never decides what a guard does with that.

import { COLS, ROWS, TILE } from './config.js';

export const TILE_WALL = '#';
export const TILE_CRATE = 'C';
export const TILE_BUSH = 'B';
export const TILE_SEAL = 'S';
export const TILE_EXIT = 'E';
export const TILE_START = 'P';
export const TILE_FLOOR = '.';

// Parse one level definition into a world. Throws on a malformed map so a bad
// level fails loudly at load time instead of silently at play time.
export function parseWorld(level, levelIndex) {
  const map = level.map;
  if (map.length !== ROWS) {
    throw new Error(`level ${levelIndex}: expected ${ROWS} rows, got ${map.length}`);
  }
  const solid = [];
  const blocksSight = [];
  const bush = [];
  const seals = [];
  let exit = null;
  let start = null;
  for (let row = 0; row < ROWS; row += 1) {
    if (map[row].length !== COLS) {
      throw new Error(`level ${levelIndex} row ${row}: expected ${COLS} columns, got ${map[row].length}`);
    }
    solid.push(new Array(COLS).fill(false));
    blocksSight.push(new Array(COLS).fill(false));
    bush.push(new Array(COLS).fill(false));
    for (let col = 0; col < COLS; col += 1) {
      const cell = map[row][col];
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      if (cell === TILE_WALL || cell === TILE_CRATE) {
        solid[row][col] = true;
        blocksSight[row][col] = true;
      } else if (cell === TILE_BUSH) {
        bush[row][col] = true;
      } else if (cell === TILE_SEAL) {
        seals.push({ x: cx, y: cy, col, row, taken: false });
      } else if (cell === TILE_EXIT) {
        if (exit !== null) throw new Error(`level ${levelIndex}: two exits`);
        exit = { x: cx, y: cy, col, row };
      } else if (cell === TILE_START) {
        if (start !== null) throw new Error(`level ${levelIndex}: two starts`);
        start = { x: cx, y: cy, col, row };
      } else if (cell !== TILE_FLOOR) {
        throw new Error(`level ${levelIndex} row ${row} col ${col}: unknown tile '${cell}'`);
      }
    }
  }
  if (start === null) throw new Error(`level ${levelIndex}: no player start`);
  if (exit === null) throw new Error(`level ${levelIndex}: no exit`);
  if (seals.length === 0) throw new Error(`level ${levelIndex}: no seals`);
  return { levelIndex, name: level.name, brief: level.brief, map: level.map, solid, blocksSight, bush, seals, exit, start, sealTotal: seals.length };
}

export function tileAt(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return TILE_WALL;
  if (world.solid[row][col]) return TILE_WALL;
  if (world.bush[row][col]) return TILE_BUSH;
  return TILE_FLOOR;
}

// True when the tile is solid (a wall or a crate). Out of bounds counts as solid.
export function isSolid(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return world.solid[row][col];
}

// True when the tile blocks a guard's sight (walls and crates, not bushes).
export function blocksSightAt(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return world.blocksSight[row][col];
}

// True when the point stands in a bush (deep shadow): guards spot the player slower.
export function isHidingAt(world, x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return world.bush[row][col];
}

// Move a circle (x, y, radius) by (dx, dy), sliding along solid tiles.
// Returns the new position; the circle never ends up inside a wall.
export function moveCircle(world, x, y, radius, dx, dy) {
  let nextX = x + dx;
  let nextY = y + dy;
  if (circleHitsSolid(world, nextX, y, radius)) nextX = x;
  if (circleHitsSolid(world, nextX, nextY, radius)) nextY = y;
  return { x: nextX, y: nextY };
}

function circleHitsSolid(world, x, y, radius) {
  const col0 = Math.floor((x - radius) / TILE);
  const col1 = Math.floor((x + radius) / TILE);
  const row0 = Math.floor((y - radius) / TILE);
  const row1 = Math.floor((y + radius) / TILE);
  for (let row = row0; row <= row1; row += 1) {
    for (let col = col0; col <= col1; col += 1) {
      if (!isSolid(world, col, row)) continue;
      const nearestX = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const nearestY = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const ox = x - nearestX;
      const oy = y - nearestY;
      if (ox * ox + oy * oy < radius * radius) return true;
    }
  }
  return false;
}

// Line of sight between two points, sampled finely enough that no wall is jumped.
export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const col = Math.floor((x0 + dx * t) / TILE);
    const row = Math.floor((y0 + dy * t) / TILE);
    if (blocksSightAt(world, col, row)) return false;
  }
  return true;
}

// Cast one sight ray from (x, y) along `angle`, up to `maxDistance`.
// Returns how far it travels before a sight-blocking tile (or the max).
export function castSightRay(world, x, y, angle, maxDistance) {
  const step = 6;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  let travelled = 0;
  while (travelled < maxDistance) {
    px += dx;
    py += dy;
    travelled += step;
    if (blocksSightAt(world, Math.floor(px / TILE), Math.floor(py / TILE))) return travelled;
  }
  return maxDistance;
}

// Breadth-first walkable distance between two tile cells, ignoring guards.
// Returns Infinity when there is no path. Used by the autopilot and the tests.
export function pathDistance(world, fromCol, fromRow, toCol, toRow) {
  const path = findPath(world, fromCol, fromRow, toCol, toRow);
  return path === null ? Infinity : path.length - 1;
}

// Shortest walkable path between two tiles (4-directional). Returns a list of
// [col, row] cells including both ends, or null when unreachable.
export function findPath(world, fromCol, fromRow, toCol, toRow) {
  if (isSolid(world, toCol, toRow) || isSolid(world, fromCol, fromRow)) return null;
  const key = (c, r) => r * COLS + c;
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
      if (isSolid(world, nc, nr) || cameFrom.has(key(nc, nr))) continue;
      cameFrom.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}
