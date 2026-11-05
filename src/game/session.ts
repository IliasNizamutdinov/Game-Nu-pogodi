import { ANIM, BONUS, GRENADE, INPUT, PENALTY, SCORE, SPAWN } from './config';
import { LANES, catchPoint } from './geometry';
import { createHare, stepHare, type HareState } from './hare';
import { activeLanes, inactiveLane } from './lanes';
import { createRng } from './rng';
import { spawnIntervalFor, speedFor } from './speed';
import type { BonusColor, Difficulty, Egg, FallingKind, GameEvent, GameMode, LaneId, SessionStatus } from './types';

export interface Notice {
  text: string;
  until: number;
}

export interface Session {
  status: SessionStatus;
  mode: GameMode;
  /** Total catches across cycles. Display score is this value modulo 1000. */
  internalCaught: number;
  displayScore: number;
  highScore: number;
  /** Half-points. 1 = 0.5, 2 = 1, ... 6 = 3 and the run is over. */
  penaltyHalves: number;
  difficulty: Difficulty;
  wolfLane: LaneId;
  wolfVisual: { x: number; y: number };
  eggs: Egg[];
  nextEggId: number;
  hare: HareState;
  spawnTimer: number;
  time: number;
  catchPulse: number;
  notice: Notice | null;
  layPulse: Record<LaneId, number>;
  rng: () => number;
  grenadeRng: () => number;
  /** Ordinary eggs remaining before the next colored egg. */
  eggsUntilBonus: number;
  /** Points shown by the catch floater. */
  lastCatchPoints: number;
  events: GameEvent[];
}

export function createSession(highScore = 0): Session {
  const home = catchPoint('lr');
  const safeHigh = Number.isFinite(highScore) ? Math.min(SCORE.maxDisplay, Math.max(0, Math.floor(highScore))) : 0;
  return {
    status: 'menu',
    mode: 'A',
    internalCaught: 0,
    displayScore: 0,
    highScore: safeHigh,
    penaltyHalves: 0,
    difficulty: 'low',
    wolfLane: 'lr',
    wolfVisual: { x: home.x, y: home.y },
    eggs: [],
    nextEggId: 1,
    hare: createHare(),
    spawnTimer: 0,
    time: 0,
    catchPulse: 0,
    notice: null,
    layPulse: { ul: 0, ur: 0, ll: 0, lr: 0 },
    rng: createRng(0x4e5047),
    grenadeRng: createRng(0x6772656e),
    eggsUntilBonus: 6,
    lastCatchPoints: 1,
    events: [],
  };
}

function nextBonusGap(rng: () => number): number {
  const span = BONUS.maxInterval - BONUS.minInterval + 1;
  return BONUS.minInterval + Math.floor(rng() * span);
}

function nextBonusColor(rng: () => number): BonusColor {
  const index = Math.floor(rng() * BONUS.colors.length) % BONUS.colors.length;
  return BONUS.colors[index] ?? 'red';
}

/**
 * Starts a fresh run. The previous egg list, hare timer and spawner are replaced,
 * so pressing the mode button again cannot leave an older loop's state behind.
 * The saved record is kept.
 */
export function startGame(session: Session, mode: GameMode): void {
  const home = catchPoint('lr');
  session.status = 'playing';
  session.mode = mode;
  session.internalCaught = 0;
  session.displayScore = 0;
  session.penaltyHalves = 0;
  session.wolfLane = 'lr';
  session.wolfVisual = { x: home.x, y: home.y };
  session.eggs = [];
  session.nextEggId = 1;
  session.hare = createHare();
  session.time = 0;
  session.catchPulse = 0;
  session.notice = null;
  session.layPulse = { ul: 0, ur: 0, ll: 0, lr: 0 };
  session.rng = createRng(0x4e5047);
  session.grenadeRng = createRng(0x6772656e);
  session.eggsUntilBonus = nextBonusGap(session.grenadeRng);
  session.lastCatchPoints = 1;
  session.events = [];
  const interval = spawnIntervalFor(speedFor(0, session.difficulty));
  session.spawnTimer = interval - SPAWN.firstEggDelay;
}

export function togglePause(session: Session): void {
  if (session.status === 'playing') session.status = 'paused';
  else if (session.status === 'paused') session.status = 'playing';
}

/** Tab hide / browser background. Coming back stays paused so missed time is not simulated. */
export function onVisibilityChange(session: Session, hidden: boolean): void {
  if (hidden && session.status === 'playing') session.status = 'paused';
}

