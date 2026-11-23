/**
 * Generates synthetic pose-landmark fixtures for replay tests.
 *
 * IMPORTANT: these are parametrically generated sequences used to exercise the
 * evaluator's state machine, rep counting and abstention logic in CI. They are NOT
 * validated human movement recordings. Real exercise validation (spec section 17.4)
 * requires consented recordings annotated by qualified reviewers — that protocol is
 * out of scope for this environment and must be run separately before any exercise
 * is published.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Landmarks, PoseFrame } from '@formcoach/types';

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const OUT_DIR = join(__dirname, '..', '..', '..', '..', 'contracts', 'fixtures');

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

interface SquatPoint {
  shankAngleDeg?: number;
  confidence?: number;
}

/** Builds one squat/lunge-style leg frame from a target knee interior angle, shin held vertical. */
function squatFrame(
  timestampMs: number,
  kneeAngleDeg: number,
  options: { confidence?: number; torsoLeanExtraDeg?: number } = {}
): PoseFrame {
  const confidence = options.confidence ?? 1.0;
  const shankLength = 0.22;
  const thighLength = 0.22;
  const torsoLength = 0.3;

  const ankle = { x: 0.5, y: 0.9 };
  const knee = { x: ankle.x, y: ankle.y - shankLength };

  const thighAngleDeg = 180 - kneeAngleDeg;
  const thighAngle = deg2rad(thighAngleDeg);
  const hip = {
    x: knee.x + thighLength * Math.sin(thighAngle),
    y: knee.y - thighLength * Math.cos(thighAngle),
  };

  const leanDeg = (options.torsoLeanExtraDeg ?? thighAngleDeg * 0.15);
  const leanRad = deg2rad(leanDeg);
  const shoulder = {
    x: hip.x + torsoLength * Math.sin(leanRad),
    y: hip.y - torsoLength * Math.cos(leanRad),
  };

  const withConf = (p: { x: number; y: number }) => ({ ...p, visibility: confidence, presence: confidence });

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

  return {
    timestampMs,
    landmarks,
    mirrored: false,
    rotationDegrees: 0,
    imageWidth: 1280,
    imageHeight: 720,
  };
}

/**
 * Front-view counterpart to squatFrame: two distinct legs instead of one sagittal-plane
 * leg duplicated, so knee x-position can be moved independently of ankle x-position to
 * simulate knee valgus.
 */
function squatFrontFrame(
  timestampMs: number,
  kneeAngleDeg: number,
  options: { confidence?: number; kneeInsetAmount?: number } = {}
): PoseFrame {
  const confidence = options.confidence ?? 1.0;
  const kneeInsetAmount = options.kneeInsetAmount ?? 0;
  const shankLength = 0.22;
  const thighLength = 0.22;
  const torsoLength = 0.3;
  const stanceHalfWidth = 0.09;

  const thighAngle = deg2rad(180 - kneeAngleDeg);
  const ankleY = 0.9;
  const kneeY = ankleY - shankLength;
  const hipY = kneeY - thighLength * Math.cos(thighAngle);
  const shoulderY = hipY - torsoLength;

  const ankleHalfWidth = stanceHalfWidth;
  const kneeHalfWidth = stanceHalfWidth * (1 - kneeInsetAmount);
  const hipHalfWidth = stanceHalfWidth * 0.8;
  const shoulderHalfWidth = stanceHalfWidth * 1.3;

  const withConf = (p: { x: number; y: number }) => ({ ...p, visibility: confidence, presence: confidence });

  const landmarks: Landmarks = {
    left_shoulder: withConf({ x: 0.5 - shoulderHalfWidth, y: shoulderY }),
    right_shoulder: withConf({ x: 0.5 + shoulderHalfWidth, y: shoulderY }),
    left_hip: withConf({ x: 0.5 - hipHalfWidth, y: hipY }),
    right_hip: withConf({ x: 0.5 + hipHalfWidth, y: hipY }),
    left_knee: withConf({ x: 0.5 - kneeHalfWidth, y: kneeY }),
    right_knee: withConf({ x: 0.5 + kneeHalfWidth, y: kneeY }),
    left_ankle: withConf({ x: 0.5 - ankleHalfWidth, y: ankleY }),
    right_ankle: withConf({ x: 0.5 + ankleHalfWidth, y: ankleY }),
  };

  return {
    timestampMs,
    landmarks,
    mirrored: false,
    rotationDegrees: 0,
    imageWidth: 1280,
    imageHeight: 720,
  };
}

