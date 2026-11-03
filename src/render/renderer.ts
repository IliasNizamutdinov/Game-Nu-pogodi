import { ANIM } from '../game/config';
import {
  CHICKENS,
  CONTROLS,
  EGG_RADIUS,
  GROUND_Y,
  HOUSE,
  LANES,
  LCD,
  LOGICAL_H,
  LOGICAL_W,
  angleOnPath,
  catchPoint,
  isLaneControl,
  pointOnPath,
  type ControlId,
} from '../game/geometry';
import { inactiveLane } from '../game/lanes';
import { penaltySlots } from '../game/penalties';
import type { Session } from '../game/session';
import type { Egg, LaneId } from '../game/types';

export interface UiState {
  showRecord: boolean;
  soundOn: boolean;
  hapticOn: boolean;
  heldControl: ControlId | null;
  /** Wall-clock blink so a half-point chick stays readable while the game is paused. */
  blinkOn: boolean;
}

const INK = '#1b2b22';
const LCD_BG = '#c5ccbc';
const RED = '#e10600';

const SEGMENTS: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 1, 0, 0, 1],
  [0, 1, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 1],
];

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function traceLane(ctx: CanvasRenderingContext2D, lane: LaneId): void {
  ctx.beginPath();
  for (let i = 0; i <= 24; i += 1) {
    const point = pointOnPath(lane, i / 24);
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
}

function closedLane(session: Session): LaneId | null {
  if (session.status === 'menu') return null;
  return inactiveLane(session.mode, session.penaltyHalves);
}

export function render(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawShell(ctx);
  drawLcd(ctx, session, ui);
  const closed = closedLane(session);
  for (const lane of LANES) drawChute(ctx, lane, lane === closed);
  for (const lane of LANES) drawChicken(ctx, lane, session, lane === closed);
  drawHouse(ctx, session);
  for (const egg of session.eggs) {
    if (egg.state === 'moving') drawMovingEgg(ctx, egg);
  }
  drawWolf(ctx, session);
  for (const egg of session.eggs) {
    if (egg.state === 'caught') drawCaughtEgg(ctx, egg);
    if (egg.state === 'missed') drawMissedEgg(ctx, egg);
  }
  drawCatchFloater(ctx, session);
  drawHud(ctx, session, ui);
  drawControls(ctx, session, ui);
  drawOverlay(ctx, session, ui);
}

function drawShell(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#178a34';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.strokeStyle = '#0c4e1e';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, LOGICAL_W - 4, LOGICAL_H - 4);

  const metal = ctx.createLinearGradient(8, 8, 8, LOGICAL_H - 8);
  metal.addColorStop(0, '#f2f4f6');
  metal.addColorStop(0.45, '#d5dbe1');
  metal.addColorStop(1, '#b7c0c8');
  roundRect(ctx, 8, 8, LOGICAL_W - 16, LOGICAL_H - 16, 8);
  ctx.fillStyle = metal;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 8, 8, LOGICAL_W - 16, LOGICAL_H - 16, 8);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 16; y < LOGICAL_H; y += 7) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(LOGICAL_W - 10, y);
    ctx.stroke();
  }
  ctx.restore();

  for (const screw of [
    [22, 22],
    [LOGICAL_W - 22, 22],
    [22, LOGICAL_H - 22],
    [LOGICAL_W - 22, LOGICAL_H - 22],
  ]) {
    const sx = screw[0] ?? 0;
    const sy = screw[1] ?? 0;
    ctx.fillStyle = '#8d969e';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c656c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy);
    ctx.lineTo(sx + 3, sy);
    ctx.stroke();
  }

  ctx.fillStyle = '#f7f8f8';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(48, 46, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ИМ', 48, 47);
  ctx.textBaseline = 'alphabetic';

  roundRect(ctx, 96, 16, 412, 304, 6);
  ctx.fillStyle = '#f4f7f8';
  ctx.fill();
  ctx.strokeStyle = '#9aa3aa';
  ctx.lineWidth = 2;
  ctx.stroke();

  roundRect(ctx, 102, 40, 400, 258, 3);
  ctx.fillStyle = '#146b32';
  ctx.fill();

  ctx.fillStyle = RED;
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WOLF CATCHES EGGS', 302, 32);

  ctx.fillStyle = '#111';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillText('WIDE SCREEN', 302, 342);
}