/**
 * Logical lane changes immediately. Fast taps keep the latest lane; the sprite
 * eases toward it and does not have to visit every in-between position.
 */
export function setWolfLane(session: Session, lane: LaneId): void {
  session.wolfLane = lane;
}

const DIFFICULTY_ORDER: Difficulty[] = ['low', 'medium', 'high'];

export function cycleDifficulty(session: Session): Difficulty {
  const index = DIFFICULTY_ORDER.indexOf(session.difficulty);
  const next = DIFFICULTY_ORDER[(index + 1) % DIFFICULTY_ORDER.length] ?? 'low';
  session.difficulty = next;
  return next;
}

export function canSpawnOnLane(session: Session, lane: LaneId): boolean {
  if (session.status !== 'playing') return false;
  if (inactiveLane(session.mode, session.penaltyHalves) === lane) return false;
  const moving = session.eggs.filter((egg) => egg.state === 'moving');
  if (moving.length >= SPAWN.maxMoving) return false;
  if (moving.some((egg) => egg.lane === lane && egg.progress < SPAWN.minGap)) return false;
  return true;
}

export function spawnEgg(
  session: Session,
  lane: LaneId,
  options?: { force?: boolean; kind?: FallingKind; bonus?: BonusColor | null },
): Egg | null {
  if (session.status !== 'playing') return null;
  if (!options?.force && !canSpawnOnLane(session, lane)) return null;
  const kind = options?.kind ?? 'egg';
  const egg: Egg = {
    id: session.nextEggId,
    lane,
    progress: 0.02,
    state: 'moving',
    animTime: 0,
    hareWasPresent: false,
    kind,
    bonus: kind === 'egg' ? (options?.bonus ?? null) : null,
  };
  session.nextEggId += 1;
  session.eggs.push(egg);
  session.layPulse[lane] = ANIM.lay;
  return egg;
}

export function trySpawn(session: Session): boolean {
  const lanes = activeLanes(session.mode, session.penaltyHalves);
  if (lanes.length === 0) return false;
  const start = Math.floor(session.rng() * lanes.length) % lanes.length;
  for (let i = 0; i < lanes.length; i += 1) {
    const lane = lanes[(start + i) % lanes.length];
    if (!lane) continue;
    if (canSpawnOnLane(session, lane)) {
      const chance = GRENADE.chance[session.difficulty];
      const kind: FallingKind = session.grenadeRng() < chance ? 'grenade' : 'egg';
      let bonus: BonusColor | null = null;
      if (kind === 'egg') {
        session.eggsUntilBonus -= 1;
        if (session.eggsUntilBonus <= 0) {
          bonus = nextBonusColor(session.grenadeRng);
          session.eggsUntilBonus = nextBonusGap(session.grenadeRng);
        }
      }
      return spawnEgg(session, lane, { kind, bonus }) !== null;
    }
  }
  return false;
}

function animDuration(egg: Egg): number {
  if (egg.state === 'caught') return ANIM.catch;
  if (egg.state === 'exploded') return ANIM.explode;
  if (egg.state === 'missed') return egg.hareWasPresent ? ANIM.missWithChick : ANIM.miss;
  return Number.POSITIVE_INFINITY;
}

function removeFinishedEggs(session: Session): void {
  session.eggs = session.eggs.filter((egg) => egg.state === 'moving' || egg.animTime < animDuration(egg));
}

function stepWolfVisual(session: Session, dt: number): void {
  const target = catchPoint(session.wolfLane);
  const gain = 1 - Math.exp(-ANIM.wolfLerp * dt);
  session.wolfVisual.x += (target.x - session.wolfVisual.x) * gain;
  session.wolfVisual.y += (target.y - session.wolfVisual.y) * gain;
}

function applyCatch(session: Session, points: number): void {
  const prev = session.displayScore;
  const prevCycle = Math.floor(session.internalCaught / (SCORE.maxDisplay + 1));
  session.internalCaught += points;
  session.displayScore = session.internalCaught % (SCORE.maxDisplay + 1);
  session.lastCatchPoints = points;
  const wrapped = Math.floor(session.internalCaught / (SCORE.maxDisplay + 1)) > prevCycle;

  if (wrapped) {
    session.highScore = Math.max(session.highScore, SCORE.maxDisplay);
    session.events.push({ type: 'wrap' });
    session.notice = { text: 'NEXT ROUND', until: session.time + ANIM.notice };
  } else if (session.displayScore > session.highScore) {
    session.highScore = Math.min(SCORE.maxDisplay, session.displayScore);
  }

  // Crossing 999 does not clear penalties. 200 and 500 do, once per cycle.
  if (wrapped) return;
  let reset = false;
  if (prev < 200 && session.displayScore >= 200) reset = true;
  if (prev < 500 && session.displayScore >= 500) reset = true;
  if (!reset) return;
  if (session.penaltyHalves !== 0) {
    session.events.push({ type: 'reset-penalty' });
    session.notice = { text: 'PENALTIES CLEARED', until: session.time + ANIM.notice };
  }
  session.penaltyHalves = 0;
}

