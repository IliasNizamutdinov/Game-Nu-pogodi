import { vibrate, Sfx } from './audio/sfx';
import { INPUT } from './game/config';
import { LOGICAL_H, LOGICAL_W } from './game/geometry';
import { computeLayout, type Insets } from './game/layout';
import { GameLoop } from './game/loop';
import {
  createSession,
  onVisibilityChange,
  setWolfLane,
  startGame,
  tick,
  togglePause,
  type Session,
} from './game/session';
import { loadHighScore, loadSettings, saveHighScore, saveSettings, type Settings } from './game/storage';
import {
  clientToLogical,
  controlToLane,
  hitTest,
  isHapticKey,
  isPauseKey,
  isSoundKey,
  laneFromKey,
  shouldShowRecord,
  shouldStartOnRelease,
} from './input/controls';
import { render, type UiState } from './render/renderer';
import type { GameMode } from './game/types';
import type { ControlId } from './game/geometry';
import './styles.css';

const canvasElement = document.querySelector<HTMLCanvasElement>('#game');
if (!canvasElement) throw new Error('Game canvas is missing');
const context = canvasElement.getContext('2d');
if (!context) throw new Error('Canvas 2D is unavailable');
const canvas: HTMLCanvasElement = canvasElement;
const ctx: CanvasRenderingContext2D = context;

const settings: Settings = loadSettings();
let savedHigh = loadHighScore();
const session: Session = createSession(savedHigh);
const sfx = new Sfx();
sfx.setEnabled(settings.soundOn);

const ui: UiState = {
  showRecord: false,
  soundOn: settings.soundOn,
  hapticOn: settings.hapticOn,
  heldControl: null,
  blinkOn: true,
};

interface Press {
  id: ControlId;
  x: number;
  y: number;
  started: number;
  timer: number;
  long: boolean;
  moved: boolean;
}

let press: Press | null = null;

function paint(): void {
  ui.blinkOn = Math.sin(performance.now() / 140) > 0;
  ui.soundOn = settings.soundOn;
  ui.hapticOn = settings.hapticOn;
  render(ctx, session, ui);
}

function consumeEvents(): void {
  for (const event of session.events) {
    if (event.type === 'catch') {
      sfx.play('catch');
      vibrate(12, settings.hapticOn);
    } else if (event.type === 'miss') {
      sfx.play('miss');
      vibrate(event.hare ? [12, 28, 18] : 22, settings.hapticOn);
    } else if (event.type === 'gameover') {
      sfx.play('gameover');
      vibrate([28, 36, 28, 36, 50], settings.hapticOn);
    } else if (event.type === 'reset-penalty') {
      sfx.play('reset');
    } else if (event.type === 'wrap') {
      sfx.play('wrap');
    }
  }
  session.events.length = 0;
  if (session.highScore !== savedHigh) {
    savedHigh = session.highScore;
    saveHighScore(savedHigh);
  }
}

function frame(dt: number): void {
  tick(session, dt);
  consumeEvents();
  paint();
}

const loop = new GameLoop(frame);

function beginGame(mode: GameMode): void {
  sfx.unlock();
  startGame(session, mode);
  requestGameFullscreen();
  loop.start();
}

function requestGameFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement) return;
  try {
    const pending = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
    if (pending && typeof (pending as Promise<void>).catch === 'function') {
      void (pending as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Fullscreen is a progressive enhancement. The board already fits the viewport.
  }
}

function readInsets(): Insets {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const style = getComputedStyle(probe);
  const px = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

function resize(): void {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const layout = computeLayout(width, height, readInsets());
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const viewScale = layout.drawW / LOGICAL_W;
  canvas.style.position = 'fixed';
  canvas.style.left = `${layout.offsetX}px`;
  canvas.style.top = `${layout.offsetY}px`;
  canvas.style.width = `${layout.drawW}px`;
  canvas.style.height = `${layout.drawH}px`;
  canvas.width = Math.max(1, Math.round(layout.drawW * dpr));
  canvas.height = Math.max(1, Math.round(layout.drawH * dpr));
  ctx.setTransform(dpr * viewScale, 0, 0, dpr * (layout.drawH / LOGICAL_H), 0, 0);
  paint();
}

function toggleSound(): void {
  settings.soundOn = !settings.soundOn;
  sfx.setEnabled(settings.soundOn);
  sfx.unlock();
  if (settings.soundOn) sfx.play('catch');
  saveSettings(settings);
  paint();
}

function toggleHaptic(): void {
  settings.hapticOn = !settings.hapticOn;
  saveSettings(settings);
  if (settings.hapticOn) vibrate(16, true);
  paint();
}

function clearPress(): void {
  if (press) window.clearTimeout(press.timer);
  press = null;
  ui.showRecord = false;
}

function pointerPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return clientToLogical(event.clientX, event.clientY, rect);
}

canvas.addEventListener('pointerdown', (event) => {
  sfx.unlock();
  const point = pointerPoint(event);
  const id = hitTest(point.x, point.y);
  if (!id) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  const lane = controlToLane(id);
  if (lane) {
    setWolfLane(session, lane);
    ui.heldControl = id;
    paint();
    return;
  }
  if (id === 'pause') {
    togglePause(session);
    ui.heldControl = id;
    paint();
    return;
  }
  if (id === 'sound') {
    ui.heldControl = id;
    toggleSound();
    return;
  }
  if (id === 'haptic') {
    ui.heldControl = id;
    toggleHaptic();
    return;
  }
  clearPress();
  ui.heldControl = id;
  press = {
    id,
    x: point.x,
    y: point.y,
    started: performance.now(),
    long: false,
    moved: false,
    timer: window.setTimeout(() => {
      if (!press) return;
      press.long = true;
      ui.showRecord = true;
      paint();
    }, INPUT.longPressMs),
  };
  paint();
});

canvas.addEventListener('pointermove', (event) => {
  const point = pointerPoint(event);
  const id = hitTest(point.x, point.y);
  if (id) {
    const lane = controlToLane(id);
    if (lane) setWolfLane(session, lane);
  }
  if (!press) return;
  const dx = point.x - press.x;
  const dy = point.y - press.y;
  if (dx * dx + dy * dy > INPUT.dragCancelPx * INPUT.dragCancelPx) {
    press.moved = true;
    ui.showRecord = false;
  }
});

function releasePress(event: PointerEvent): void {
  ui.heldControl = null;
  if (!press) {
    paint();
    return;
  }
  const held = performance.now() - press.started;
  const id = press.id;
  const moved = press.moved;
  const long = press.long || shouldShowRecord(held);
  clearPress();
  if (!long && shouldStartOnRelease(held, moved) && (id === 'gameA' || id === 'gameB')) {
    beginGame(id === 'gameA' ? 'A' : 'B');
  }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  paint();
}

canvas.addEventListener('pointerup', releasePress);
canvas.addEventListener('pointercancel', (event) => {
  ui.heldControl = null;
  clearPress();
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  paint();
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  const lane = laneFromKey(event.code);
  if (lane) {
    event.preventDefault();
    setWolfLane(session, lane);
    paint();
    return;
  }
  if (isPauseKey(event.code)) {
    event.preventDefault();
    togglePause(session);
    paint();
    return;
  }
  if (isSoundKey(event.code)) {
    event.preventDefault();
    sfx.unlock();
    toggleSound();
    return;
  }
  if (isHapticKey(event.code)) {
    event.preventDefault();
    toggleHaptic();
  }
});

document.addEventListener('visibilitychange', () => {
  onVisibilityChange(session, document.hidden);
  paint();
});

window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

resize();
loop.start();
paint();
