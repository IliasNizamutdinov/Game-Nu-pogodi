import { describe, expect, it } from 'vitest';
import { HARE, INPUT } from '../src/game/config';
import { catchPoint } from '../src/game/geometry';
import { inactiveLane } from '../src/game/lanes';
import { GameLoop } from '../src/game/loop';
import { formatPenalty } from '../src/game/penalties';
import {
  canSpawnOnLane,
  createSession,
  cycleDifficulty,
  onVisibilityChange,
  setWolfLane,
  spawnEgg,
  startGame,
  tick,
  togglePause,
  trySpawn,
} from '../src/game/session';
import { speedFor } from '../src/game/speed';
import type { Egg, LaneId } from '../src/game/types';
import { advance, catchLane, missLane } from './helpers';

function playing() {
  const session = createSession(0);
  startGame(session, 'B');
  session.spawnTimer = -1e9;
  return session;
}

describe('catching eggs', () => {
  it('adds exactly one point and cannot score the same egg twice', () => {
    const session = playing();
    catchLane(session, 'ul');
    expect(session.displayScore).toBe(1);
    expect(session.internalCaught).toBe(1);
    expect(session.penaltyHalves).toBe(0);
    expect(session.events.filter((event) => event.type === 'catch')).toHaveLength(1);
    const caught = session.eggs.find((egg) => egg.state === 'caught');
    expect(caught).toBeDefined();
    session.spawnTimer = -1e9;
    advance(session, 2);
    expect(session.displayScore).toBe(1);
    expect(session.eggs.some((egg) => egg.id === caught?.id)).toBe(false);
  });

  it('uses the logical lane immediately, before the sprite arrives', () => {
    const session = playing();
    const home = catchPoint('lr');
    expect(session.wolfVisual.x).toBeCloseTo(home.x, 5);
    setWolfLane(session, 'ul');
    setWolfLane(session, 'lr');
    setWolfLane(session, 'ur');
    expect(session.wolfLane).toBe('ur');
    const egg = spawnEgg(session, 'ur', { force: true });
    if (!egg) throw new Error('egg missing');
    egg.progress = 0.999;
    tick(session, 1 / 60);
    expect(egg.state).toBe('caught');
    expect(session.displayScore).toBe(1);
    expect(session.wolfVisual.x).not.toBeCloseTo(catchPoint('ur').x, 0);
  });

  it('does not also count a catch as a miss', () => {
    const session = playing();
    catchLane(session, 'll');
    expect(session.displayScore).toBe(1);
    expect(session.penaltyHalves).toBe(0);
    expect(session.eggs.filter((egg) => egg.state === 'caught')).toHaveLength(1);
    expect(session.eggs.some((egg) => egg.state === 'missed')).toBe(false);
  });
});

