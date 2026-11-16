import type { Landmarks, LandmarkId, PoseFrame } from '@formcoach/types';

export interface RequiredLandmarksCheck {
  ok: boolean;
  missing: LandmarkId[];
}

export function checkRequiredLandmarks(
  landmarks: Landmarks,
  required: LandmarkId[],
  minConfidence: number
): RequiredLandmarksCheck {
  const missing: LandmarkId[] = [];
  for (const id of required) {
    const point = landmarks[id];
    if (!point) {
      missing.push(id);
      continue;
    }
    const visibility = point.visibility ?? 1;
    const presence = point.presence ?? 1;
    if (visibility < minConfidence || presence < minConfidence) {
      missing.push(id);
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Rejects frames that cannot be trusted: non-increasing timestamps, stale gaps, or a
 * landmark that moved further than physically plausible since the previous frame
 * (a proxy for identity switches or model glitches, not true ground-truth velocity).
 */
export class FrameValidator {
  private lastTimestampMs?: number;
  private lastLandmarks?: Landmarks;
  private readonly maxStaleGapMs: number;
  private readonly maxNormalizedJumpPerSecond: number;

  constructor(options: { maxStaleGapMs?: number; maxNormalizedJumpPerSecond?: number } = {}) {
    this.maxStaleGapMs = options.maxStaleGapMs ?? 1000;
    this.maxNormalizedJumpPerSecond = options.maxNormalizedJumpPerSecond ?? 2.5;
  }

  validate(frame: PoseFrame): { accepted: boolean; reason?: string } {
    if (this.lastTimestampMs !== undefined && frame.timestampMs <= this.lastTimestampMs) {
      return { accepted: false, reason: 'non_increasing_timestamp' };
    }

    const gapMs =
      this.lastTimestampMs === undefined ? 0 : frame.timestampMs - this.lastTimestampMs;
    if (gapMs > this.maxStaleGapMs) {
      this.lastLandmarks = undefined;
    }

    if (this.lastLandmarks && gapMs > 0) {
      const dtSeconds = gapMs / 1000;
      for (const [id, point] of Object.entries(frame.landmarks) as [LandmarkId, { x: number; y: number }][]) {
        const prev = this.lastLandmarks[id];
        if (!prev) continue;
        const jump = Math.hypot(point.x - prev.x, point.y - prev.y);
        const jumpPerSecond = jump / dtSeconds;
        if (jumpPerSecond > this.maxNormalizedJumpPerSecond) {
          this.lastTimestampMs = frame.timestampMs;
          this.lastLandmarks = frame.landmarks;
          return { accepted: false, reason: 'implausible_jump' };
        }
      }
    }

    this.lastTimestampMs = frame.timestampMs;
    this.lastLandmarks = frame.landmarks;
    return { accepted: true };
  }

  reset(): void {
    this.lastTimestampMs = undefined;
    this.lastLandmarks = undefined;
  }
}
