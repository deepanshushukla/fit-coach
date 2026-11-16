/**
 * One Euro Filter (Casiez, Roussel, Vogel 2012) — adaptive low-pass filter that
 * reduces jitter at low speed while limiting lag at high speed. Operates on a single
 * scalar value over time; apply one instance per coordinate/measurement.
 */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  private lastValue?: number;
  private lastDerivative = 0;
  private lastTimestampMs?: number;

  constructor(options: { minCutoff?: number; beta?: number; dCutoff?: number } = {}) {
    this.minCutoff = options.minCutoff ?? 1.0;
    this.beta = options.beta ?? 0.02;
    this.dCutoff = options.dCutoff ?? 1.0;
  }

  private alpha(cutoff: number, dtSeconds: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dtSeconds);
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastTimestampMs === undefined || this.lastValue === undefined) {
      this.lastValue = value;
      this.lastTimestampMs = timestampMs;
      return value;
    }

    const dtSeconds = Math.max((timestampMs - this.lastTimestampMs) / 1000, 1e-3);
    this.lastTimestampMs = timestampMs;

    const derivative = (value - this.lastValue) / dtSeconds;
    const derivativeAlpha = this.alpha(this.dCutoff, dtSeconds);
    const smoothedDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * this.lastDerivative;
    this.lastDerivative = smoothedDerivative;

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const valueAlpha = this.alpha(cutoff, dtSeconds);
    const smoothedValue = valueAlpha * value + (1 - valueAlpha) * this.lastValue;
    this.lastValue = smoothedValue;

    return smoothedValue;
  }

  reset(): void {
    this.lastValue = undefined;
    this.lastDerivative = 0;
    this.lastTimestampMs = undefined;
  }
}

/** Simple fixed-window moving average. Lower complexity fallback to One Euro for prototyping. */
export class MovingAverage {
  private readonly windowSize: number;
  private readonly values: number[] = [];

  constructor(windowSize = 5) {
    this.windowSize = Math.max(1, windowSize);
  }

  filter(value: number): number {
    this.values.push(value);
    if (this.values.length > this.windowSize) this.values.shift();
    return this.values.reduce((sum, v) => sum + v, 0) / this.values.length;
  }

  reset(): void {
    this.values.length = 0;
  }
}

/** Smooths a named set of scalar measurements independently, each with its own filter instance. */
export class MeasurementSmoother {
  private readonly filters = new Map<string, OneEuroFilter>();
  private readonly options: ConstructorParameters<typeof OneEuroFilter>[0];

  constructor(options: ConstructorParameters<typeof OneEuroFilter>[0] = {}) {
    this.options = options;
  }

  smooth(key: string, value: number, timestampMs: number): number {
    if (Number.isNaN(value)) return value;
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new OneEuroFilter(this.options);
      this.filters.set(key, filter);
    }
    return filter.filter(value, timestampMs);
  }

  reset(): void {
    this.filters.clear();
  }
}
