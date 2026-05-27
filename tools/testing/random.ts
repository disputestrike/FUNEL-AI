/**
 * Deterministic RNG (mulberry32). Used so the regression suite catches drift
 * across runs. Tests should never call Math.random directly when output is
 * fed into a snapshot assertion.
 */
let state = 0x12345678 >>> 0;

export function seedRandom(seed: number): void {
  state = seed >>> 0;
  const orig = Math.random;
  Math.random = () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Allow tests to restore.
  (Math.random as { _orig?: () => number })._orig = orig;
}

export function nextInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[nextInt(arr.length)]!;
}
