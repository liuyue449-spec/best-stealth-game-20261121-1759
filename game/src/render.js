// Night Ledger — everything you see: the floor, the cones, the figures.
// One file, one job: it draws one game state onto a canvas. It never moves
// anything and never decides anything; the simulation owns all of that.

import { COLS, GUARD, ROWS, TILE, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { castSightRay, isHidingAt } from './world.js';
import { GUARD_CHASE, GUARD_SUSPICIOUS } from './guards.js';

const FLOOR_A = '#20242e';
const FLOOR_B = '#232834';
const WALL_TOP = '#4a5468';
const WALL_FACE = '#2c3342';
const CRATE = '#6b5433';
const CRATE_EDGE = '#8a6f45';
const BUSH = '#1e4632';
const BUSH_LEAF = '#2c5d40';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function drawGame(renderer, game, time) {
  const { ctx } = renderer;
  const world = game.world;
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawFloor(ctx, world, time);
  drawExit(ctx, world, game);
  drawSeals(ctx, world, time);
  drawNoises(ctx, game);
  for (const guard of game.guards) drawVisionCone(ctx, world, guard);
  drawPlayer(ctx, game, time);
  for (const guard of game.guards) drawGuard(ctx, guard, time);
  drawCoin(ctx, game);
  drawVignette(ctx);
}

function drawFloor(ctx, world, time) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      const cell = world.map[row][col];
      if (cell === '#') {
        ctx.fillStyle = WALL_FACE;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(x, y, TILE, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y + 7, TILE, 2);
      } else if (cell === 'C') {
        ctx.fillStyle = '#1b1e26';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = CRATE;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = CRATE_EDGE;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = (col + row) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(x, y, TILE, TILE);
        if (cell === 'B') {
          ctx.fillStyle = BUSH;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = BUSH_LEAF;
          for (const [ox, oy, r] of [[10, 12, 9], [26, 10, 10], [18, 26, 10], [30, 28, 8]]) {
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
  void time;
}

function drawExit(ctx, world, game) {
  const exit = world.exit;
  const open = game.sealsTaken >= world.sealTotal;
  const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 280);
  ctx.save();
  ctx.globalAlpha = open ? pulse : 0.45;
  ctx.fillStyle = open ? '#2fae5f' : '#8a2f2f';
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = open ? '#7be3a2' : '#c96a6a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 26, 0, Math.PI * 2);
  ctx.stroke();
  // Door posts.
  ctx.fillStyle = open ? '#b8ffd0' : '#e0a0a0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x, exit.y);
}

function drawSeals(ctx, world, time) {
  for (const seal of world.seals) {
    if (seal.taken) continue;
    const bob = Math.sin(time * 2.2 + seal.col) * 3;
    const glow = 0.5 + 0.3 * Math.sin(time * 3 + seal.row);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(seal.x, seal.y + bob, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The ledger: a small gold book with pages.
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(seal.x - 9, seal.y - 7 + bob, 18, 14);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(seal.x - 6, seal.y - 4 + bob, 12, 8);
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(seal.x - 9, seal.y - 7 + bob, 18, 14);
    ctx.beginPath();
    ctx.moveTo(seal.x - 3, seal.y - 1 + bob);
    ctx.lineTo(seal.x + 3, seal.y - 1 + bob);
    ctx.moveTo(seal.x - 3, seal.y + 2 + bob);
    ctx.lineTo(seal.x + 3, seal.y + 2 + bob);
    ctx.stroke();
  }
}

function drawNoises(ctx, game) {
  for (const noise of game.noises) {
    const progress = noise.age / 0.9;
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - progress);
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(noise.x, noise.y, 12 + progress * noise.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// A guard's vision cone, clipped by walls: rays fan across the cone and stop
// at the first sight-blocking tile, so the cone hugs corners like sight does.
function drawVisionCone(ctx, world, guard) {
  const rays = 26;
  const half = GUARD.viewAngle / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - half + (i / rays) * GUARD.viewAngle;
    const distance = castSightRay(world, guard.x, guard.y, angle, GUARD.viewRange);
    ctx.lineTo(guard.x + Math.cos(angle) * distance, guard.y + Math.sin(angle) * distance);
  }
  ctx.closePath();
  const alerted = guard.state === GUARD_CHASE;
  const suspicious = guard.state === GUARD_SUSPICIOUS;
  ctx.fillStyle = alerted
    ? 'rgba(224, 62, 62, 0.30)'
    : suspicious
      ? 'rgba(240, 178, 58, 0.24)'
      : 'rgba(240, 214, 110, 0.16)';
  ctx.fill();
  ctx.strokeStyle = alerted ? 'rgba(224, 62, 62, 0.5)' : 'rgba(240, 214, 110, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawGuard(ctx, guard, time) {
  const alerted = guard.state === GUARD_CHASE;
  const suspicious = guard.state === GUARD_SUSPICIOUS;
  // Body: a dark uniform with a coloured trim that says the state at a glance.
  ctx.fillStyle = '#3a3f4d';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alerted ? '#e03e3e' : suspicious ? '#f0b23a' : '#c8ccd8';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Facing tick and helmet brim.
  ctx.strokeStyle = '#e8eaf0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
  ctx.stroke();
  ctx.fillStyle = '#565e73';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
  ctx.fill();
  // "?" while suspicious, "!" while chasing, with a detection ring.
  if (guard.meter > 2) {
    const ratio = guard.meter / 100;
    ctx.strokeStyle = alerted ? '#e03e3e' : '#f0b23a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius + 6, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
    ctx.stroke();
  }
  if (alerted || suspicious) {
    ctx.fillStyle = alerted ? '#ff5b5b' : '#ffd76a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - GUARD.radius - 8);
  }
  void time;
}

function drawPlayer(ctx, game, time) {
  const player = game.player;
  const hidden = isHidingAt(game.world, player.x, player.y);
  const bob = player.moving ? Math.sin(time * 14) * 1.5 : 0;
  // Shadow ring while sneaking: the stance reads even at a glance.
  if (player.sneaking) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#7be3a2';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (hidden) ctx.globalAlpha = 0.72;
  // Hooded figure: dark cloak, pale face, a small lamp-green trim.
  ctx.fillStyle = '#1d2b4a';
  ctx.beginPath();
  ctx.arc(player.x, player.y + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7be3a2';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.facing) * 4, player.y + Math.sin(player.facing) * 4 + bob, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Aim hint for the coin toss: a faint line toward the mouse while a coin is held.
  void time;
}

function drawCoin(ctx, game) {
  const coin = game.player.coin;
  if (coin === null) return;
  const t = Math.min(1, coin.t);
  const x = coin.fromX + (coin.toX - coin.fromX) * t;
  const y = coin.fromY + (coin.toY - coin.fromY) * t - Math.sin(t * Math.PI) * 26;
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6d1f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// A soft dark edge, so the lit middle reads as a night hall.
function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.42,
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_HEIGHT * 0.95,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

// Draw the title backdrop: the first level, idle, behind the title overlay.
export function drawTitleBackdrop(renderer, game, time) {
  drawGame(renderer, game, time);
  ctxDim(renderer);
}

function ctxDim(renderer) {
  const { ctx } = renderer;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}
