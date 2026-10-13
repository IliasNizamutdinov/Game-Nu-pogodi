import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HARE, INPUT, SCORE, SPAWN, SPEED } from '../src/game/config';
import { stepHare, createHare } from '../src/game/hare';
import { activeLanes, inactiveLane } from '../src/game/lanes';
import { formatPenalty, penaltySlots } from '../src/game/penalties';
import { spawnIntervalFor, speedFor } from '../src/game/speed';
import type { LaneId } from '../src/game/types';

describe('speed curve', () => {
  it('starts slow and rises inside a hundred', () => {
    expect(speedFor(0)).toBeCloseTo(SPEED.initial, 6);
    expect(speedFor(50)).toBeGreaterThan(speedFor(0));
    expect(speedFor(50)).toBeLessThan(speedFor(99));
    for (let point = 0; point < 99; point += 1) {
      expect(speedFor(point + 1)).toBeGreaterThan(speedFor(point));
    }
  });

  it('dips at each hundred without returning to the opening speed', () => {
    for (let hundred = 0; hundred < 9; hundred += 1) {
      const before = speedFor(hundred * 100 + 99);
      const after = speedFor((hundred + 1) * 100);
      expect(after).toBeLessThan(before);
      expect(after).toBeGreaterThan(speedFor(0));
    }
  });

  it('eases off after 999 but stays much faster than the first egg', () => {
    expect(speedFor(1000)).toBeLessThan(speedFor(999));
    expect(speedFor(1000)).toBeGreaterThan(speedFor(0) * 1.8);
    expect(speedFor(1999)).toBeGreaterThan(speedFor(1000));
    expect(speedFor(2000)).toBeLessThan(speedFor(1999));
  });

  it('never jumps randomly and respects the cap', () => {
    expect(speedFor(240)).toBe(speedFor(240));
    expect(speedFor(999999)).toBeLessThanOrEqual(SPEED.max);
    expect(speedFor(999999)).toBe(SPEED.max);
  });

  it('tightens the spawn gap as speed rises', () => {
    expect(spawnIntervalFor(SPEED.initial)).toBeCloseTo(SPAWN.baseInterval, 5);
    expect(spawnIntervalFor(SPEED.initial * 3)).toBeLessThan(SPAWN.baseInterval);
    expect(spawnIntervalFor(10)).toBe(SPAWN.minInterval);
  });
});

describe('penalties and game A chutes', () => {
  it('formats half-points from integer units', () => {
    expect(formatPenalty(0)).toBe('0');
    expect(formatPenalty(1)).toBe('0.5');
    expect(formatPenalty(2)).toBe('1');
    expect(formatPenalty(3)).toBe('1.5');
    expect(formatPenalty(4)).toBe('2');
    expect(formatPenalty(5)).toBe('2.5');
    expect(formatPenalty(6)).toBe('3');
  });

  it('blinks only the fractional chick', () => {
    expect(penaltySlots(0)).toEqual(['empty', 'empty', 'empty']);
    expect(penaltySlots(1)).toEqual(['blink', 'empty', 'empty']);
    expect(penaltySlots(2)).toEqual(['solid', 'empty', 'empty']);
    expect(penaltySlots(3)).toEqual(['solid', 'blink', 'empty']);
    expect(penaltySlots(4)).toEqual(['solid', 'solid', 'empty']);
    expect(penaltySlots(5)).toEqual(['solid', 'solid', 'blink']);
    expect(penaltySlots(6)).toEqual(['solid', 'solid', 'solid']);
  });

  it('closes the chute required by the current penalty', () => {
    const table: Array<[number, LaneId]> = [
      [0, 'll'],
      [1, 'lr'],
      [2, 'lr'],
      [3, 'ul'],
      [4, 'ul'],
      [5, 'ur'],
    ];
    for (const [halves, lane] of table) {
      expect(inactiveLane('A', halves)).toBe(lane);
      const open = activeLanes('A', halves);
      expect(open).toHaveLength(3);
      expect(open).not.toContain(lane);
    }
  });

  it('uses all four chutes in game B', () => {
    expect(inactiveLane('B', 0)).toBeNull();
    expect(inactiveLane('B', 5)).toBeNull();
    expect(activeLanes('B', 4)).toEqual(['ul', 'ur', 'll', 'lr']);
  });
});

describe('hare clock', () => {
  it('toggles presence on a fixed interval', () => {
    const hare = createHare();
    expect(hare.present).toBe(false);
    stepHare(hare, HARE.hiddenSeconds - 0.01);
    expect(hare.present).toBe(false);
    stepHare(hare, 0.02);
    expect(hare.present).toBe(true);
    stepHare(hare, HARE.visibleSeconds);
    expect(hare.present).toBe(false);
  });
});

describe('project wiring', () => {
  it('publishes under the repository path', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    expect(config).toContain("base: '/Game-Nu-pogodi/'");
  });

  it('does not schedule gameplay with setInterval', () => {
    const root = join(process.cwd(), 'src');
    const readTree = (dir: string): string => {
      let text = '';
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) text += readTree(path);
        else if (path.endsWith('.ts')) text += readFileSync(path, 'utf8');
      }
      return text;
    };
    expect(readTree(root).includes('setInterval')).toBe(false);
  });

  it('keeps the documented score ceiling', () => {
    expect(SCORE.maxDisplay).toBe(999);
    expect(INPUT.maxFrameDt).toBeLessThan(0.1);
  });
});
