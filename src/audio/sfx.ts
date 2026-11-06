type Tone = 'catch' | 'miss' | 'gameover' | 'reset' | 'wrap' | 'explode';

/**
 * Short synthesized effects. No external audio files are required,
 * so the installed PWA can play them offline.
 */
export class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.22 : 0;
  }

  unlock(): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.context) {
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.22 : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  play(tone: Tone): void {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
    if (tone === 'catch') {
      this.beep(880, now, 0.07, 'square');
      this.beep(1320, now + 0.06, 0.08, 'square');
    } else if (tone === 'miss') {
      this.beep(240, now, 0.12, 'sawtooth');
      this.beep(110, now + 0.08, 0.16, 'triangle');
    } else if (tone === 'gameover') {
      [520, 390, 280, 160].forEach((freq, index) => this.beep(freq, now + index * 0.14, 0.16, 'square'));
    } else if (tone === 'explode') {
      this.beep(140, now, 0.18, 'sawtooth');
      this.beep(70, now + 0.08, 0.28, 'square');
    } else if (tone === 'reset') {
      [523, 659, 784].forEach((freq, index) => this.beep(freq, now + index * 0.07, 0.1, 'triangle'));
    } else {
      this.beep(660, now, 0.08, 'square');
      this.beep(990, now + 0.08, 0.12, 'square');
    }
  }

  private beep(freq: number, when: number, duration: number, type: OscillatorType): void {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.9, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }
}

export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  const duration = Array.isArray(pattern)
    ? Math.max(160, pattern.reduce((sum, part) => sum + part, 0))
    : Math.max(40, pattern);
  void vibrateNative(duration, pattern);
}

async function vibrateNative(duration: number, pattern: number | number[]): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.vibrate({ duration });
      return;
    }
  } catch {
    // The browser build has no native bridge.
  }
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional when the platform blocks it.
  }
}
