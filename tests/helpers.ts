import { setWolfLane, spawnEgg, tick, type Session } from '../src/game/session';
import type { LaneId } from '../src/game/types';

export function advance(session: Session, seconds: number): void {
  let left = seconds;
  const step = 1 / 60;
  while (left > 1e-8) {
    const dt = Math.min(step, left);
    tick(session, dt);
    left -= dt;
  }
}

function scriptedEgg(session: Session, lane: LaneId): void {
  session.spawnTimer = -1e9;
  const egg = spawnEgg(session, lane, { force: true });
  if (!egg) throw new Error(`expected an egg on ${lane}`);
  egg.progress = 0.999;
  tick(session, 1 / 60);
}

export function catchLane(session: Session, lane: LaneId): void {
  setWolfLane(session, lane);
  scriptedEgg(session, lane);
}

export function missLane(session: Session, lane: LaneId): void {
  setWolfLane(session, lane === 'ul' ? 'lr' : 'ul');
  scriptedEgg(session, lane);
}
