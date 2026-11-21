// Night Ledger — a small seeded random generator (mulberry32).
// One file, one job: deterministic randomness for the screenshot autopilot and
// for anything else that must replay the same way from the same seed.

export function makeRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max) from a seeded generator.
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

// Shuffle a copy of an array with a seeded generator (Fisher-Yates).
export function shuffle(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
