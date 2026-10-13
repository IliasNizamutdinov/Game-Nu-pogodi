/**
 * Single animation loop. Calling start() again while it is running does nothing,
 * so a second press of Game A / Game B cannot stack frame callbacks.
 */
export class GameLoop {
  private handle: number | null = null;
  private running = false;
  private lastTime = 0;

  constructor(
    private readonly onFrame: (dtSeconds: number) => void,
    private readonly requestFrame: (callback: (timeMs: number) => void) => number = (callback) =>
      requestAnimationFrame(callback),
    private readonly cancelFrame: (handle: number) => void = (handle) => cancelAnimationFrame(handle),
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    const frame = (timeMs: number) => {
      if (!this.running) return;
      if (this.lastTime === 0) {
        this.lastTime = timeMs;
        this.onFrame(0);
      } else {
        const dt = (timeMs - this.lastTime) / 1000;
        this.lastTime = timeMs;
        this.onFrame(dt);
      }
      this.handle = this.requestFrame(frame);
    };
    this.handle = this.requestFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.cancelFrame(this.handle);
      this.handle = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }
}
