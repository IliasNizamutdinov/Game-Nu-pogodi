import type { LaneId, Point, Rect } from './types';

/**
 * Wide handheld board, matching the pocket-toy composition:
 * red buttons on both sides, switches on the right, LCD in the center.
 */
export const LOGICAL_W = 640;
export const LOGICAL_H = 360;

export const EGG_RADIUS = 8;
export const GROUND_Y = 286;

export const LANES: readonly LaneId[] = ['ul', 'ur', 'll', 'lr'];

interface Path {
  points: readonly Point[];
  segLen: number[];
  total: number;
}

function build(points: readonly Point[]): Path {
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLen.push(len);
    total += len;
  }
  return { points, segLen, total };
}

const RAW_PATHS: Record<LaneId, readonly Point[]> = {
  ul: [
    { x: 136, y: 112 },
    { x: 176, y: 136 },
    { x: 210, y: 158 },
    { x: 236, y: 178 },
  ],
  ur: [
    { x: 468, y: 112 },
    { x: 428, y: 136 },
    { x: 394, y: 158 },
    { x: 368, y: 178 },
  ],
  ll: [
    { x: 148, y: 186 },
    { x: 186, y: 208 },
    { x: 220, y: 226 },
    { x: 248, y: 242 },
  ],
  lr: [
    { x: 456, y: 186 },
    { x: 418, y: 208 },
    { x: 384, y: 226 },
    { x: 356, y: 242 },
  ],
};

export const PATHS: Record<LaneId, Path> = {
  ul: build(RAW_PATHS.ul),
  ur: build(RAW_PATHS.ur),
  ll: build(RAW_PATHS.ll),
  lr: build(RAW_PATHS.lr),
};

export const CHICKENS: Record<LaneId, Point> = {
  ul: { x: 132, y: 96 },
  ur: { x: 472, y: 96 },
  ll: { x: 146, y: 170 },
  lr: { x: 458, y: 170 },
};

/** Gray-green LCD glass inside the bezel. */
export const LCD: Rect = { x: 104, y: 48, w: 400, h: 248 };

export const HOUSE: Rect = { x: 110, y: 54, w: 62, h: 48 };
export const HARE_WINDOW: Rect = { x: 128, y: 66, w: 28, h: 22 };

export const HUD: Rect = { x: 230, y: 54, w: 92, h: 28 };

export const CONTROLS = {
  exit: { x: 8, y: 8, w: 52, h: 42 },
  difficulty: { x: 8, y: 56, w: 80, h: 40 },
  sound: { x: 516, y: 50, w: 62, h: 36 },
  haptic: { x: 582, y: 50, w: 52, h: 36 },
  gameA: { x: 516, y: 90, w: 118, h: 36 },
  gameB: { x: 516, y: 130, w: 118, h: 36 },
  pause: { x: 516, y: 170, w: 118, h: 36 },
  ul: { x: 12, y: 214, w: 74, h: 62 },
  ll: { x: 12, y: 282, w: 74, h: 62 },
  ur: { x: 554, y: 214, w: 74, h: 62 },
  lr: { x: 554, y: 282, w: 74, h: 62 },
} as const satisfies Record<string, Rect>;

export type ControlId = keyof typeof CONTROLS;

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function pointOnPath(lane: LaneId, t: number): Point {
  const path = PATHS[lane];
  const target = clamp01(t) * path.total;
  let acc = 0;
  for (let i = 0; i < path.segLen.length; i += 1) {
    const len = path.segLen[i] ?? 0;
    if (acc + len >= target - 1e-6) {
      const local = len === 0 ? 0 : (target - acc) / len;
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) break;
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }
    acc += len;
  }
  const last = path.points[path.points.length - 1];
  return { x: last?.x ?? 0, y: last?.y ?? 0 };
}

export function catchPoint(lane: LaneId): Point {
  return pointOnPath(lane, 1);
}

export function angleOnPath(lane: LaneId, t: number): number {
  const a = pointOnPath(lane, t - 0.015);
  const b = pointOnPath(lane, t + 0.015);
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function isLaneControl(id: ControlId): id is LaneId {
  return id === 'ul' || id === 'ur' || id === 'll' || id === 'lr';
}
