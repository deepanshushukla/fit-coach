import type { Landmarks, PoseFrame } from '@formcoach/types';

/**
 * Pure, deterministic synthetic pose generator: nextFrame(t) depends only on t, not on
 * prior calls. Used to drive the SDK's native-module simulator (no real camera/ML in
 * this environment) and shares its math with the fixture generator in
 * src/fixtures/generate.ts so "live" simulation and recorded fixtures stay consistent.
 *
 * This is for demos and integration testing only — it is not a substitute for the
 * trainer-reviewed validation protocol in spec section 17.4.
 */
export interface SyntheticFrameGenerator {
  readonly exerciseId: string;
  nextFrame(timestampMs: number): PoseFrame;
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Triangle wave over [low, high] with the given full-cycle period, starting at `low`. */
function triangleWave(timestampMs: number, periodMs: number, low: number, high: number): number {
  const phase = (timestampMs % periodMs) / periodMs; // [0, 1)
  const t = phase < 0.5 ? phase / 0.5 : 1 - (phase - 0.5) / 0.5;
  return lerp(low, high, t);
}

function squatLikeFrame(timestampMs: number, kneeAngleDeg: number): PoseFrame {
  const shankLength = 0.22;
  const thighLength = 0.22;
  const torsoLength = 0.3;

  const ankle = { x: 0.5, y: 0.9 };
  const knee = { x: ankle.x, y: ankle.y - shankLength };
  const thighAngle = deg2rad(180 - kneeAngleDeg);
  const hip = { x: knee.x + thighLength * Math.sin(thighAngle), y: knee.y - thighLength * Math.cos(thighAngle) };
  const leanRad = deg2rad((180 - kneeAngleDeg) * 0.15);
  const shoulder = { x: hip.x + torsoLength * Math.sin(leanRad), y: hip.y - torsoLength * Math.cos(leanRad) };

  const withConf = (p: { x: number; y: number }) => ({ ...p, visibility: 1, presence: 1 });

  const landmarks: Landmarks = {
    left_shoulder: withConf(shoulder),
    right_shoulder: withConf({ x: shoulder.x + 0.02, y: shoulder.y }),
    left_hip: withConf(hip),
    right_hip: withConf({ x: hip.x + 0.02, y: hip.y }),
    left_knee: withConf(knee),
    right_knee: withConf({ x: knee.x + 0.02, y: knee.y }),
    left_ankle: withConf(ankle),
    right_ankle: withConf({ x: ankle.x + 0.02, y: ankle.y }),
    left_foot_index: withConf({ x: ankle.x + 0.08, y: ankle.y + 0.02 }),
    right_foot_index: withConf({ x: ankle.x + 0.1, y: ankle.y + 0.02 }),
  };

  return { timestampMs, landmarks, mirrored: false, rotationDegrees: 0, imageWidth: 1280, imageHeight: 720 };
}

function pushUpLikeFrame(timestampMs: number, elbowAngleDeg: number): PoseFrame {
  const upperArmLength = 0.18;
  const forearmLength = 0.18;
  const torsoLength = 0.35;
  const legLength = 0.35;

  const shoulder = { x: 0.4, y: 0.4 };
  const elbow = { x: shoulder.x + upperArmLength, y: shoulder.y + 0.02 };
  const forearmAngle = deg2rad(180 - elbowAngleDeg);
  const wrist = { x: elbow.x + forearmLength * Math.cos(forearmAngle), y: elbow.y + forearmLength * Math.sin(forearmAngle) * 0.3 };
  const hip = { x: shoulder.x + torsoLength, y: shoulder.y };
  const ankle = { x: hip.x + legLength, y: shoulder.y };

  const withConf = (p: { x: number; y: number }) => ({ ...p, visibility: 1, presence: 1 });

  const landmarks: Landmarks = {
    left_shoulder: withConf(shoulder),
    right_shoulder: withConf({ x: shoulder.x, y: shoulder.y + 0.01 }),
    left_elbow: withConf(elbow),
    right_elbow: withConf({ x: elbow.x, y: elbow.y + 0.01 }),
    left_wrist: withConf(wrist),
    right_wrist: withConf({ x: wrist.x, y: wrist.y + 0.01 }),
    left_hip: withConf(hip),
    right_hip: withConf({ x: hip.x, y: hip.y + 0.01 }),
    left_ankle: withConf(ankle),
    right_ankle: withConf({ x: ankle.x, y: ankle.y + 0.01 }),
  };

  return { timestampMs, landmarks, mirrored: false, rotationDegrees: 0, imageWidth: 1280, imageHeight: 720 };
}

const REP_CYCLE_MS = 2200;

export function createSyntheticFrameGenerator(exerciseId: string): SyntheticFrameGenerator {
  switch (exerciseId) {
    case 'squat':
    case 'lunge':
      return {
        exerciseId,
        nextFrame: (t) => squatLikeFrame(t, triangleWave(t, REP_CYCLE_MS, 170, exerciseId === 'squat' ? 80 : 90)),
      };
    case 'push_up':
      return {
        exerciseId,
        nextFrame: (t) => pushUpLikeFrame(t, triangleWave(t, REP_CYCLE_MS, 165, 80)),
      };
    default:
      throw new Error(`No synthetic frame generator available for exercise '${exerciseId}'.`);
  }
}