describe('misses and the hare', () => {
  it('adds one penalty point when the hare is away', () => {
    const session = playing();
    expect(session.hare.present).toBe(false);
    missLane(session, 'ur');
    expect(session.displayScore).toBe(0);
    expect(session.penaltyHalves).toBe(2);
    expect(formatPenalty(session.penaltyHalves)).toBe('1');
    const missed = session.eggs.find((egg) => egg.state === 'missed');
    expect(missed?.hareWasPresent).toBe(false);
  });

  it('adds half a penalty and remembers the hare when it is in the window', () => {
    const session = playing();
    session.hare.present = true;
    session.hare.timer = HARE.visibleSeconds - 0.001;
    missLane(session, 'ul');
    expect(session.penaltyHalves).toBe(1);
    expect(formatPenalty(session.penaltyHalves)).toBe('0.5');
    expect(session.eggs.some((egg) => egg.state === 'missed' && egg.hareWasPresent)).toBe(true);
    expect(session.hare.present).toBe(false);
    expect(session.status).toBe('playing');
  });

  it('ends the run at three penalty points and then ignores further eggs', () => {
    const session = playing();
    missLane(session, 'ul');
    missLane(session, 'ur');
    expect(session.status).toBe('playing');
    missLane(session, 'll');
    expect(session.penaltyHalves).toBe(6);
    expect(session.status).toBe('gameover');
    expect(session.events.filter((event) => event.type === 'gameover')).toHaveLength(1);
    const score = session.displayScore;
    session.eggs.push({
      id: 500,
      lane: 'lr',
      progress: 0.99,
      state: 'moving',
      animTime: 0,
      hareWasPresent: false,
      kind: 'egg',
      bonus: null,
    });
    advance(session, 3);
    expect(session.status).toBe('gameover');
    expect(session.displayScore).toBe(score);
    expect(session.penaltyHalves).toBe(6);
    expect(session.eggs.find((egg) => egg.id === 500)?.state).toBe('moving');
    expect(session.eggs.find((egg) => egg.id === 500)?.progress).toBe(0.99);
    expect(spawnEgg(session, 'ul', { force: true })).toBeNull();
    expect(session.events.filter((event) => event.type === 'gameover')).toHaveLength(1);
  });

  it('reaches game over on the sixth half-penalty and not before', () => {
    const session = playing();
    session.hare.present = true;
    for (let i = 0; i < 5; i += 1) {
      session.hare.present = true;
      missLane(session, i % 2 === 0 ? 'ul' : 'lr');
      expect(session.status).toBe('playing');
    }
    expect(session.penaltyHalves).toBe(5);
    session.hare.present = true;
    missLane(session, 'ur');
    expect(session.penaltyHalves).toBe(6);
    expect(session.status).toBe('gameover');
  });
});

describe('score thresholds and rollover', () => {
  it('clears penalties once at 200 and again at 500', () => {
    const session = createSession(0);
    startGame(session, 'A');
    session.spawnTimer = -1e9;
    session.internalCaught = 199;
    session.displayScore = 199;
    session.penaltyHalves = 4;
    catchLane(session, 'ul');
    expect(session.displayScore).toBe(200);
    expect(session.penaltyHalves).toBe(0);
    expect(inactiveLane(session.mode, session.penaltyHalves)).toBe('ll');
    session.penaltyHalves = 2;
    catchLane(session, 'ur');
    expect(session.displayScore).toBe(201);
    expect(session.penaltyHalves).toBe(2);

    session.internalCaught = 499;
    session.displayScore = 499;
    session.penaltyHalves = 5;
    catchLane(session, 'll');
    expect(session.displayScore).toBe(500);
    expect(session.penaltyHalves).toBe(0);
  });

  it('clears penalties again at 200 of the next cycle', () => {
    const session = playing();
    session.internalCaught = 1000;
    session.displayScore = 0;
    session.penaltyHalves = 4;
    for (let i = 0; i < 200; i += 1) catchLane(session, 'ul');
    expect(session.displayScore).toBe(200);
    expect(session.internalCaught).toBe(1200);
    expect(session.penaltyHalves).toBe(0);
  });

  it('rolls 999 over to 0 without clearing penalties or the record', () => {
    const session = playing();
    session.internalCaught = 998;
    session.displayScore = 998;
    session.highScore = 10;
    session.penaltyHalves = 4;
    catchLane(session, 'ul');
    expect(session.displayScore).toBe(999);
    expect(session.highScore).toBe(999);
    expect(session.penaltyHalves).toBe(4);
    const before = speedFor(999);
    catchLane(session, 'ur');
    expect(session.displayScore).toBe(0);
    expect(session.internalCaught).toBe(1000);
    expect(session.penaltyHalves).toBe(4);
    expect(session.highScore).toBe(999);
    expect(session.status).toBe('playing');
    expect(speedFor(session.internalCaught)).toBeLessThan(before);
    expect(speedFor(session.internalCaught)).toBeGreaterThan(speedFor(0) * 1.8);
    expect(session.events.some((event) => event.type === 'wrap')).toBe(true);
  });

  it('keeps the record when a new run scores less', () => {
    const session = playing();
    for (let i = 0; i < 5; i += 1) catchLane(session, 'll');
    expect(session.highScore).toBe(5);
    startGame(session, 'A');
    expect(session.highScore).toBe(5);
    expect(session.displayScore).toBe(0);
    expect(session.penaltyHalves).toBe(0);
    catchLane(session, 'ur');
    catchLane(session, 'ur');
    expect(session.displayScore).toBe(2);
    expect(session.highScore).toBe(5);
  });
});

