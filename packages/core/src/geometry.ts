import type { Landmarks, LandmarkId } from '@formcoach/types';

export interface Point {
  x: number;
  y: number;
}

/**
 * Interior angle ABC in degrees, where B is the vertex.
 * Returns NaN if either segment has zero length (points coincide).
 */
export function calculateAngle(a: Point, b: Point, c: Point): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.hypot(ba.x, ba.y);
  const magBC = Math.hypot(bc.x, bc.y);

  if (magBA === 0 || magBC === 0) return Number.NaN;

  const cosine = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Distance normalised by a body-scale reference (e.g. shoulder-to-hip distance),
 * so thresholds are comparable across body proportions and distance from camera.
 */
export function normalizedDistance(a: Point, b: Point, scaleReference: number): number {
  if (scaleReference === 0) return Number.NaN;
  return distance(a, b) / scaleReference;
}

/** Inclination of a segment relative to vertical (0 = perfectly vertical), in degrees, [0, 180]. */
export function segmentInclinationFromVertical(top: Point, bottom: Point): number {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  if (dx === 0 && dy === 0) return Number.NaN;
  const angleFromVertical = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
  return angleFromVertical;
}

/** Signed horizontal offset of `point` from `reference`, normalised by `scaleReference`. */
export function normalizedHorizontalOffset(point: Point, reference: Point, scaleReference: number): number {
  if (scaleReference === 0) return Number.NaN;
  return (point.x - reference.x) / scaleReference;
}

/**
 * Resolves a landmark, requiring it to exist and meet a minimum visibility/presence confidence.
 * Returns undefined (not a guessed value) when the landmark is missing or unreliable.
 */
export function resolveLandmark(
  landmarks: Landmarks,
  id: LandmarkId,
  minConfidence: number
): Point | undefined {
  const point = landmarks[id];
  if (!point) return undefined;
  const visibility = point.visibility ?? 1;
  const presence = point.presence ?? 1;
  if (visibility < minConfidence || presence < minConfidence) return undefined;
  return { x: point.x, y: point.y };
}

/** Average confidence across the given landmarks; 0 if any are missing. */
export function averageConfidence(landmarks: Landmarks, ids: LandmarkId[]): number {
  let sum = 0;
  for (const id of ids) {
    const point = landmarks[id];
    if (!point) return 0;
    const visibility = point.visibility ?? 1;
    const presence = point.presence ?? 1;
    sum += Math.min(visibility, presence);
  }
  return ids.length === 0 ? 0 : sum / ids.length;
}
