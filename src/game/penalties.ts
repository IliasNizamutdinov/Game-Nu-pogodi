export type PenaltySlot = 'empty' | 'solid' | 'blink';

/** One stored unit is half a penalty point. 6 units end the game. */
export function formatPenalty(halves: number): string {
  const safe = Math.max(0, Math.min(6, Math.floor(halves)));
  if (safe % 2 === 0) return String(safe / 2);
  return `${Math.floor(safe / 2)}.5`;
}

/**
 * Three chick windows. A leftover half-point blinks in the next window
 * (0.5, 1.5, 2.5). Whole points are solid chicks.
 */
export function penaltySlots(halves: number): PenaltySlot[] {
  const safe = Math.max(0, Math.min(6, Math.floor(halves)));
  const slots: PenaltySlot[] = [];
  let left = safe;
  for (let i = 0; i < 3; i += 1) {
    if (left >= 2) {
      slots.push('solid');
      left -= 2;
    } else if (left === 1) {
      slots.push('blink');
      left = 0;
    } else {
      slots.push('empty');
    }
  }
  return slots;
}