describe('modes, pause and the frame cap', () => {
  it('refuses new eggs on the chute game A is closing', () => {
    const session = createSession(0);
    startGame(session, 'A');
    session.spawnTimer = -1e9;
    expect(inactiveLane('A', 0)).toBe('ll');
    expect(spawnEgg(session, 'll')).toBeNull();
    const traveling = spawnEgg(session, 'lr');
    expect(traveling).not.toBeNull();
    if (!traveling) return;
    traveling.progress = 0.25;
    missLane(session, 'ul');
    expect(session.penaltyHalves).toBe(2);
    expect(inactiveLane(session.mode, session.penaltyHalves)).toBe('ll');
    expect(traveling.state).toBe('moving');
    expect(traveling.lane).toBe('lr');
    const progress = traveling.progress;
    tick(session, 1 / 60);
    expect(traveling.progress).toBeGreaterThan(progress);
    expect(traveling.lane).toBe('lr');
    expect(canSpawnOnLane(session, 'll')).toBe(false);
    expect(spawnEgg(session, 'll')).toBeNull();
    traveling.progress = 0.6;
    expect(canSpawnOnLane(session, 'lr')).toBe(true);
    expect(spawnEgg(session, 'lr')?.lane).toBe('lr');
  });

  it('spawns on every chute in game B and only the open ones in game A', () => {
    const gameB = createSession(0);
    startGame(gameB, 'B');
    let index = 0;
    const sequence = [0, 0.25, 0.5, 0.75];
    gameB.rng = () => sequence[index++] ?? 0;
    for (let i = 0; i < 4; i += 1) expect(trySpawn(gameB)).toBe(true);
    expect(new Set(gameB.eggs.map((egg) => egg.lane))).toEqual(new Set(['ul', 'ur', 'll', 'lr']));

    const gameA = createSession(0);
    startGame(gameA, 'A');
    gameA.rng = () => 0;
    const seen = new Set<LaneId>();
    for (let i = 0; i < 6 && trySpawn(gameA); i += 1) {
      const egg = gameA.eggs[gameA.eggs.length - 1];
      if (egg) seen.add(egg.lane);
    }
    expect(seen).toEqual(new Set(['ul', 'ur', 'lr']));
    expect(gameA.eggs.some((egg) => egg.lane === 'll')).toBe(false);
  });

  it('replaces the previous run instead of stacking spawners', () => {
    const session = createSession(40);
    startGame(session, 'A');
    advance(session, 0.6);
    expect(session.eggs.length).toBe(1);
    startGame(session, 'A');
    startGame(session, 'B');
    expect(session.mode).toBe('B');
    expect(session.eggs).toHaveLength(0);
    expect(session.displayScore).toBe(0);
    expect(session.penaltyHalves).toBe(0);
    expect(session.hare.present).toBe(false);
    expect(session.highScore).toBe(40);
    advance(session, 0.6);
    expect(session.eggs.filter((egg) => egg.state === 'moving')).toHaveLength(1);
  });

  it('freezes movement, the hare and spawning while paused', () => {
    const session = createSession(0);
    startGame(session, 'B');
    advance(session, 0.2);
    expect(session.eggs).toHaveLength(0);
    togglePause(session);
    const egg = spawnEgg(session, 'ul', { force: true });
    expect(egg).toBeNull();
    session.eggs.push({
      id: 7,
      lane: 'ul',
      progress: 0.2,
      state: 'moving',
      animTime: 0,
      hareWasPresent: false,
      kind: 'egg',
      bonus: null,
    });
    const timer = session.hare.timer;
    advance(session, 2);
    expect(session.status).toBe('paused');
    expect(session.eggs.find((item) => item.id === 7)?.progress).toBe(0.2);
    expect(session.hare.timer).toBe(timer);
    expect(session.displayScore).toBe(0);
    togglePause(session);
    expect(session.status).toBe('playing');
  });

  it('pauses when the page is hidden and does not fast-forward a stalled frame', () => {
    const session = playing();
    const egg = spawnEgg(session, 'll', { force: true });
    if (!egg) throw new Error('egg missing');
    const progress = egg.progress;
    onVisibilityChange(session, true);
    expect(session.status).toBe('paused');
    tick(session, 10);
    expect(egg.progress).toBe(progress);

    togglePause(session);
    session.spawnTimer = -1e9;
    tick(session, 10);
    expect(egg.progress - progress).toBeCloseTo(speedFor(0) * INPUT.maxFrameDt, 5);
  });

  it('lets a careful player through the opening and defeats a wolf that never moves', () => {
    const careful = createSession(0);
    startGame(careful, 'B');
    const frames = 40 * 60;
    for (let i = 0; i < frames && careful.status === 'playing'; i += 1) {
      let best: Egg | null = null;
      for (const egg of careful.eggs) {
        if (egg.state === 'moving' && egg.kind === 'egg' && (!best || egg.progress > best.progress)) best = egg;
      }
      if (best) setWolfLane(careful, best.lane);
      else if (careful.eggs.some((egg) => egg.state === 'moving' && egg.kind === 'grenade')) {
        setWolfLane(careful, 'ul');
      }
      tick(careful, 1 / 60);
    }
    expect(careful.displayScore).toBeGreaterThan(12);
    expect(careful.status).toBe('playing');

    const still = createSession(0);
    startGame(still, 'B');
    setWolfLane(still, 'lr');
    advance(still, 40);
    expect(still.status).toBe('gameover');
    expect(still.penaltyHalves).toBeGreaterThanOrEqual(6);
  });
});

