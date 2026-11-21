// Night Ledger — tuning and shared constants.
// One file, one job: every number the rest of the game balances against lives here,
// so a balance change never means hunting through the simulation or the renderer.

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

// Player movement (pixels per second).
export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sneakSpeed: 88,
  // Walking is audible: a guard this close hears footsteps and grows suspicious.
  noiseRadius: 115,
  // A tossed coin flies this far at most, and its clink is heard this far.
  coinRange: 280,
  coinNoiseRadius: 230,
  coinsPerLevel: 3,
};

// Guard vision and behaviour.
export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  chaseSpeed: 148,
  searchSpeed: 95,
  // How far a guard can see, in pixels, and how wide the cone is (radians).
  viewRange: 265,
  viewAngle: Math.PI / 2.1,
  // Detection meter 0..100. Rates are per second while the player is visible.
  detectBase: 55,
  detectSneakFactor: 0.45,
  detectBushFactor: 0.3,
  detectCloseBonus: 55,
  detectCloseRange: 90,
  detectDecay: 26,
  // Meter at which a guard stops patrolling and comes to look ("?").
  suspectAt: 38,
  // Seconds a chasing guard keeps hunting after losing sight.
  loseSightSeconds: 2.5,
  // Seconds spent searching the last seen spot before giving up.
  searchSeconds: 4,
  // Touch distance while alerted: caught.
  catchDistance: 20,
  // Footstep sounds: a guard steps about this often while moving.
  stepInterval: 0.55,
};

// Lives, timing and scoring.
export const GAME = {
  lives: 3,
  // Pause after being caught before play resumes.
  caughtPauseSeconds: 1.6,
  // Ranks shown on the win screen, by times spotted across the whole run.
  rankGhostMaxSpotted: 0,
  rankShadowMaxSpotted: 3,
};
