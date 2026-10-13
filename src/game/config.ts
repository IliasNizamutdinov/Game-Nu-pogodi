/**
 * Tuning values for Nu, Pogodi! — Wolf and Eggs.
 * Gameplay code reads these constants so speed and timers can be adjusted
 * without rewriting the rules.
 *
 * Hare timings are a playable approximation. They are not a claim that the
 * original pocket game used these exact intervals.
 */
export const SPEED = {
  /** Path fraction per second at 0 points on the first cycle (~5.6s per egg). */
  initial: 0.18,
  /** Added for every point scored inside the current hundred. */
  perPoint: 0.00105,
  /**
   * Added for each completed hundred inside the cycle.
   * Kept smaller than 100 * perPoint so speed dips at 100, 200, ... without
   * falling back to the original value.
   */
  perHundred: 0.028,
  /**
   * Added after each 999 → 0 rollover.
   * Must stay below the speed gained across a full cycle so the new cycle
   * starts a little slower than 999, but still far above the first-cycle start.
   */
  perCycle: 0.2,
  /** Safety cap so later cycles stay readable instead of becoming instant. */
  max: 0.92,
} as const;

export const SPAWN = {
  baseInterval: 2.35,
  minInterval: 0.68,
  maxMoving: 4,
  /** Do not drop another egg on a lane that still has one in this leading fraction. */
  minGap: 0.34,
  firstEggDelay: 0.48,
} as const;

export const HARE = {
  hiddenSeconds: 9,
  visibleSeconds: 3.2,
} as const;

export const PENALTY = {
  /** Stored in half-points so 0.5 never depends on binary floats. */
  halvesPerMiss: 2,
  halvesPerMissWithHare: 1,
  /** 6 halves = 3 penalty points, which ends the run. */
  gameOverHalves: 6,
} as const;

export const SCORE = {
  maxDisplay: 999,
  resetThresholds: [200, 500],
} as const;

export const ANIM = {
  catch: 0.38,
  miss: 0.7,
  missWithChick: 1.05,
  /** Exponential follow rate for the wolf sprite. Catch logic does not wait for it. */
  wolfLerp: 16,
  catchPulse: 0.34,
  notice: 1.7,
  lay: 0.28,
} as const;

export const INPUT = {
  longPressMs: 480,
  dragCancelPx: 18,
  /** Ignore stalled frames so a backgrounded tab cannot dump a pile of eggs. */
  maxFrameDt: 0.05,
} as const;
