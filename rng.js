/**
 * Seeded pseudo-random number generator (mulberry32).
 * Every plant stores an integer seed; re-running the generator
 * with the same seed always reproduces the same plant, which is
 * what lets us regrow a consistent plant stage-by-stage and
 * also perfectly re-render saved plants from the garden gallery.
 */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Wraps mulberry32 with convenience helpers used throughout plant generation. */
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this._rand = mulberry32(seed);
  }
  next() { return this._rand(); }
  range(min, max) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.chance(0.5) ? 1 : -1; }
}
