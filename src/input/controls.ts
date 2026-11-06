import { INPUT } from '../game/config';
import { CONTROLS, LOGICAL_H, LOGICAL_W, isLaneControl, type ControlId } from '../game/geometry';
import type { LaneId } from '../game/types';

export function hitTest(x: number, y: number): ControlId | null {
  const ids = Object.keys(CONTROLS) as ControlId[];
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i];
    if (!id) continue;
    const rect = CONTROLS[id];
    if (x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h) return id;
  }
  return null;
}

export function clientToLogical(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: -1, y: -1 };
  return {
    x: ((clientX - rect.left) / rect.width) * LOGICAL_W,
    y: ((clientY - rect.top) / rect.height) * LOGICAL_H,
  };
}

export function laneFromKey(code: string): LaneId | null {
  switch (code) {
    case 'KeyQ':
    case 'Digit1':
    case 'Numpad7':
      return 'ul';
    case 'KeyW':
    case 'Digit2':
    case 'Numpad9':
      return 'ur';
    case 'KeyA':
    case 'Digit3':
    case 'Numpad1':
      return 'll';
    case 'KeyS':
    case 'Digit4':
    case 'Numpad3':
      return 'lr';
    default:
      return null;
  }
}

export function isPauseKey(code: string): boolean {
  return code === 'KeyP' || code === 'Escape' || code === 'Space';
}

export function isSoundKey(code: string): boolean {
  return code === 'KeyM';
}

export function isHapticKey(code: string): boolean {
  return code === 'KeyH';
}

/** A short tap starts the chosen mode. A long press only reveals the record. */
export function shouldStartOnRelease(heldMs: number, moved: boolean): boolean {
  return !moved && heldMs < INPUT.longPressMs;
}

export function shouldShowRecord(heldMs: number): boolean {
  return heldMs >= INPUT.longPressMs;
}

export function controlToLane(id: ControlId): LaneId | null {
  return isLaneControl(id) ? id : null;
}