describe('grenades and difficulty', () => {
  it('lets a missed grenade fall without a penalty and explodes a caught one', () => {
    const session = playing();
    session.difficulty = 'low';
    setWolfLane(session, 'lr');
    const missed = spawnEgg(session, 'ul', { force: true, kind: 'grenade' });
    if (!missed) throw new Error('grenade missing');
    missed.progress = 0.999;
    tick(session, 1 / 60);
    expect(missed.state).toBe('missed');
    expect(session.penaltyHalves).toBe(0);
    expect(session.displayScore).toBe(0);

    setWolfLane(session, 'ur');
    const caught = spawnEgg(session, 'ur', { force: true, kind: 'grenade' });
    if (!caught) throw new Error('grenade missing');
    caught.progress = 0.999;
    tick(session, 1 / 60);
    expect(caught.state).toBe('exploded');
    expect(session.displayScore).toBe(0);
    expect(session.penaltyHalves).toBe(2);
    expect(session.status).toBe('playing');
  });

  it('ends the game at once when a grenade is caught on high speed', () => {
    const session = playing();
    session.difficulty = 'high';
    const caught = spawnEgg(session, 'll', { force: true, kind: 'grenade' });
    if (!caught) throw new Error('grenade missing');
    setWolfLane(session, 'll');
    caught.progress = 0.999;
    tick(session, 1 / 60);
    expect(session.status).toBe('gameover');
    expect(session.displayScore).toBe(0);
  });

  it('keeps the chosen difficulty across a new run and speeds the eggs up', () => {
    const session = playing();
    cycleDifficulty(session);
    expect(session.difficulty).toBe('medium');
    const faster = speedFor(0, 'medium');
    expect(faster).toBeGreaterThan(speedFor(0, 'low'));
    expect(speedFor(40, 'low')).toBeGreaterThan(speedFor(0, 'low'));
    startGame(session, 'B');
    expect(session.difficulty).toBe('medium');
    expect(speedFor(0, 'high')).toBeGreaterThan(faster);
  });
});

