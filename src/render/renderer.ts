import { ANIM } from '../game/config';
import {
  CHICKENS,
  CONTROLS,
  EGG_RADIUS,
  GROUND_Y,
  HARE_WINDOW,
  HOUSE,
  HUD,
  LANES,
  LOGICAL_H,
  LOGICAL_W,
  angleOnPath,
  catchPoint,
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

const LANE_COLOR: Record<LaneId, string> = {
  ul: '#e23b3b',
  ur: '#2d6fe8',
  ll: '#2f9d4a',
  lr: '#e6a317',
};

const LANE_HINT: Record<LaneId, { name: string; key: string; arrow: string }> = {
  ul: { name: 'UL', key: 'Q', arrow: '↖' },
  ur: { name: 'UR', key: 'W', arrow: '↗' },
  ll: { name: 'LL', key: 'A', arrow: '↙' },
  lr: { name: 'LR', key: 'S', arrow: '↘' },
};

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
  for (let i = 0; i <= 28; i += 1) {
    const point = pointOnPath(lane, i / 28);
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
  drawSky(ctx);
  drawGround(ctx);
  drawHouse(ctx, session);
  const closed = closedLane(session);
  for (const lane of LANES) drawChute(ctx, lane, lane === closed);
  for (const lane of LANES) drawChicken(ctx, lane, session, lane === closed);
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

function drawSky(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, '#f6c98a');
  sky.addColorStop(0.45, '#f08a4b');
  sky.addColorStop(1, '#d65a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_W, 520);

  ctx.fillStyle = '#ffe3a4';
  ctx.beginPath();
  ctx.arc(300, 92, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 236, 190, 0.35)';
  ctx.beginPath();
  ctx.arc(300, 92, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 244, 220, 0.55)';
  drawCloud(ctx, 40, 78, 1);
  drawCloud(ctx, 150, 64, 0.75);

  ctx.fillStyle = '#6d8a45';
  ctx.beginPath();
  ctx.ellipse(70, 470, 120, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#567336';
  ctx.beginPath();
  ctx.ellipse(250, 486, 150, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f5a2c';
  ctx.beginPath();
  ctx.ellipse(180, 508, 220, 36, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 26 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 18 * scale, y + 2, 18 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 16 * scale, y + 3, 16 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#c4925a';
  ctx.fillRect(0, 492, LOGICAL_W, 36);
  ctx.fillStyle = '#a87442';
  ctx.fillRect(0, 520, LOGICAL_W, 8);
  ctx.strokeStyle = 'rgba(90, 52, 28, 0.25)';
  ctx.lineWidth = 2;
  for (let x = 12; x < LOGICAL_W; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 500);
    ctx.lineTo(x + 8, 512);
    ctx.stroke();
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, session: Session): void {
  const { x, y, w, h } = HOUSE;
  ctx.fillStyle = '#6b442c';
  roundRect(ctx, x, y + 18, w, h - 18, 4);
  ctx.fill();
  ctx.strokeStyle = '#2c1a12';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#8d3d32';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 24);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w + 4, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2a211c';
  roundRect(ctx, HARE_WINDOW.x, HARE_WINDOW.y, HARE_WINDOW.w, HARE_WINDOW.h, 3);
  ctx.fill();
  ctx.strokeStyle = '#e6c48a';
  ctx.stroke();

  ctx.fillStyle = '#5c331f';
  roundRect(ctx, x + 8, y + h - 28, 18, 26, 2);
  ctx.fill();

  if (session.hare.present) drawHare(ctx);
  else {
    ctx.fillStyle = 'rgba(20, 16, 14, 0.45)';
    ctx.fillRect(HARE_WINDOW.x + 4, HARE_WINDOW.y + 4, 10, HARE_WINDOW.h - 8);
  }
}

function drawHare(ctx: CanvasRenderingContext2D): void {
  const cx = HARE_WINDOW.x + HARE_WINDOW.w / 2;
  const cy = HARE_WINDOW.y + HARE_WINDOW.h / 2 + 4;
  ctx.fillStyle = '#f3efe6';
  ctx.strokeStyle = '#2c241c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 16, 3.2, 10, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 16, 3.2, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7b6c4';
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 16, 1.4, 6, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 16, 1.4, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2c241c';
  ctx.beginPath();
  ctx.arc(cx - 4, cy + 1, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy + 1, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e07a8c';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 2.2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawChute(ctx: CanvasRenderingContext2D, lane: LaneId, closed: boolean): void {
  ctx.save();
  ctx.globalAlpha = closed ? 0.38 : 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  traceLane(ctx, lane);
  ctx.strokeStyle = '#4a3424';
  ctx.lineWidth = 20;
  ctx.stroke();
  traceLane(ctx, lane);
  ctx.strokeStyle = LANE_COLOR[lane];
  ctx.lineWidth = 14;
  ctx.stroke();
  traceLane(ctx, lane);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.stroke();

  for (let i = 1; i <= 4; i += 1) {
    const point = pointOnPath(lane, i / 5);
    ctx.fillStyle = '#f2e2c4';
    ctx.beginPath();
    ctx.arc(point.x, point.y - 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (closed) {
    const mid = pointOnPath(lane, 0.55);
    ctx.strokeStyle = '#2a211c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mid.x - 10, mid.y - 10);
    ctx.lineTo(mid.x + 10, mid.y + 10);
    ctx.moveTo(mid.x + 10, mid.y - 10);
    ctx.lineTo(mid.x - 10, mid.y + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChicken(ctx: CanvasRenderingContext2D, lane: LaneId, session: Session, dimmed: boolean): void {
  const anchor = CHICKENS[lane];
  const facing = lane === 'ul' || lane === 'll' ? 1 : -1;
  const bob = Math.sin(session.time * 3.2 + anchor.x) * 1.6;
  const squish = session.layPulse[lane] > 0 ? session.layPulse[lane] / ANIM.lay : 0;
  ctx.save();
  ctx.globalAlpha = dimmed ? 0.45 : 1;
  ctx.translate(anchor.x, anchor.y + bob);
  ctx.scale(facing, 1);

  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-24, 6);
  ctx.lineTo(22, 6);
  ctx.stroke();

  ctx.fillStyle = '#f4efe4';
  ctx.strokeStyle = '#2c241c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, -8, 16, 11 - squish * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = LANE_COLOR[lane];
  ctx.beginPath();
  ctx.ellipse(-2, -6, 7, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f7f3ea';
  ctx.beginPath();
  ctx.arc(12, -16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d23a32';
  ctx.beginPath();
  ctx.ellipse(12, -23, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(15, -21, 2, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f0b429';
  ctx.beginPath();
  ctx.moveTo(18, -16);
  ctx.lineTo(26, -14);
  ctx.lineTo(18, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2c241c';
  ctx.beginPath();
  ctx.arc(14, -17, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#2c241c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(-6, 8);
  ctx.moveTo(4, 2);
  ctx.lineTo(6, 8);
  ctx.stroke();
  ctx.restore();
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
  ctx.fillStyle = 'rgba(80, 40, 20, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 4, EGG_RADIUS * 0.85, EGG_RADIUS * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff6dc';
  ctx.strokeStyle = '#8a6230';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, EGG_RADIUS * 0.78, EGG_RADIUS, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 4, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMovingEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const angle = angleOnPath(egg.lane, egg.progress);
  for (const trail of [0.055, 0.028]) {
    const t = egg.progress - trail;
    if (t <= 0) continue;
    const point = pointOnPath(egg.lane, t);
    drawEggShape(ctx, point.x, point.y, angle, 0.86, 0.18);
  }
  const point = pointOnPath(egg.lane, egg.progress);
  const roll = angle + egg.progress * 7;
  drawEggShape(ctx, point.x, point.y, roll, 1, 1);
}

function drawCaughtEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const t = Math.min(1, egg.animTime / ANIM.catch);
  const point = catchPoint(egg.lane);
  drawEggShape(ctx, point.x, point.y - t * 12, 0, 1 - t * 0.85, 1 - t * 0.2);
}

function drawMissedEgg(ctx: CanvasRenderingContext2D, egg: Egg): void {
  const duration = egg.hareWasPresent ? ANIM.missWithChick : ANIM.miss;
  const t = Math.min(1, egg.animTime / duration);
  const start = catchPoint(egg.lane);
  const fall = 0.32;
  if (t < fall) {
    const k = t / fall;
    const y = start.y + (GROUND_Y - start.y) * k * k;
    drawEggShape(ctx, start.x, y, k * 2, 1, 1);
    return;
  }
  const phase = (t - fall) / (1 - fall);
  drawSplat(ctx, start.x, GROUND_Y, phase);
  if (egg.hareWasPresent) drawRunningChick(ctx, start.x, GROUND_Y, phase);
}

function drawSplat(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  ctx.save();
  ctx.globalAlpha = 1 - phase * 0.35;
  ctx.fillStyle = '#f4e7b0';
  ctx.beginPath();
  ctx.ellipse(x, y, 14 + phase * 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c14a';
  ctx.beginPath();
  ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8e8';
  ctx.strokeStyle = '#8a6230';
  ctx.lineWidth = 1.4;
  for (const shard of [
    [-10, -6, 7, 4],
    [8, -8, 6, 4],
    [-4, -12, 5, 3],
  ]) {
    const sx = shard[0] ?? 0;
    const sy = shard[1] ?? 0;
    const sw = shard[2] ?? 4;
    const sh = shard[3] ?? 3;
    ctx.beginPath();
    ctx.ellipse(x + sx, y + sy, sw, sh, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawRunningChick(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  const cx = x + 10 + phase * 48;
  const cy = y - 10 - Math.abs(Math.sin(phase * 18)) * 3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#f6d34a';
  ctx.strokeStyle = '#2c241c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e4572e';
  ctx.beginPath();
  ctx.moveTo(9, -4);
  ctx.lineTo(14, -3);
  ctx.lineTo(9, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2c241c';
  ctx.beginPath();
  ctx.arc(7, -5, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c241c';
  ctx.beginPath();
  ctx.moveTo(-2, 5);
  ctx.lineTo(-4, 9);
  ctx.moveTo(2, 5);
  ctx.lineTo(4, 9);
  ctx.stroke();
  ctx.restore();
}

function drawWolf(ctx: CanvasRenderingContext2D, session: Session): void {
  const facing = session.wolfLane === 'ul' || session.wolfLane === 'll' ? -1 : 1;
  const { x, y } = session.wolfVisual;
  const bump = Math.sin(Math.min(1, session.catchPulse / ANIM.catchPulse) * Math.PI) * 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  ctx.fillStyle = 'rgba(60, 30, 16, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6e6a74';
  ctx.strokeStyle = '#241c18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-6, -34, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d9cfc2';
  ctx.beginPath();
  ctx.ellipse(-4, -30, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c4552a';
  ctx.beginPath();
  ctx.moveTo(-18, -40);
  ctx.lineTo(-2, -30);
  ctx.lineTo(-16, -24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7a767f';
  ctx.beginPath();
  ctx.moveTo(-18, -28);
  ctx.quadraticCurveTo(-34, -18, -26, -4);
  ctx.quadraticCurveTo(-16, -12, -12, -22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7d7982';
  ctx.beginPath();
  ctx.arc(-8, -56, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6e6a74';
  ctx.beginPath();
  ctx.moveTo(-16, -64);
  ctx.lineTo(-20, -80);
  ctx.lineTo(-8, -66);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -66);
  ctx.lineTo(2, -82);
  ctx.lineTo(4, -64);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#efe8dc';
  ctx.beginPath();
  ctx.ellipse(2, -54, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2c241c';
  ctx.beginPath();
  ctx.arc(6, -52, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4574a';
  ctx.beginPath();
  ctx.arc(8, -48, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#241c18';
  ctx.fillStyle = '#6e6a74';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -24);
  ctx.quadraticCurveTo(16, -28 - bump, 20, -6 - bump);
  ctx.stroke();

  ctx.save();
  ctx.translate(18, -2 - bump);
  ctx.fillStyle = '#d8612a';
  ctx.strokeStyle = '#241c18';
  ctx.lineWidth = 2;
  roundRect(ctx, -16, -6, 32, 16, 5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f2c7a2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -6, 12, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#fff6dc';
  if (session.displayScore > 0) {
    ctx.beginPath();
    ctx.ellipse(-4, 2, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#5e5a64';
  ctx.strokeStyle = '#241c18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -16);
  ctx.lineTo(-16, 4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(2, 4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCatchFloater(ctx: CanvasRenderingContext2D, session: Session): void {
  if (session.catchPulse <= 0) return;
  const alpha = Math.max(0, session.catchPulse / ANIM.catchPulse);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff8e4';
  ctx.strokeStyle = '#6a3a16';
  ctx.lineWidth = 3;
  ctx.font = 'bold 18px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText('+1', session.wolfVisual.x, session.wolfVisual.y - 70 - (1 - alpha) * 14);
  ctx.fillText('+1', session.wolfVisual.x, session.wolfVisual.y - 70 - (1 - alpha) * 14);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  ctx.fillStyle = '#2a1a12';
  roundRect(ctx, HUD.x, HUD.y, HUD.w, HUD.h, 8);
  ctx.fill();
  ctx.strokeStyle = '#e6c48a';
  ctx.lineWidth = ui.showRecord ? 3 : 1.5;
  ctx.stroke();

  ctx.fillStyle = '#e6c48a';
  ctx.font = 'bold 9px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 16, 22);
  ctx.fillText('BEST', 262, 22);
  drawDigits(ctx, session.displayScore, 16, 26, '#d6ff6a', '#243022');

  ctx.save();
  if (ui.showRecord) {
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 2;
    roundRect(ctx, 258, 24, 62, 30, 4);
    ctx.stroke();
  }
  drawDigits(ctx, session.highScore, 262, 26, ui.showRecord ? '#ffe08a' : '#d6ff6a', '#243022');
  ctx.restore();

  const slots = penaltySlots(session.penaltyHalves);
  slots.forEach((slot, index) => {
    drawPenaltySlot(ctx, 132 + index * 28, 18, slot, ui.blinkOn);
  });

  if (session.status !== 'menu') {
    ctx.fillStyle = '#1a120e';
    roundRect(ctx, 214, 16, 22, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#fff4d2';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(session.mode, 225, 28);
  }
}

function drawDigits(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  on: string,
  off: string,
): void {
  const text = Math.max(0, Math.min(999, Math.floor(value))).toString().padStart(3, '0');
  ctx.fillStyle = '#101810';
  ctx.fillRect(x - 2, y - 1, 50, 28);
  for (let i = 0; i < 3; i += 1) {
    const char = text[i] ?? '0';
    drawDigit(ctx, Number(char), x + i * 16, y, 14, 26, on, off);
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
  const thickness = Math.max(2, Math.round(w * 0.22));
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
    ctx.fillRect(bar[0], bar[1], bar[2], bar[3]);
  });
}

function drawPenaltySlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slot: 'empty' | 'solid' | 'blink',
  blinkOn: boolean,
): void {
  ctx.save();
  ctx.fillStyle = '#1a120e';
  roundRect(ctx, x, y, 24, 28, 4);
  ctx.fill();
  const showChick = slot === 'solid' || (slot === 'blink' && blinkOn);
  if (slot === 'empty' || (slot === 'blink' && !blinkOn)) {
    ctx.fillStyle = '#3a2a22';
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 16, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a7058';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (showChick) {
    ctx.fillStyle = slot === 'blink' ? '#ffe27a' : '#f0c84a';
    ctx.strokeStyle = '#2c241c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 16, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 16, y + 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawControls(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(0, 522, LOGICAL_W, LOGICAL_H - 522);
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(0, 522, LOGICAL_W, 6);

  drawSystemButton(ctx, 'pause', session.status === 'paused' ? 'RESUME' : 'PAUSE', ui, false);
  drawSystemButton(ctx, 'sound', ui.soundOn ? 'SOUND' : 'MUTED', ui, !ui.soundOn);
  drawSystemButton(ctx, 'haptic', ui.hapticOn ? 'BUZZ' : 'QUIET', ui, !ui.hapticOn);

  for (const lane of LANES) {
    const rect = CONTROLS[lane];
    const active = session.wolfLane === lane;
    const held = ui.heldControl === lane;
    drawButton(ctx, rect.x, rect.y + (held ? 2 : 0), rect.w, rect.h, LANE_COLOR[lane], active, held);
    const hint = LANE_HINT[lane];
    ctx.fillStyle = '#3b2418';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Verdana, sans-serif';
    ctx.fillText(hint.arrow, rect.x + rect.w / 2, rect.y + (held ? 24 : 22));
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.fillText(hint.name, rect.x + rect.w / 2, rect.y + (held ? 42 : 40));
    ctx.font = '10px Verdana, sans-serif';
    ctx.fillStyle = '#6a4630';
    ctx.fillText(hint.key, rect.x + rect.w / 2, rect.y + (held ? 56 : 54));
  }

  drawModeButton(ctx, 'gameA', 'A', '3 CHUTES', session, ui);
  drawModeButton(ctx, 'gameB', 'B', '4 CHUTES', session, ui);
}

function drawSystemButton(
  ctx: CanvasRenderingContext2D,
  id: 'pause' | 'sound' | 'haptic',
  label: string,
  ui: UiState,
  dim: boolean,
): void {
  const rect = CONTROLS[id];
  const held = ui.heldControl === id;
  ctx.fillStyle = dim ? '#4a3428' : '#6b3a28';
  roundRect(ctx, rect.x, rect.y + (held ? 1 : 0), rect.w, rect.h, 6);
  ctx.fill();
  ctx.strokeStyle = '#e6c48a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff4e4';
  ctx.font = 'bold 11px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (held ? 1 : 0));
  ctx.textBaseline = 'alphabetic';
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  active: boolean,
  held: boolean,
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x + 2, y + 3, w, h, 8);
  ctx.fill();
  ctx.fillStyle = held ? '#fff4e4' : active ? '#fff8ee' : '#f0d2b4';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = active ? color : '#6a4630';
  ctx.lineWidth = active ? 4 : 2;
  ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, x + 5, y + 5, w - 10, 6, 3);
  ctx.fill();
}

function drawModeButton(
  ctx: CanvasRenderingContext2D,
  id: 'gameA' | 'gameB',
  mode: 'A' | 'B',
  subtitle: string,
  session: Session,
  ui: UiState,
): void {
  const rect = CONTROLS[id];
  const selected = session.status !== 'menu' && session.mode === mode;
  const held = ui.heldControl === id;
  const y = rect.y + (held ? 2 : 0);
  ctx.fillStyle = selected ? '#8d2f24' : '#5c2a22';
  roundRect(ctx, rect.x, y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = ui.showRecord && held ? '#ffe08a' : '#f0c48a';
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff6e8';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillText(`GAME ${mode}`, rect.x + rect.w / 2, y + 28);
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillStyle = '#f0d0b0';
  ctx.fillText(subtitle, rect.x + rect.w / 2, y + 48);
}

function drawOverlay(ctx: CanvasRenderingContext2D, session: Session, ui: UiState): void {
  if (session.status === 'playing' && !session.notice) return;
  if (session.status === 'playing' && session.notice) {
    drawBanner(ctx, session.notice.text);
    return;
  }

  ctx.fillStyle = 'rgba(28, 16, 12, 0.72)';
  roundRect(ctx, 24, 86, 312, 300, 16);
  ctx.fill();
  ctx.strokeStyle = '#e6c48a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4d8';
  if (session.status === 'menu') {
    ctx.font = 'bold 26px Verdana, sans-serif';
    ctx.fillText('NU, POGODI!', 180, 130);
    ctx.font = 'bold 16px Verdana, sans-serif';
    ctx.fillStyle = '#f0c48a';
    ctx.fillText('WOLF AND EGGS', 180, 156);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = '#fff6e8';
    const lines = [
      'Catch eggs with the wolf.',
      'Three penalties end the run.',
      'Game A closes one chute.',
      'Game B uses all four.',
      'Hold GAME A or B to see the record.',
    ];
    lines.forEach((line, index) => ctx.fillText(line, 180, 196 + index * 20));
  } else if (session.status === 'paused') {
    ctx.font = 'bold 28px Verdana, sans-serif';
    ctx.fillText('PAUSED', 180, 180);
    ctx.font = '14px Verdana, sans-serif';
    ctx.fillText('Eggs stay where they are.', 180, 214);
    ctx.fillText('Press PAUSE to continue.', 180, 236);
  } else if (session.status === 'gameover') {
    ctx.font = 'bold 28px Verdana, sans-serif';
    ctx.fillText('GAME OVER', 180, 150);
    ctx.font = 'bold 18px Verdana, sans-serif';
    ctx.fillStyle = '#d6ff6a';
    ctx.fillText(`SCORE ${session.displayScore.toString().padStart(3, '0')}`, 180, 196);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(`BEST ${session.highScore.toString().padStart(3, '0')}`, 180, 224);
    ctx.fillStyle = '#fff6e8';
    ctx.font = '14px Verdana, sans-serif';
    ctx.fillText('Tap GAME A or GAME B', 180, 268);
    ctx.fillText('to play again.', 180, 288);
  }

  if (ui.showRecord && session.status === 'menu') {
    ctx.font = 'bold 14px Verdana, sans-serif';
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(`RECORD ${session.highScore.toString().padStart(3, '0')}`, 180, 360);
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.fillStyle = 'rgba(42, 22, 14, 0.88)';
  roundRect(ctx, 70, 78, 220, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 180, 99);
}
