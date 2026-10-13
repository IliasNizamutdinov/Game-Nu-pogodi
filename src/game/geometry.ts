import type { LaneId, Point, Rect } from './types';

/** Portrait board. The canvas is scaled uniformly to the visible viewport. */
export const LOGICAL_W = 360;
export const LOGICAL_H = 740;

export const EGG_RADIUS = 16;
export const GROUND_Y = 500;

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
    { x: 58, y: 132 },
    { x: 88, y: 176 },
    { x: 110, y: 222 },
    { x: 126, y: 268 },
  ],
  ur: [
    { x: 302, y: 132 },
    { x: 272, y: 176 },
    { x: 250, y: 222 },
    { x: 234, y: 268 },
  ],
  ll: [
    { x: 52, y: 276 },
    { x: 80, y: 328 },
    { x: 106, y: 372 },
    { x: 130, y: 412 },
  ],
  lr: [
    { x: 308, y: 276 },
    { x: 280, y: 328 },
    { x: 254, y: 372 },
    { x: 230, y: 412 },
  ],
};

export const PATHS: Record<LaneId, Path> = {
  ul: build(RAW_PATHS.ul),
  ur: build(RAW_PATHS.ur),
  ll: build(RAW_PATHS.ll),
  lr: build(RAW_PATHS.lr),
};

export const CHICKENS: Record<LaneId, Point> = {
  ul: { x: 54, y: 112 },
  ur: { x: 306, y: 112 },
  ll: { x: 48, y: 254 },
  lr: { x: 312, y: 254 },
};

export const HOUSE: Rect = { x: 6, y: 418, w: 78, h: 96 };
export const HARE_WINDOW: Rect = { x: 26, y: 448, w: 40, h: 34 };

export const HUD: Rect = { x: 8, y: 8, w: 344, h: 52 };

export const CONTROLS = {
  pause: { x: 8, y: 528, w: 110, h: 36 },
  sound: { x: 126, y: 528, w: 110, h: 36 },
  haptic: { x: 244, y: 528, w: 108, h: 36 },
  ul: { x: 8, y: 572, w: 78, h: 66 },
  ur: { x: 92, y: 572, w: 78, h: 66 },
  gameA: { x: 178, y: 572, w: 174, h: 66 },
  ll: { x: 8, y: 646, w: 78, h: 66 },
  lr: { x: 92, y: 646, w: 78, h: 66 },
  gameB: { x: 178, y: 646, w: 174, h: 66 },
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
