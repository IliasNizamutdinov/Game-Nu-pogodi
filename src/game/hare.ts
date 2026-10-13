import { HARE } from './config';

export interface HareState {
  present: boolean;
  timer: number;
}

export function createHare(): HareState {
  return { present: false, timer: 0 };
}

/**
 * The hare is either out of the window or looking through it.
 * Presence is this flag, not a random animation frame.
 */
export function stepHare(hare: HareState, dt: number): void {
  if (dt <= 0) return;
  hare.timer += dt;
  const limit = hare.present ? HARE.visibleSeconds : HARE.hiddenSeconds;
  if (hare.timer >= limit) {
    hare.timer -= limit;
    hare.present = !hare.present;
    if (hare.timer > limit) hare.timer = 0;
  }
}
