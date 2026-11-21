// Night Ledger — the browser shell: screens, the loop, the HUD.
// One file, one job: it owns the animation frame, the overlays and the wiring
// between input, simulation, sound and the renderer. The rules live elsewhere.

import { VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { LEVELS } from './levels.js';
import { createGame, stepGame, alarmLevel, isBeingChased, PHASE_PLAY, PHASE_CAUGHT, PHASE_LEVEL_CLEAR, PHASE_GAME_OVER, PHASE_WIN } from './simulate.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, drawGame, drawTitleBackdrop } from './render.js';
import { runScene } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

const $ = (id) => document.getElementById(id);
const hud = {
  level: $('hud-level'),
  seals: $('hud-seals'),
  coins: $('hud-coins'),
  lives: $('hud-lives'),
  time: $('hud-time'),
  eye: $('hud-eye'),
  message: $('hud-message'),
};
const overlays = {
  title: $('overlay-title'),
  clear: $('overlay-clear'),
  over: $('overlay-over'),
  win: $('overlay-win'),
};

let screen = 'title';
let game = createGame(0);
// Run totals, carried across levels.
const run = { lives: 3, spotted: 0, timeSeconds: 0 };
let clearTimer = 0;
let lastTimestamp = 0;
let elapsed = 0;

function showOverlay(which) {
  for (const key of Object.keys(overlays)) {
    overlays[key].classList.toggle('hidden', key !== which);
  }
  if (which === null) {
    for (const key of Object.keys(overlays)) overlays[key].classList.add('hidden');
  }
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function rankFor(spotted) {
  if (spotted === 0) return 'GHOST — never spotted once';
  if (spotted <= 3) return 'SHADOW — barely a whisper';
  return 'OPERATIVE — loud, but alive';
}

function updateHud() {
  hud.level.textContent = `Level ${game.levelIndex + 1} of ${LEVELS.length} · ${game.world.name}`;
  hud.seals.textContent = `Seals ${game.sealsTaken}/${game.world.sealTotal}`;
  hud.coins.textContent = `Coins ${game.player.coins}`;
  hud.lives.textContent = `♥`.repeat(Math.max(0, game.lives)) + `♡`.repeat(Math.max(0, 3 - game.lives));
  hud.time.textContent = formatTime(game.timeSeconds);
  const alarm = alarmLevel(game);
  const chased = isBeingChased(game);
  hud.eye.textContent = chased ? '👁 ALARM' : alarm >= 38 ? '👁 Suspicious' : alarm > 2 ? '👁 Noticed' : '👁 Hidden';
  hud.eye.className = chased ? 'eye alarm' : alarm >= 38 ? 'eye suspicious' : 'eye';
  hud.message.textContent = game.message;
  hud.message.style.opacity = game.messageTimer > 0 ? '1' : '0.55';
}

function startRun() {
  audio.ensure();
  run.lives = 3;
  run.spotted = 0;
  run.timeSeconds = 0;
  game = createGame(0);
  screen = 'play';
  showOverlay(null);
}

function advanceLevel() {
  run.lives = game.lives;
  run.spotted = game.runSpottedCount;
  run.timeSeconds = game.timeSeconds;
  const next = createGame(game.levelIndex + 1);
  next.lives = run.lives;
  next.runSpottedCount = run.spotted;
  next.timeSeconds = run.timeSeconds;
  game = next;
  screen = 'play';
  showOverlay(null);
}

function showWin() {
  $('win-time').textContent = formatTime(game.timeSeconds);
  $('win-spotted').textContent = String(game.runSpottedCount);
  $('win-rank').textContent = rankFor(game.runSpottedCount);
  screen = 'win';
  showOverlay('win');
  audio.win();
}

function showGameOver() {
  $('over-level').textContent = `Level ${game.levelIndex + 1} · ${game.world.name}`;
  screen = 'over';
  showOverlay('over');
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0);
  lastTimestamp = timestamp;
  elapsed += dt;

  // A screenshot scene (?shot=start|play|end) renders one frozen frame of the
  // real game and stops: the shot is a render of the game's own code.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot !== null) {
    if (screen !== 'shot') {
      const scene = runScene(shot, Number(params.get('level') || 0));
      game = scene;
      screen = 'shot';
      showOverlay(null);
      // The HUD stays visible: it shows the level, seals, lives and timer,
      // so the shot reads as a complete game, not just a bare board.
      updateHud();
    }
    drawGame(renderer, game, elapsed);
    if (game.phase === 'level-clear' || game.phase === 'win') drawLevelClearBanner();
    return;
  }

  if (screen === 'title') {
    drawTitleBackdrop(renderer, game, elapsed);
    return;
  }
  if (screen === 'play') {
    input.sync();
    const tossed = input.consumeToss();
    const frameInput = {
      up: input.input.up,
      down: input.input.down,
      left: input.input.left,
      right: input.input.right,
      sneak: input.input.sneak,
      toss: tossed,
      tossX: input.input.tossX,
      tossY: input.input.tossY,
    };
    stepGame(game, frameInput, dt);
    playSounds(game);
    updateHud();
    drawGame(renderer, game, elapsed);
    if (game.phase === PHASE_CAUGHT) {
      // The simulation holds the frame during the caught pause.
    } else if (game.phase === PHASE_LEVEL_CLEAR) {
      clearTimer += dt;
      drawLevelClearBanner();
      if (clearTimer > 2.6) {
        clearTimer = 0;
        advanceLevel();
      }
    } else if (game.phase === PHASE_WIN) {
      showWin();
    } else if (game.phase === PHASE_GAME_OVER) {
      showGameOver();
    }
    return;
  }
  if (screen === 'win' || screen === 'over') {
    drawGame(renderer, game, elapsed);
    return;
  }
  if (screen === 'shot') {
    drawGame(renderer, game, elapsed);
  }
}