/** Builds one push-up-style plank frame from a target elbow interior angle. */
function pushUpFrame(
  timestampMs: number,
  elbowAngleDeg: number,
  options: { confidence?: number; hipSagExtraDeg?: number } = {}
): PoseFrame {
  const confidence = options.confidence ?? 1.0;
  const upperArmLength = 0.18;
  const forearmLength = 0.18;
  const torsoLength = 0.35;
  const legLength = 0.35;

  const shoulder = { x: 0.4, y: 0.4 };
  const elbow = { x: shoulder.x + upperArmLength, y: shoulder.y + 0.02 };

  const forearmAngleDeg = 180 - elbowAngleDeg;
  const forearmAngle = deg2rad(forearmAngleDeg);
  const wrist = {
    x: elbow.x + forearmLength * Math.cos(forearmAngle),
    y: elbow.y + forearmLength * Math.sin(forearmAngle) * 0.3,
  };

  const hipSagDeg = options.hipSagExtraDeg ?? 0;
  const hip = {
    x: shoulder.x + torsoLength,
    y: shoulder.y + deg2rad(hipSagDeg) * 0.4,
  };
  const ankle = { x: hip.x + legLength, y: shoulder.y };

  const withConf = (p: { x: number; y: number }) => ({ ...p, visibility: confidence, presence: confidence });

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

  return {
    timestampMs,
    landmarks,
    mirrored: false,
    rotationDegrees: 0,
    imageWidth: 1280,
    imageHeight: 720,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function framesOverPhase(
  startMs: number,
  durationMs: number,
  fromValue: number,
  toValue: number,
  frameFn: (timestampMs: number, value: number) => PoseFrame
): PoseFrame[] {
  const frameCount = Math.max(1, Math.round(durationMs / FRAME_MS));
  const frames: PoseFrame[] = [];
  for (let i = 0; i <= frameCount; i++) {
    const t = i / frameCount;
    const timestampMs = startMs + i * FRAME_MS;
    frames.push(frameFn(timestampMs, lerp(fromValue, toValue, t)));
  }
  return frames;
}

function squatRepCycle(startMs: number, options: { descendMs: number; holdMs: number; ascendMs: number; depthAngle: number }): PoseFrame[] {
  const { descendMs, holdMs, ascendMs, depthAngle } = options;
  let t = startMs;
  const frames: PoseFrame[] = [];
  frames.push(...framesOverPhase(t, descendMs, 170, depthAngle, squatFrame));
  t += descendMs;
  frames.push(...framesOverPhase(t, holdMs, depthAngle, depthAngle, squatFrame));
  t += holdMs;
  frames.push(...framesOverPhase(t, ascendMs, depthAngle, 170, squatFrame));
  t += ascendMs;
  return frames;
}

function buildSquatCorrectReps(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  for (let rep = 0; rep < 3; rep++) {
    const repFrames = squatRepCycle(t, { descendMs: 700, holdMs: 300, ascendMs: 700, depthAngle: 80 });
    frames = frames.concat(repFrames);
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
    frames.push(...framesOverPhase(t, 400, 170, 170, squatFrame));
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  }
  return frames;
}

function buildSquatShallowNoRep(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  // Only descends to 130 degrees, never reaching the 100 degree depth threshold.
  frames.push(...framesOverPhase(t, 500, 170, 130, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  frames.push(...framesOverPhase(t, 500, 130, 170, squatFrame));
  return frames;
}

function buildSquatSlowRep(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  frames = frames.concat(squatRepCycle(t, { descendMs: 2500, holdMs: 800, ascendMs: 2500, depthAngle: 75 }));
  return frames;
}

function buildSquatFastRep(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  frames = frames.concat(squatRepCycle(t, { descendMs: 250, holdMs: 100, ascendMs: 250, depthAngle: 85 }));
  return frames;
}

function buildSquatBackRounding(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  const frameCount = Math.round(2000 / FRAME_MS);
  for (let i = 0; i <= frameCount; i++) {
    const timestampMs = t + i * FRAME_MS;
    const phase = i / frameCount;
    const kneeAngle = phase < 0.5 ? lerp(170, 80, phase / 0.5) : lerp(80, 170, (phase - 0.5) / 0.5);
    frames.push(squatFrame(timestampMs, kneeAngle, { torsoLeanExtraDeg: 60 }));
  }
  return frames;
}

function buildSquatTrackingLossDuringRep(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  // Descend normally...
  frames.push(...framesOverPhase(t, 700, 170, 80, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  // ...then lose tracking (low confidence) for half a second while at depth.
  const lossFrameCount = Math.round(500 / FRAME_MS);
  for (let i = 0; i < lossFrameCount; i++) {
    frames.push(squatFrame(t + i * FRAME_MS, 80, { confidence: 0.1 }));
  }
  t += lossFrameCount * FRAME_MS;
  // Reacquire and stand back up: this should NOT count as a completed rep.
  frames.push(...framesOverPhase(t, 700, 80, 170, squatFrame));
  return frames;
}

function squatFrontRepCycle(startMs: number, options: { descendMs: number; holdMs: number; ascendMs: number; depthAngle: number }): PoseFrame[] {
  const { descendMs, holdMs, ascendMs, depthAngle } = options;
  let t = startMs;
  const frames: PoseFrame[] = [];
  const frameFn = (ts: number, angle: number) => squatFrontFrame(ts, angle);
  frames.push(...framesOverPhase(t, descendMs, 170, depthAngle, frameFn));
  t += descendMs;
  frames.push(...framesOverPhase(t, holdMs, depthAngle, depthAngle, frameFn));
  t += holdMs;
  frames.push(...framesOverPhase(t, ascendMs, depthAngle, 170, frameFn));
  t += ascendMs;
  return frames;
}

function buildSquatFrontCorrectReps(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrontFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  for (let rep = 0; rep < 3; rep++) {
    const repFrames = squatFrontRepCycle(t, { descendMs: 700, holdMs: 300, ascendMs: 700, depthAngle: 80 });
    frames = frames.concat(repFrames);
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
    frames.push(...framesOverPhase(t, 400, 170, 170, squatFrontFrame));
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  }
  return frames;
}

function buildSquatFrontShallowNoRep(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrontFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  // Only descends to 130 degrees, never reaching the depth threshold.
  frames.push(...framesOverPhase(t, 500, 170, 130, squatFrontFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  frames.push(...framesOverPhase(t, 500, 130, 170, squatFrontFrame));
  return frames;
}

function buildSquatFrontKneeValgus(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrontFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  const frameCount = Math.round(2000 / FRAME_MS);
  for (let i = 0; i <= frameCount; i++) {
    const timestampMs = t + i * FRAME_MS;
    const phase = i / frameCount;
    const kneeAngle = phase < 0.5 ? lerp(170, 80, phase / 0.5) : lerp(80, 170, (phase - 0.5) / 0.5);
    // Knees cave inward throughout the whole descend/hold/ascend cycle.
    frames.push(squatFrontFrame(timestampMs, kneeAngle, { kneeInsetAmount: 0.6 }));
  }
  return frames;
}

function pushUpRepCycle(
  startMs: number,
  options: { descendMs: number; holdMs: number; ascendMs: number; depthAngle: number; hipSagExtraDeg?: number }
): PoseFrame[] {
  const { descendMs, holdMs, ascendMs, depthAngle, hipSagExtraDeg } = options;
  let t = startMs;
  const frames: PoseFrame[] = [];
  const frameFn = (ts: number, angle: number) => pushUpFrame(ts, angle, { hipSagExtraDeg });
  frames.push(...framesOverPhase(t, descendMs, 165, depthAngle, frameFn));
  t += descendMs;
  frames.push(...framesOverPhase(t, holdMs, depthAngle, depthAngle, frameFn));
  t += holdMs;
  frames.push(...framesOverPhase(t, ascendMs, depthAngle, 165, frameFn));
  return frames;
}

function buildPushUpCorrectReps(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 165, 165, (ts, a) => pushUpFrame(ts, a)));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  for (let rep = 0; rep < 3; rep++) {
    const repFrames = pushUpRepCycle(t, { descendMs: 600, holdMs: 200, ascendMs: 600, depthAngle: 80 });
    frames = frames.concat(repFrames);
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
    frames.push(...framesOverPhase(t, 300, 165, 165, (ts, a) => pushUpFrame(ts, a)));
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  }
  return frames;
}

function buildPushUpHipsSagging(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 165, 165, (ts, a) => pushUpFrame(ts, a)));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  frames = frames.concat(
    pushUpRepCycle(t, { descendMs: 700, holdMs: 600, ascendMs: 700, depthAngle: 80, hipSagExtraDeg: 45 })
  );
  return frames;
}

function buildLungeCorrectReps(): PoseFrame[] {
  let frames: PoseFrame[] = [];
  let t = 0;
  frames.push(...framesOverPhase(t, 300, 170, 170, squatFrame));
  t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  for (let rep = 0; rep < 3; rep++) {
    const repFrames = squatRepCycle(t, { descendMs: 700, holdMs: 300, ascendMs: 700, depthAngle: 90 });
    frames = frames.concat(repFrames);
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
    frames.push(...framesOverPhase(t, 400, 170, 170, squatFrame));
    t = frames[frames.length - 1]!.timestampMs + FRAME_MS;
  }
  return frames;
}

function write(name: string, frames: PoseFrame[]): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(frames, null, 2));
  console.log(`wrote ${frames.length} frames -> contracts/fixtures/${name}.json`);
}

write('squat_correct_reps', buildSquatCorrectReps());
write('squat_shallow_no_rep', buildSquatShallowNoRep());
write('squat_slow_rep', buildSquatSlowRep());
write('squat_fast_rep', buildSquatFastRep());
write('squat_back_rounding', buildSquatBackRounding());
write('squat_tracking_loss_during_rep', buildSquatTrackingLossDuringRep());
write('squat_front_correct_reps', buildSquatFrontCorrectReps());
write('squat_front_shallow_no_rep', buildSquatFrontShallowNoRep());
write('squat_front_knee_valgus', buildSquatFrontKneeValgus());
write('push_up_correct_reps', buildPushUpCorrectReps());
write('push_up_hips_sagging', buildPushUpHipsSagging());
write('lunge_correct_reps', buildLungeCorrectReps());