function applyMiss(session: Session): boolean {
  const add = session.hare.present ? PENALTY.halvesPerMissWithHare : PENALTY.halvesPerMiss;
  session.penaltyHalves = Math.min(PENALTY.gameOverHalves, session.penaltyHalves + add);
  return session.penaltyHalves >= PENALTY.gameOverHalves;
}

function endGame(session: Session): void {
  if (session.status === 'gameover') return;
  session.status = 'gameover';
  session.spawnTimer = 0;
  session.events.push({ type: 'gameover' });
}

/**
 * An egg is resolved once. The wolf's logical lane, not the sprite position,
 * decides the catch. Hare presence is the flag at the start of this step.
 */
function resolveEgg(session: Session, egg: Egg): void {
  if (egg.state !== 'moving' || session.status !== 'playing') return;
  const caught = session.wolfLane === egg.lane;
  if (egg.kind === 'grenade') {
    egg.animTime = 0;
    egg.hareWasPresent = false;
    if (!caught) {
      egg.state = 'missed';
      return;
    }
    egg.state = 'exploded';
    const fatal = session.difficulty === 'high';
    session.events.push({ type: 'explode', fatal });
    if (fatal) {
      endGame(session);
      return;
    }
    session.penaltyHalves = Math.min(PENALTY.gameOverHalves, session.penaltyHalves + PENALTY.halvesPerMiss);
    session.notice = { text: 'LIFE LOST', until: session.time + ANIM.notice };
    if (session.penaltyHalves >= PENALTY.gameOverHalves) endGame(session);
    return;
  }
  if (caught) {
    egg.state = 'caught';
    egg.animTime = 0;
    egg.hareWasPresent = false;
    applyCatch(session, egg.bonus ? BONUS.points : 1);
    session.catchPulse = ANIM.catchPulse;
    session.events.push({ type: 'catch' });
    return;
  }
  egg.state = 'missed';
  egg.animTime = 0;
  egg.hareWasPresent = session.hare.present;
  session.events.push({ type: 'miss', hare: egg.hareWasPresent });
  if (applyMiss(session)) endGame(session);
}

export function tick(session: Session, dtSeconds: number): void {
  const dt = Math.min(INPUT.maxFrameDt, Math.max(0, dtSeconds));
  if (dt === 0) return;

  if (session.status === 'gameover') {
    for (const egg of session.eggs) {
      if (egg.state !== 'moving') egg.animTime += dt;
    }
    removeFinishedEggs(session);
    return;
  }

  if (session.status !== 'playing') return;

  session.time += dt;
  const speed = speedFor(session.internalCaught, session.difficulty);

  for (const egg of session.eggs) {
    if (session.status !== 'playing') break;
    if (egg.state !== 'moving') {
      egg.animTime += dt;
      continue;
    }
    const bonusFactor = egg.bonus ? BONUS.speedFactor : 1;
    egg.progress += speed * bonusFactor * dt;
    if (egg.progress >= 1) {
      egg.progress = 1;
      resolveEgg(session, egg);
    }
  }

  if (session.status === 'playing') {
    // Hare advances after resolutions, so an egg that arrives this frame still
    // sees the hare that was already in the window.
    stepHare(session.hare, dt);
    for (const lane of LANES) {
      session.layPulse[lane] = Math.max(0, session.layPulse[lane] - dt);
    }
    stepWolfVisual(session, dt);
    session.catchPulse = Math.max(0, session.catchPulse - dt);
    if (session.notice && session.time >= session.notice.until) session.notice = null;

    const interval = spawnIntervalFor(speed);
    session.spawnTimer += dt;
    let guard = 0;
    while (session.spawnTimer >= interval && guard < 3 && session.status === 'playing') {
      session.spawnTimer -= interval;
      trySpawn(session);
      guard += 1;
    }
  }

  removeFinishedEggs(session);
}