function drawLevelClearBanner() {
  const ctx = renderer.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
  ctx.fillRect(0, VIEW_HEIGHT / 2 - 64, VIEW_WIDTH, 128);
  ctx.fillStyle = '#7be3a2';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL CLEAR', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 18);
  ctx.fillStyle = '#e8eaf0';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(
    `Seals ${game.sealsTaken}/${game.world.sealTotal} · Spotted ${game.spottedCount} times · ${formatTime(game.timeSeconds)}`,
    VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 26,
  );
  ctx.restore();
}

function playSounds(gameState) {
  for (const event of gameState.events) {
    if (event === 'spotted') audio.spotted();
    else if (event === 'seal') audio.seal();
    else if (event === 'caught') audio.caught();
    else if (event === 'clear') audio.levelClear();
    else if (event === 'coin-throw') audio.coinThrow();
    else if (event === 'coin-land') audio.coinLand();
    else if (event === 'exit-locked') audio.locked();
  }
  if (gameState.player.stepped) audio.playerStep(gameState.player.sneaking);
  for (const guard of gameState.guards) {
    if (guard.stepped) {
      const distance = Math.hypot(guard.x - gameState.player.x, guard.y - gameState.player.y);
      audio.guardStep(distance);
    }
  }
}

// Buttons and keys.
$('btn-start').addEventListener('click', startRun);
$('btn-again').addEventListener('click', startRun);
$('btn-retry').addEventListener('click', startRun);
$('btn-sound').addEventListener('click', () => {
  audio.ensure();
  const muted = audio.toggleMute();
  $('btn-sound').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
});
$('btn-restart').addEventListener('click', () => {
  if (screen === 'play') startRun();
});
window.addEventListener('keydown', (event) => {
  audio.ensure();
  if (event.code === 'Enter' && (screen === 'title' || screen === 'over' || screen === 'win')) startRun();
  if (event.code === 'KeyR' && (screen === 'over' || screen === 'win' || screen === 'play')) startRun();
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute();
    $('btn-sound').textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  }
});

// A read-only handle for automated tests (and nothing else): the live game
// state, so a headless browser can check that keys really move the player.
window.__nightLedger = { get game() { return game; }, get screen() { return screen; } };

// Title screen shows the first level idling behind the overlay.
showOverlay('title');
requestAnimationFrame(frame);