describe('special eggs', () => {
  it('awards five points for a colored egg and rolls it faster than a plain egg', () => {
    const session = playing();
    const plain = spawnEgg(session, 'ul', { force: true });
    const colored = spawnEgg(session, 'ur', { force: true, bonus: 'red' });
    const gold = spawnEgg(session, 'll', { force: true, bonus: 'gold' });
    if (!plain || !colored || !gold) throw new Error('egg missing');
    plain.progress = 0.2;
    colored.progress = 0.2;
    gold.progress = 0.2;
    session.spawnTimer = -1e9;
    tick(session, 1 / 60);
    expect(colored.progress - 0.2).toBeGreaterThan(plain.progress - 0.2);
    expect(gold.progress).toBeCloseTo(plain.progress, 5);
    setWolfLane(session, 'ur');
    colored.progress = 0.999;
    tick(session, 1 / 60);
    expect(session.displayScore).toBe(5);
    expect(colored.state).toBe('caught');
    expect(session.lastCatchLabel).toBe('+5');
  });

  it('turns one ordinary egg in every five to seven into a colored egg', () => {
    const session = playing();
    session.grenadeRng = () => 0.99;
    session.eggsUntilBonus = 1;
    expect(trySpawn(session)).toBe(true);
    const spawned = session.eggs[session.eggs.length - 1];
    expect(spawned?.kind).toBe('egg');
    expect(spawned?.bonus === 'red' || spawned?.bonus === 'blue' || spawned?.bonus === 'green').toBe(true);
    expect(session.eggsUntilBonus).toBeGreaterThanOrEqual(5);
    expect(session.eggsUntilBonus).toBeLessThanOrEqual(7);
  });

  it('turns every tenth plain egg into a golden egg worth ten points', () => {
    const session = playing();
    session.grenadeRng = () => 0.99;
    session.eggsUntilBonus = 20;
    session.eggsUntilBlack = 20;
    session.eggsUntilGold = 1;
    expect(trySpawn(session)).toBe(true);
    const spawned = session.eggs[session.eggs.length - 1];
    expect(spawned?.bonus).toBe('gold');
    expect(session.eggsUntilGold).toBe(10);
    if (!spawned) throw new Error('gold missing');
    setWolfLane(session, spawned.lane);
    spawned.progress = 0.999;
    tick(session, 1 / 60);
    expect(session.displayScore).toBe(10);
    expect(session.lastCatchLabel).toBe('+10');
  });

  it('halves the current score when the black egg is caught and leaves penalties', () => {
    const session = playing();
    session.internalCaught = 21;
    session.displayScore = 21;
    session.highScore = 40;
    session.penaltyHalves = 2;
    const black = spawnEgg(session, 'ul', { force: true, bonus: 'black' });
    if (!black) throw new Error('black missing');
    setWolfLane(session, 'ul');
    black.progress = 0.999;
    tick(session, 1 / 60);
    expect(black.state).toBe('caught');
    expect(session.displayScore).toBe(10);
    expect(session.internalCaught).toBe(10);
    expect(session.penaltyHalves).toBe(2);
    expect(session.highScore).toBe(40);
    expect(session.lastCatchLabel).toBe('1/2');
  });

  it('schedules a black egg without counting grenades or colored eggs', () => {
    const session = playing();
    session.grenadeRng = () => 0.99;
    session.eggsUntilBonus = 20;
    session.eggsUntilGold = 20;
    session.eggsUntilBlack = 1;
    expect(trySpawn(session)).toBe(true);
    expect(session.eggs[session.eggs.length - 1]?.bonus).toBe('black');
    expect(session.eggsUntilBlack).toBe(12);
  });
});

describe('animation loop', () => {
  it('ignores a second start while the loop is running', () => {
    let frames = 0;
    let requests = 0;
    const scheduled: { run: ((timeMs: number) => void) | null } = { run: null };
    const loop = new GameLoop(
      () => {
        frames += 1;
      },
      (callback) => {
        requests += 1;
        scheduled.run = callback;
        return requests;
      },
      () => undefined,
    );
    loop.start();
    loop.start();
    loop.start();
    expect(loop.isRunning).toBe(true);
    expect(requests).toBe(1);
    scheduled.run?.(1000);
    expect(frames).toBe(1);
    expect(requests).toBe(2);
    loop.stop();
    scheduled.run?.(1160);
    expect(frames).toBe(1);
    expect(loop.isRunning).toBe(false);
  });
});