function drawLcd(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  ctx.fillStyle = LCD_BG;
  ctx.fillRect(LCD.x, LCD.y, LCD.w, LCD.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(LCD.x, LCD.y, LCD.w, LCD.h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80, 100, 70, 0.08)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(LCD.x + 20, LCD.y + LCD.h);
  ctx.quadraticCurveTo(LCD.x + 180, LCD.y + 80, LCD.x + LCD.w, LCD.y + 40);
  ctx.stroke();
  ctx.fillStyle = '#6f8f5a';
  for (let i = 0; i < 8; i += 1) {
    const x = LCD.x + 16 + i * 48;
    ctx.fillRect(x, GROUND_Y + 2, 3, 10);
    ctx.beginPath();
    ctx.moveTo(x - 6, GROUND_Y + 6);
    ctx.lineTo(x + 2, GROUND_Y - 2);
    ctx.lineTo(x + 10, GROUND_Y + 6);
    ctx.fill();
  }
  ctx.restore();

  const label = session.status === 'menu' ? 'GAME A' : `GAME ${session.mode}`;
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, LCD.x + 8, LCD.y + LCD.h - 8);
  if (ui.showRecord) {
    ctx.textAlign = 'right';
    ctx.fillText(`BEST ${session.highScore.toString().padStart(3, '0')}`, LCD.x + LCD.w - 8, LCD.y + LCD.h - 8);
  }
}

