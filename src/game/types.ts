export type GameMode = 'A' | 'B';

/** Four chutes: upper/lower and left/right. */
export type LaneId = 'ul' | 'ur' | 'll' | 'lr';

export type EggState = 'moving' | 'caught' | 'missed';

export type SessionStatus = 'menu' | 'playing' | 'paused' | 'gameover';

export interface Point {
  x: number;
  y: number;
}

export interface Egg {
  id: number;
  lane: LaneId;
  /** 0 at the hen, 1 at the catch point. The lane never changes. */
  progress: number;
  state: EggState;
  animTime: number;
  /** Snapshot taken when the egg is missed. Later hare frames do not rewrite it. */
  hareWasPresent: boolean;
}

export type GameEvent =
  | { type: 'catch' }
  | { type: 'miss'; hare: boolean }
  | { type: 'gameover' }
  | { type: 'reset-penalty' }
  | { type: 'wrap' };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
