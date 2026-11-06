import { LANES } from './geometry';
import type { GameMode, LaneId } from './types';

/**
 * Game A keeps the lower-left chute closed for the whole run.
 * A miss must not move that closure to another chute.
 * Game B uses every chute. The penalty argument is unused and kept so callers stay stable.
 */
export function inactiveLane(mode: GameMode, _penaltyHalves: number): LaneId | null {
  if (mode !== 'A') return null;
  return 'll';
}

export function activeLanes(mode: GameMode, penaltyHalves: number): LaneId[] {
  const closed = inactiveLane(mode, penaltyHalves);
  return LANES.filter((lane) => lane !== closed);
}