function drawChute(ctx: CanvasRenderingContext2D, lane: LaneId, closed: boolean): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = closed ? 0.35 : 1;
  traceLane(ctx, lane);
  ctx.strokeStyle = '#6d5840';
  ctx.lineWidth = 7;
  ctx.stroke();
  traceLane(ctx, lane);
  ctx.strokeStyle = closed ? '#8d8d78' : '#d7d2c4';
  ctx.lineWidth = 4;
  ctx.stroke();
  if (closed) {
    const mid = pointOnPath(lane, 0.55);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mid.x - 6, mid.y - 6);
    ctx.lineTo(mid.x + 6, mid.y + 6);
    ctx.moveTo(mid.x + 6, mid.y - 6);
    ctx.lineTo(mid.x - 6, mid.y + 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChicken(ctx: CanvasRenderingContext2D, lane: LaneId, session: Session, dimmed: boolean): void {
  const anchor = CHICKENS[lane];
  const facing = lane === 'ul' || lane === 'll' ? 1 : -1;
  const bob = Math.sin(session.time * 3 + anchor.x) * 1;
  ctx.save();
  ctx.globalAlpha = dimmed ? 0.4 : 1;
  ctx.translate(anchor.x, anchor.y + bob);
  ctx.scale(facing, 1);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, 4);
  ctx.lineTo(16, 4);
  ctx.stroke();
  ctx.fillStyle = '#f4f1ea';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -6, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, -12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d02323';
  ctx.beginPath();
  ctx.ellipse(9, -17, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0a020';
  ctx.beginPath();
  ctx.moveTo(13, -12);
  ctx.lineTo(19, -10);
  ctx.lineTo(13, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(10, -13, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHouse(ctx: CanvasRenderingContext2D, session: Session): void {
  const { x, y, w, h } = HOUSE;
  ctx.fillStyle = '#f3f0e8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.fillRect(x + 8, y + 16, w - 10, h - 16);
  ctx.strokeRect(x + 8, y + 16, w - 10, h - 16);
  ctx.fillStyle = '#d23a2a';
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 18);
  ctx.lineTo(x + w / 2, y + 2);
  ctx.lineTo(x + w - 2, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6a3a28';
  ctx.fillRect(x + 16, y + h - 16, 10, 16);
  if (!session.hare.present) return;
  const hx = x + w - 4;
  const hy = y + 20;
  ctx.fillStyle = '#f7f4ee';
  ctx.beginPath();
  ctx.ellipse(hx - 6, hy - 14, 2.4, 8, -0.3, 0, Math.PI * 2);
  ctx.ellipse(hx + 2, hy - 14, 2.4, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx - 2, hy - 1, 0.8, 0, Math.PI * 2);
  ctx.arc(hx + 3, hy - 1, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawEggShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotation: number,
  scale: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = '#8a7048';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, EGG_RADIUS * 0.85, EGG_RADIUS * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMovingEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const point = pointOnPath(egg.lane, egg.progress);
  const roll = angleOnPath(egg.lane, egg.progress) + egg.progress * 6;
  drawEggShape(ctx, point.x, point.y, roll, 1, 1);
}

function drawCaughtEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const t = Math.min(1, egg.animTime / ANIM.catch);
  const point = catchPoint(egg.lane);
  drawEggShape(ctx, point.x, point.y - t * 8, 0, 1 - t * 0.8, 1 - t * 0.2);
}

function drawMissedEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const duration = egg.hareWasPresent ? ANIM.missWithChick : ANIM.miss;
  const t = Math.min(1, egg.animTime / duration);
  const start = catchPoint(egg.lane);
  const fall = 0.32;
  if (t < fall) {
    const k = t / fall;
    const y = start.y + (GROUND_Y - start.y) * k * k;
    drawEggShape(ctx, start.x, y, k, 1, 1);
    return;
  }
  const phase = (t - fall) / (1 - fall);
  ctx.save();
  ctx.globalAlpha = 1 - phase * 0.4;
  ctx.fillStyle = '#f2e2a8';
  ctx.beginPath();
  ctx.ellipse(start.x, GROUND_Y, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2b13a';
  ctx.beginPath();
  ctx.arc(start.x, GROUND_Y - 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (egg.hareWasPresent) {
    const cx = start.x + 8 + phase * 28;
    ctx.fillStyle = '#f0c84a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y - 6, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 4, GROUND_Y - 9, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawWolf(ctx: CanvasRenderingContext2D, session: Session): void {
  const facing = session.wolfLane === 'ul' || session.wolfLane === 'll' ? -1 : 1;
  const { x, y } = session.wolfVisual;
  const bump = Math.sin(Math.min(1, session.catchPulse / ANIM.catchPulse) * Math.PI) * 3;
  ctx.save();
  ctx.translate(x, y + 4);
  ctx.scale(facing * 1.15, 1.15);
  drawPocketWolf(ctx, bump);
  ctx.restore();
}

/** Side-view pocket-toy wolf: tall ears, long muzzle, basket held out. */
function drawPocketWolf(ctx: CanvasRenderingContext2D, bump: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.4;
  ctx.fillStyle = '#1a1a1a';

  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.quadraticCurveTo(-28, -18, -24, -4);
  ctx.quadraticCurveTo(-20, 2, -12, -2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-4, -16, 11, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-12, 16);
  ctx.lineTo(-4, 16);
  ctx.lineTo(-2, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, -2);
  ctx.lineTo(0, 16);
  ctx.lineTo(8, 16);
  ctx.lineTo(8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(6, -30, 10, 9, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(14, -28, 8, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-2, -36);
  ctx.lineTo(-6, -52);
  ctx.lineTo(2, -36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -37);
  ctx.lineTo(6, -54);
  ctx.lineTo(11, -36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.ellipse(16, -29, 7, 4.5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(20, -31);
  ctx.lineTo(25, -29);
  ctx.lineTo(20, -27);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(12, -32, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(12.7, -32, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(2, -12);
  ctx.quadraticCurveTo(10, -18 - bump, 16, -4 - bump);
  ctx.stroke();

  ctx.fillStyle = '#e07a2f';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 8, -8 - bump, 20, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(18, -8 - bump, 8, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#fff6dc';
  ctx.beginPath();
  ctx.ellipse(16, -3 - bump, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCatchFloater(ctx: CanvasRenderingContext2D, session: Session): void {
  if (session.catchPulse <= 0) return;
  const alpha = Math.max(0, session.catchPulse / ANIM.catchPulse);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+1', session.wolfVisual.x, session.wolfVisual.y - 48);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  drawDigits(ctx, session.displayScore, 248, 56, ui.showRecord ? '#8a1a12' : INK);
  const slots = penaltySlots(session.penaltyHalves);
  slots.forEach((slot, index) => {
    drawPenaltySlot(ctx, 360 + index * 18, 54, slot, ui.blinkOn);
  });
}

function drawDigits(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, color: string): void {
  const text = Math.max(0, Math.min(999, Math.floor(value))).toString().padStart(4, '0');
  for (let i = 0; i < 4; i += 1) {
    drawDigit(ctx, Number(text[i] ?? '0'), x + i * 14, y, 12, 22, color, 'rgba(27,43,34,0.12)');
  }
}

function drawDigit(
  ctx: CanvasRenderingContext2D,
  digit: number,
  x: number,
  y: number,
  w: number,
  h: number,
  on: string,
  off: string,
): void {
  const mask = SEGMENTS[digit] ?? SEGMENTS[0];
  const thickness = 2;
  const gap = 1;
  const innerW = w - thickness * 2;
  const half = (h - thickness * 3 - gap * 2) / 2;
  const bars: Array<[number, number, number, number]> = [
    [x + thickness, y, innerW, thickness],
    [x + w - thickness, y + thickness + gap, thickness, half],
    [x + w - thickness, y + thickness + half + thickness + gap * 2, thickness, half],
    [x + thickness, y + h - thickness, innerW, thickness],
    [x, y + thickness + half + thickness + gap * 2, thickness, half],
    [x, y + thickness + gap, thickness, half],
    [x + thickness, y + thickness + half + gap, innerW, thickness],
  ];
  bars.forEach((bar, index) => {
    ctx.fillStyle = mask?.[index] ? on : off;
    ctx.fillRect(bar[0], bar[1], Math.max(1, bar[2]), Math.max(1, bar[3]));
  });
}

function drawPenaltySlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slot: 'empty' | 'solid' | 'blink',
  blinkOn: boolean,
): void {
  const show = slot === 'solid' || (slot === 'blink' && blinkOn);
  ctx.fillStyle = show ? '#e2b423' : 'rgba(27,43,34,0.15)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 10, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (show) ctx.stroke();
  if (!show) return;
  ctx.beginPath();
  ctx.arc(x + 9, y + 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawControls(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  drawExitButton(ctx, ui.heldControl === 'exit');
  drawSwitch(ctx, 'sound', ui.soundOn ? 'Sound' : 'Muted', ui.soundOn, ui);
  drawSwitch(ctx, 'haptic', 'Vib', ui.hapticOn, ui);
  drawSwitch(ctx, 'gameA', 'Game A', session.status !== 'menu' && session.mode === 'A', ui);
  drawSwitch(ctx, 'gameB', 'Game B', session.status !== 'menu' && session.mode === 'B', ui);
  drawSwitch(ctx, 'pause', session.status === 'paused' ? 'Resume' : 'Pause', session.status === 'paused', ui);
  for (const lane of LANES) {
    if (!isLaneControl(lane)) continue;
    drawRedButton(ctx, lane, session.wolfLane === lane, ui.heldControl === lane);
  }
}

function drawExitButton(ctx: CanvasRenderingContext2D, held: boolean): void {
  const rect = CONTROLS.exit;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 + (held ? 1 : 0);
  ctx.fillStyle = held ? '#ffd0cc' : '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#c41212';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.moveTo(cx + 6, cy - 6);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.stroke();
}

function drawSwitch(
  ctx: CanvasRenderingContext2D,
  id: 'sound' | 'haptic' | 'gameA' | 'gameB' | 'pause',
  label: string,
  lit: boolean,
  ui: UiState,
): void {
  const rect = CONTROLS[id];
  const held = ui.heldControl === id;
  ctx.fillStyle = held ? '#c9d4c4' : '#e7eee4';
  ctx.strokeStyle = '#314238';
  ctx.lineWidth = 1.4;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = lit ? '#ff9a1a' : '#6d7270';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w - 12, rect.y + rect.h / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1c241c';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + 8, rect.y + rect.h / 2 + (held ? 1 : 0));
  ctx.textBaseline = 'alphabetic';
}

function drawRedButton(ctx: CanvasRenderingContext2D, id: LaneId, active: boolean, held: boolean): void {
  const rect = CONTROLS[id];
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 + (held ? 1 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(cx, cy + 3, 24, 0, Math.PI * 2);
  ctx.fill();
  const gloss = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, 26);
  gloss.addColorStop(0, '#ff5a4a');
  gloss.addColorStop(0.55, RED);
  gloss.addColorStop(1, '#8d120c');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? '#ffe08a' : '#5a100c';
  ctx.lineWidth = active ? 4 : 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - 8, 8, 5, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawOverlay(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  if (session.status === 'playing' && session.notice) {
    ctx.fillStyle = 'rgba(20, 40, 24, 0.88)';
    roundRect(ctx, LCD.x + 90, LCD.y + 8, 220, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#f3f6ea';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(session.notice.text, LCD.x + 200, LCD.y + 23);
    return;
  }
  if (session.status === 'playing') return;

  ctx.fillStyle = 'rgba(27, 43, 34, 0.78)';
  ctx.fillRect(LCD.x, LCD.y, LCD.w, LCD.h);
  ctx.fillStyle = '#f4f7ef';
  ctx.textAlign = 'center';
  const cx = LCD.x + LCD.w / 2;
  if (session.status === 'menu') {
    ctx.font = 'bold 16px Verdana, sans-serif';
    ctx.fillText('CATCH THE EGGS', cx, LCD.y + 78);
    ctx.font = '12px Verdana, sans-serif';
    const lines = [
      'Move the wolf with the red buttons.',
      'Three penalties end the run.',
      'Game A uses three chutes.',
      'Game B uses all four.',
      'Hold Game A or Game B to see the record.',
    ];
    lines.forEach((line, index) => ctx.fillText(line, cx, LCD.y + 108 + index * 18));
    if (ui.showRecord) {
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.fillStyle = '#ffe08a';
      ctx.fillText(`RECORD ${session.highScore.toString().padStart(3, '0')}`, cx, LCD.y + 214);
    }
  } else if (session.status === 'paused') {
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillText('PAUSED', cx, LCD.y + 110);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillText('Eggs stay where they are.', cx, LCD.y + 140);
    ctx.fillText('Press Pause to continue.', cx, LCD.y + 160);
  } else {
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillText('GAME OVER', cx, LCD.y + 90);
    ctx.font = 'bold 16px Verdana, sans-serif';
    ctx.fillStyle = '#d6ff6a';
    ctx.fillText(`SCORE ${session.displayScore.toString().padStart(3, '0')}`, cx, LCD.y + 124);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(`BEST ${session.highScore.toString().padStart(3, '0')}`, cx, LCD.y + 148);
    ctx.fillStyle = '#f4f7ef';
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillText('Press Game A or Game B', cx, LCD.y + 182);
  }
}
