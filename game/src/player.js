// Night Ledger — the player: movement, sneaking and the tossed coin.
// One file, one job: it turns key and mouse input into a position, a stance and
// the occasional coin. It never decides what a guard thinks of any of that.

import { PLAYER, TILE } from './config.js';
import { moveCircle } from './world.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    // Facing angle, for drawing the figure and for the coin's throw direction.
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    coins: PLAYER.coinsPerLevel,
    coinCooldown: 0,
    // A coin in flight, or null: {x, y, fromX, fromY, toX, toY, t}.
    coin: null,
    // Footstep clock, read by the audio layer.
    stepTimer: 0,
    stepped: false,
  };
}

// Advance the player one tick from the current input.
// Input shape: {up, down, left, right, sneak, tossX, tossY, toss} — see input.js.
export function stepPlayer(world, player, input, dt) {
  player.stepped = false;
  player.moving = false;
  if (player.coinCooldown > 0) player.coinCooldown -= dt;

  // A coin in flight keeps flying; it lands after 0.35 s and the caller (the
  // simulation) turns the landing into a noise event.
  if (player.coin !== null) {
    player.coin.t += dt / 0.35;
    if (player.coin.t >= 1) {
      player.coin.x = player.coin.toX;
      player.coin.y = player.coin.toY;
    }
  }

  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx === 0 && my === 0) return;
  const length = Math.hypot(mx, my);
  mx /= length;
  my /= length;
  player.sneaking = Boolean(input.sneak);
  player.moving = true;
  player.facing = Math.atan2(my, mx);
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const next = moveCircle(world, player.x, player.y, PLAYER.radius, mx * speed * dt, my * speed * dt);
  player.x = next.x;
  player.y = next.y;

  player.stepTimer += dt;
  const interval = player.sneaking ? 0.62 : 0.42;
  if (player.stepTimer >= interval) {
    player.stepTimer = 0;
    player.stepped = true;
  }
}

// Start a coin toss toward (x, y), clamped to the coin's range.
// Returns the landing point, or null when there is no coin to throw.
export function tossCoin(player, x, y) {
  if (player.coins <= 0 || player.coinCooldown > 0 || player.coin !== null) return null;
  const dx = x - player.x;
  const dy = y - player.y;
  const distance = Math.hypot(dx, dy);
  const clamped = Math.min(distance, PLAYER.coinRange);
  const toX = distance === 0 ? player.x : player.x + (dx / distance) * clamped;
  const toY = distance === 0 ? player.y : player.y + (dy / distance) * clamped;
  player.coins -= 1;
  player.coinCooldown = 1;
  player.coin = { x: player.x, y: player.y, fromX: player.x, fromY: player.y, toX, toY, t: 0 };
  return { x: toX, y: toY };
}

// Tile coordinates of the player, for the autopilot's pathfinding.
export function playerTile(player) {
  return { col: Math.floor(player.x / TILE), row: Math.floor(player.y / TILE) };
}
