import type { Difficulty } from './types';

const HIGH_SCORE_KEY = 'nu-pogodi-high-score';
const SETTINGS_KEY = 'nu-pogodi-settings';

export interface Settings {
  soundOn: boolean;
  hapticOn: boolean;
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = {
  soundOn: true,
  hapticOn: true,
  difficulty: 'low',
};

function parseDifficulty(value: unknown): Difficulty {
  return value === 'medium' || value === 'high' || value === 'low' ? value : 'low';
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__nu_pogodi_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function loadHighScore(): number {
  const storage = getStorage();
  if (!storage) return 0;
  try {
    return parseHighScore(storage.getItem(HIGH_SCORE_KEY));
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const safe = parseHighScore(String(score));
    storage.setItem(HIGH_SCORE_KEY, String(safe));
  } catch {
    // Private mode or a full disk should not stop the current run.
  }
}

export function parseHighScore(raw: string | null): number {
  if (raw === null) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(999, Math.floor(value));
}

export function loadSettings(): Settings {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const record = parsed as Partial<Settings>;
    return {
      soundOn: typeof record.soundOn === 'boolean' ? record.soundOn : DEFAULT_SETTINGS.soundOn,
      hapticOn: typeof record.hapticOn === 'boolean' ? record.hapticOn : DEFAULT_SETTINGS.hapticOn,
      difficulty: parseDifficulty(record.difficulty),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        soundOn: settings.soundOn,
        hapticOn: settings.hapticOn,
        difficulty: parseDifficulty(settings.difficulty),
      }),
    );
  } catch {
    // Ignore quota and privacy errors.
  }
}
