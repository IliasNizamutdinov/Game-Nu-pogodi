/**
 * Tuning values for Nu, Pogodi! — Wolf and Eggs.
 * Gameplay code reads these constants so speed and timers can be adjusted
 * without rewriting the rules.
 *
 * Hare timings are a playable approximation. They are not a claim that the
 * original pocket game used these exact intervals.
 */
export const SPEED = {
  /** Path fraction per second at 0 points. About 8 seconds for the first egg. */
  initial: 0.12,
  /** Small step so speed climbs gradually inside each hundred. */
  perPoint: 0.00035,
  /**
   * Added for each completed hundred.
   * Smaller than 100 * perPoint, so each hundred still dips a little.
   */
  perHundred: 0.01,
  /**
   * Added after each 999 → 0 rollover.
   * Below a full cycle of gains, and still well above the opening speed.
   */
  perCycle: 0.12,
  /** Late-game ceiling. An egg still takes a little over 2 seconds. */
  max: 0.42,
} as const;

export const SPAWN = {
  baseInterval: 2.2,
  minInterval: 1.35,
  maxMoving: 4,
  /** Do not drop another egg on a lane that still has one in this leading fraction. */
  minGap: 0.4,
  firstEggDelay: 0.55,
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
  explode: 0.7,
  /** Exponential follow rate for the wolf sprite. Catch logic does not wait for it. */
  wolfLerp: 16,
  catchPulse: 0.34,
  notice: 1.7,
  lay: 0.28,
} as const;

export const DIFFICULTY = {
  low: 1,
  medium: 1.45,
  high: 2.05,
} as const;

export const GRENADE = {
  /** Chance that a new object is a grenade. Missing it is safe; catching it is not. */
  chance: { low: 0.1, medium: 0.14, high: 0.18 },
} as const;

export const INPUT = {
  longPressMs: 480,
  dragCancelPx: 18,
  /** Ignore stalled frames so a backgrounded tab cannot dump a pile of eggs. */
  maxFrameDt: 0.05,
} as const;
