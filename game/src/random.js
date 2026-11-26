// Gale Strip — a small deterministic seeded random number generator.
// Every strip's terrain, gusts and cloud layout comes from one seed, so a
// screenshot taken with ?seed=N always shows the same world.
export function createSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  // mulberry32: cheap, stable across engines, good enough for terrain.
  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1-D value noise: a deterministic wobble for ridges and gusts.
export function makeValueNoise(seed) {
  const random = createSeededRandom(seed);
  const knots = [];
  for (let i = 0; i < 64; i += 1) knots.push(random() * 2 - 1);
  return function valueNoise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = knots[((xi % 64) + 64) % 64];
    const b = knots[(((xi + 1) % 64) + 64) % 64];
    const smooth = xf * xf * (3 - 2 * xf);
    return a + (b - a) * smooth;
  };
}
