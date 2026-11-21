// Night Ledger — guard brains: patrols, vision cones, suspicion and pursuit.
// One file, one job: given the world and the player, it decides what each guard
// sees, how sure it is, and where it walks. It never draws anything.

import { GUARD, TILE } from './config.js';
import { hasLineOfSight, isHidingAt, moveCircle } from './world.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';

// Build a guard from a level definition: {x, y, patrol: [[col,row],...], speed}.
export function createGuard(def) {
  const waypoints = def.patrol.map(([col, row]) => ({
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
  }));
  return {
    x: def.x * TILE + TILE / 2,
    y: def.y * TILE + TILE / 2,
    // Facing angle (radians). Starts facing along the first patrol leg.
    facing: Math.atan2(waypoints[0].y - def.y * TILE, waypoints[0].x - def.x * TILE) || 0,
    waypoints,
    waypointIndex: 0,
    speed: def.speed || GUARD.patrolSpeed,
    state: GUARD_PATROL,
    // Detection meter, 0..100. 100 means the guard is sure and gives chase.
    meter: 0,
    // Where the guard last saw (or heard) the player.
    lastSeen: null,
    loseSightTimer: 0,
    searchTimer: 0,
    investigateTarget: null,
    waitTimer: 0,
    // Footstep sound clock, read by the audio layer.
    stepTimer: 0,
    stepped: false,
    // How far this guard has walked this tick (for the footstep sound).
    movedDistance: 0,
  };
}

// Can this guard see the player right now? Range, cone angle and a clear line.
export function guardSeesPlayer(world, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.viewRange) return false;
  if (distance > 1) {
    const toPlayer = Math.atan2(dy, dx);
    let diff = toPlayer - guard.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > GUARD.viewAngle / 2) return false;
  }
  return hasLineOfSight(world, guard.x, guard.y, player.x, player.y);
}

// How fast the meter rises while the player is visible. Sneaking, hiding in a
// bush and distance all slow it down; standing close speeds it up. A player
// the guard cannot see at all does not raise the meter.
export function detectionRate(world, guard, player) {
  const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
  let rate = GUARD.detectBase * (1 - (distance / GUARD.viewRange) * 0.55);
  if (distance < GUARD.detectCloseRange) rate += GUARD.detectCloseBonus;
  if (player.sneaking) rate *= GUARD.detectSneakFactor;
  if (isHidingAt(world, player.x, player.y)) rate *= GUARD.detectBushFactor;
  return rate;
}

// A noise event (a tossed coin, loud footsteps): guards inside its radius turn
// to investigate the spot. Returns true when at least one guard heard it.
export function hearNoise(guards, x, y, radius) {
  let heard = false;
  for (const guard of guards) {
    if (guard.state === GUARD_CHASE) continue;
    if (Math.hypot(guard.x - x, guard.y - y) <= radius) {
      guard.investigateTarget = { x, y };
      if (guard.state === GUARD_PATROL) guard.state = GUARD_SUSPICIOUS;
      guard.meter = Math.max(guard.meter, GUARD.suspectAt);
      heard = true;
    }
  }
  return heard;
}

