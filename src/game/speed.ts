import { SPAWN, SPEED } from './config';

/**
 * Speed is a pure function of the internal catch count.
 * Inside a hundred it rises point by point. Crossing a hundred drops the
 * per-point ramp but keeps the per-hundred bonus, so the game slows a little
 * and does not restart. A 999 → 0 rollover (internal count % 1000 === 0 and
 * the count is above 0) applies perCycle instead of clearing the bonus.
 */
export function speedFor(internalCaught: number): number {
  const caught = Math.max(0, Math.floor(internalCaught));
  const cycle = Math.floor(caught / 1000);
  const within = caught % 1000;
  const hundreds = Math.floor(within / 100);
  const points = within % 100;
  const raw =
    SPEED.initial +
    cycle * SPEED.perCycle +
    hundreds * SPEED.perHundred +
    points * SPEED.perPoint;
  return Math.min(SPEED.max, raw);
}

/** Shorter gaps as eggs get faster, never faster than the configured floor. */
export function spawnIntervalFor(speed: number): number {
  const safeSpeed = Math.max(speed, 0.0001);
  const scaled = SPAWN.baseInterval * (SPEED.initial / safeSpeed);
  return Math.min(SPAWN.baseInterval, Math.max(SPAWN.minInterval, scaled));
}
