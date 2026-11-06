import { describe, expect, it } from 'vitest';
import { INPUT } from '../src/game/config';
import {
  CONTROLS,
  EGG_RADIUS,
  LANES,
  LOGICAL_H,
  LOGICAL_W,
  pointOnPath,
  type ControlId,
} from '../src/game/geometry';
import { computeLayout } from '../src/game/layout';
import { clientToLogical, hitTest, laneFromKey, shouldShowRecord, shouldStartOnRelease } from '../src/input/controls';
import type { Rect } from '../src/game/types';

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHitsRect(x: number, y: number, radius: number, rect: Rect): boolean {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

describe('board layout', () => {
  it('keeps controls on the board and clear of the chutes', () => {
    const ids = Object.keys(CONTROLS) as ControlId[];
    for (const id of ids) {
      const rect = CONTROLS[id];
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(LOGICAL_W);
      expect(rect.y + rect.h).toBeLessThanOrEqual(LOGICAL_H);
      expect(rect.w).toBeGreaterThanOrEqual(48);
      expect(rect.h).toBeGreaterThanOrEqual(36);
    }
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const left = ids[i];
        const right = ids[j];
        if (!left || !right) continue;
        expect(overlaps(CONTROLS[left], CONTROLS[right])).toBe(false);
      }
    }
    for (const lane of LANES) {
      let previousY = -1;
      for (let step = 0; step <= 20; step += 1) {
        const point = pointOnPath(lane, step / 20);
        expect(point.y).toBeGreaterThanOrEqual(previousY - 0.01);
        expect(point.x - EGG_RADIUS).toBeGreaterThan(0);
        expect(point.x + EGG_RADIUS).toBeLessThan(LOGICAL_W);
        for (const id of ids) {
          expect(circleHitsRect(point.x, point.y, EGG_RADIUS, CONTROLS[id])).toBe(false);
        }
        previousY = point.y;
      }
    }
  });

  it('letterboxes portrait, landscape and safe areas without stretching', () => {
    const cases = [
      { w: 320, h: 640, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      { w: 390, h: 844, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      { w: 800, h: 360, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      { w: 400, h: 800, insets: { top: 40, right: 0, bottom: 24, left: 0 } },
    ];
    for (const sample of cases) {
      const layout = computeLayout(sample.w, sample.h, sample.insets);
      expect(layout.scale).toBeGreaterThan(0);
      expect(layout.drawW / layout.drawH).toBeCloseTo(LOGICAL_W / LOGICAL_H, 5);
      expect(layout.offsetX).toBeGreaterThanOrEqual(sample.insets.left - 0.01);
      expect(layout.offsetY).toBeGreaterThanOrEqual(sample.insets.top - 0.01);
      expect(layout.offsetX + layout.drawW).toBeLessThanOrEqual(sample.w - sample.insets.right + 0.01);
      expect(layout.offsetY + layout.drawH).toBeLessThanOrEqual(sample.h - sample.insets.bottom + 0.01);
    }
  });

  it('hits the large touch buttons and keeps a short tap distinct from a hold', () => {
    expect(hitTest(CONTROLS.ul.x + 10, CONTROLS.ul.y + 10)).toBe('ul');
    expect(hitTest(CONTROLS.gameA.x + CONTROLS.gameA.w / 2, CONTROLS.gameA.y + 10)).toBe('gameA');
    expect(hitTest(CONTROLS.gameB.x + 20, CONTROLS.gameB.y + 20)).toBe('gameB');
    expect(hitTest(180, 300)).toBeNull();
    expect(laneFromKey('KeyQ')).toBe('ul');
    expect(laneFromKey('KeyS')).toBe('lr');
    expect(shouldStartOnRelease(120, false)).toBe(true);
    expect(shouldStartOnRelease(INPUT.longPressMs, false)).toBe(false);
    expect(shouldStartOnRelease(80, true)).toBe(false);
    expect(shouldShowRecord(INPUT.longPressMs)).toBe(true);
    expect(
      clientToLogical(190, 390, { left: 10, top: 20, width: LOGICAL_W, height: LOGICAL_H }),
    ).toMatchObject({ x: 180 });
    expect(
      clientToLogical(190, 390, { left: 10, top: 20, width: LOGICAL_W, height: LOGICAL_H }).y,
    ).toBeCloseTo(370, 5);
    expect(clientToLogical(0, 0, { left: 0, top: 0, width: 0, height: 10 })).toEqual({ x: -1, y: -1 });
  });
});
