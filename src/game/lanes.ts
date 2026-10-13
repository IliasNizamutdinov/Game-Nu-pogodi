import { LANES } from './geometry';
import type { GameMode, LaneId } from './types';

/**
 * Game A leaves one chute unused. The closed chute follows the penalty total.
 * Values are half-points: 0, 1=0.5, 2=1, 3=1.5, 4=2, 5=2.5.
 * Game B uses every chute.
 */
export function inactiveLane(mode: GameMode, penaltyHalves: number): LaneId | null {
  if (mode !== 'A') return null;
  const halves = Math.max(0, Math.floor(penaltyHalves));
  if (halves <= 0) return 'll';
  if (halves <= 2) return 'lr';
  if (halves <= 4) return 'ul';
  return 'ur';
}

export function activeLanes(mode: GameMode, penaltyHalves: number): LaneId[] {
  const closed = inactiveLane(mode, penaltyHalves);
  return LANES.filter((lane) => lane !== closed);
}
