import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, startGame } from '../src/game/session';
import {
  loadHighScore,
  loadSettings,
  parseHighScore,
  saveHighScore,
  saveSettings,
} from '../src/game/storage';
import { catchLane } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saved record', () => {
  it('round-trips a record and ignores corrupt values', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });

    expect(loadHighScore()).toBe(0);
    saveHighScore(42);
    expect(loadHighScore()).toBe(42);
    saveHighScore(1500);
    expect(loadHighScore()).toBe(999);
    memory.set('nu-pogodi-high-score', 'nope');
    expect(loadHighScore()).toBe(0);
    memory.set('nu-pogodi-high-score', '-4');
    expect(loadHighScore()).toBe(0);
    expect(parseHighScore('10.9')).toBe(10);

    saveSettings({ soundOn: false, hapticOn: false });
    expect(loadSettings()).toEqual({ soundOn: false, hapticOn: false });
    memory.set('nu-pogodi-settings', '{');
    expect(loadSettings()).toEqual({ soundOn: true, hapticOn: true });
  });

  it('keeps playing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadHighScore()).toBe(0);
    expect(() => saveHighScore(20)).not.toThrow();
    expect(loadSettings().soundOn).toBe(true);

    const session = createSession(loadHighScore());
    startGame(session, 'A');
    catchLane(session, 'ul');
    expect(session.displayScore).toBe(1);
    expect(() => saveHighScore(session.highScore)).not.toThrow();
  });

  it('reloads the record into a new session', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    const first = createSession(loadHighScore());
    startGame(first, 'B');
    first.internalCaught = 998;
    first.displayScore = 998;
    catchLane(first, 'ul');
    saveHighScore(first.highScore);
    const second = createSession(loadHighScore());
    expect(second.highScore).toBe(999);
    startGame(second, 'A');
    expect(second.highScore).toBe(999);
    expect(second.displayScore).toBe(0);
  });
});