// Advance one guard by dt seconds. Returns an event string for the game log:
// 'spotted' when the guard becomes sure, 'lost' when it gives up the chase,
// 'caught' when it touches the player, or null.
export function stepGuard(world, guard, player, dt) {
  guard.stepped = false;
  guard.movedDistance = 0;
  const sees = guardSeesPlayer(world, guard, player);
  let event = null;

  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightTimer = 0;
    guard.meter += detectionRate(world, guard, player) * dt;
    if (guard.meter >= 100) {
      guard.meter = 100;
      if (guard.state !== GUARD_CHASE) {
        guard.state = GUARD_CHASE;
        event = 'spotted';
      }
    } else if (guard.meter >= GUARD.suspectAt && guard.state === GUARD_PATROL) {
      guard.state = GUARD_SUSPICIOUS;
    }
  } else {
    guard.meter = Math.max(0, guard.meter - GUARD.detectDecay * dt);
    if (guard.state === GUARD_CHASE) {
      guard.loseSightTimer += dt;
      if (guard.loseSightTimer >= GUARD.loseSightSeconds) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = 0;
        event = 'lost';
      }
    } else if (guard.meter < GUARD.suspectAt && guard.state === GUARD_SUSPICIOUS && guard.investigateTarget === null) {
      guard.state = GUARD_PATROL;
    }
  }

  // Walking feet are heard: a guard close by grows suspicious of a player who
  // walks (not sneaks) even without seeing them.
  if (!sees && player.moving && !player.sneaking && guard.state !== GUARD_CHASE) {
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance < 115) {
      guard.meter = Math.min(100, guard.meter + 14 * dt);
      if (guard.meter >= GUARD.suspectAt && guard.state === GUARD_PATROL) {
        guard.state = GUARD_SUSPICIOUS;
        guard.investigateTarget = { x: player.x, y: player.y };
      }
    }
  }

  // Move according to state.
  if (guard.state === GUARD_CHASE && guard.lastSeen !== null) {
    moveToward(world, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.chaseSpeed, dt);
    faceToward(guard, guard.lastSeen.x, guard.lastSeen.y, dt);
  } else if (guard.state === GUARD_SEARCH && guard.lastSeen !== null) {
    guard.searchTimer += dt;
    if (guard.searchTimer < GUARD.searchSeconds) {
      moveToward(world, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed, dt);
      faceToward(guard, guard.lastSeen.x, guard.lastSeen.y, dt);
    } else {
      guard.state = GUARD_PATROL;
      guard.meter = Math.max(guard.meter, GUARD.suspectAt);
      guard.investigateTarget = null;
      guard.lastSeen = null;
    }
  } else if (guard.state === GUARD_SUSPICIOUS && guard.investigateTarget !== null) {
    const reached = moveToward(world, guard, guard.investigateTarget.x, guard.investigateTarget.y, GUARD.searchSpeed, dt);
    faceToward(guard, guard.investigateTarget.x, guard.investigateTarget.y, dt);
    if (reached) {
      guard.waitTimer += dt;
      guard.facing += dt * 1.6;
      if (guard.waitTimer > 1.6) {
        guard.investigateTarget = null;
        guard.waitTimer = 0;
        guard.state = GUARD_PATROL;
      }
    }
  } else {
    patrolStep(world, guard, dt);
  }

  // Footstep clock: the audio layer plays one tick per step while moving.
  if (guard.movedDistance > 0) {
    guard.stepTimer += dt;
    if (guard.stepTimer >= GUARD.stepInterval) {
      guard.stepTimer = 0;
      guard.stepped = true;
    }
  }

  // Caught: an alerted guard that touches the player ends the attempt.
  if (guard.state === GUARD_CHASE) {
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance < GUARD.catchDistance + 4) event = 'caught';
  }
  return event;
}

function patrolStep(world, guard, dt) {
  const target = guard.waypoints[guard.waypointIndex];
  if (!target) return;
  const reached = moveToward(world, guard, target.x, target.y, guard.speed, dt);
  faceToward(guard, target.x, target.y, dt);
  if (reached) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    // Brief pause at each waypoint, so the patrol reads as a person, not a rail.
    guard.waitTimer = 0;
  }
}

// Walk toward (x, y) at `speed`, sliding along walls. Returns true on arrival.
function moveToward(world, guard, x, y, speed, dt) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) return true;
  const step = Math.min(distance, speed * dt);
  const next = moveCircle(world, guard.x, guard.y, GUARD.radius, (dx / distance) * step, (dy / distance) * step);
  guard.movedDistance = Math.hypot(next.x - guard.x, next.y - guard.y);
  guard.x = next.x;
  guard.y = next.y;
  return distance - step < 6;
}

// Turn the facing angle toward (x, y), at most 5 radians per second.
function faceToward(guard, x, y, dt) {
  const wanted = Math.atan2(y - guard.y, x - guard.x);
  let diff = wanted - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-5 * dt, Math.min(5 * dt, diff));
  guard.facing += turn;
}
