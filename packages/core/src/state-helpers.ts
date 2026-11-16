/**
 * Boolean state with separate enter/exit thresholds to avoid flicker when a measurement
 * oscillates around a single cut point. `direction: 'below'` means the state becomes true
 * once the value drops below `enterBelow` and stays true until it rises above `exitAbove`.
 */
export class Hysteresis {
  private active = false;
  private readonly enterThreshold: number;
  private readonly exitThreshold: number;
  private readonly direction: 'below' | 'above';

  constructor(options: { enterThreshold: number; exitThreshold: number; direction: 'below' | 'above' }) {
    this.enterThreshold = options.enterThreshold;
    this.exitThreshold = options.exitThreshold;
    this.direction = options.direction;
  }

  update(value: number): boolean {
    if (Number.isNaN(value)) return this.active;

    if (this.direction === 'below') {
      if (!this.active && value <= this.enterThreshold) this.active = true;
      else if (this.active && value >= this.exitThreshold) this.active = false;
    } else {
      if (!this.active && value >= this.enterThreshold) this.active = true;
      else if (this.active && value <= this.exitThreshold) this.active = false;
    }
    return this.active;
  }

  get isActive(): boolean {
    return this.active;
  }

  reset(): void {
    this.active = false;
  }
}

/** Tracks how long the state machine has continuously been in the current phase. */
export class PhaseTimer {
  private enteredAtMs?: number;

  enterPhase(timestampMs: number): void {
    this.enteredAtMs = timestampMs;
  }

  elapsedMs(timestampMs: number): number {
    if (this.enteredAtMs === undefined) return 0;
    return timestampMs - this.enteredAtMs;
  }

  hasMetMinDuration(timestampMs: number, minDurationMs: number): boolean {
    return this.elapsedMs(timestampMs) >= minDurationMs;
  }

  reset(): void {
    this.enteredAtMs = undefined;
  }
}

/** Prevents duplicate triggers (rep counts, feedback) within a cooldown window. */
export class Cooldown {
  private lastTriggeredAtMs?: number;
  private readonly durationMs: number;

  constructor(durationMs: number) {
    this.durationMs = durationMs;
  }

  isReady(timestampMs: number): boolean {
    return this.lastTriggeredAtMs === undefined || timestampMs - this.lastTriggeredAtMs >= this.durationMs;
  }

  trigger(timestampMs: number): void {
    this.lastTriggeredAtMs = timestampMs;
  }

  reset(): void {
    this.lastTriggeredAtMs = undefined;
  }
}
