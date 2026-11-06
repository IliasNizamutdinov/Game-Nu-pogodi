import { LOGICAL_H, LOGICAL_W } from './geometry';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
}

/**
 * Uniform scale, letterboxed inside the safe area.
 * Portrait and landscape both keep the board fully visible.
 */
export function computeLayout(viewportW: number, viewportH: number, insets: Insets): ViewportLayout {
  const availW = Math.max(1, viewportW - insets.left - insets.right);
  const availH = Math.max(1, viewportH - insets.top - insets.bottom);
  const scale = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
  const drawW = LOGICAL_W * scale;
  const drawH = LOGICAL_H * scale;
  const offsetX = insets.left + (availW - drawW) / 2;
  const offsetY = insets.top + (availH - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}
