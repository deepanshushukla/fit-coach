/** Normalised image-space body point produced by the pose estimation runtime. */
export interface PosePoint {
  x: number;
  y: number;
  z?: number;
  /** Model-estimated probability the landmark is within the frame. */
  visibility?: number;
  /** Model-estimated probability the landmark is this specific joint. */
  presence?: number;
}

/**
 * Canonical landmark identifiers. Mirrors the pose model's output order but is
 * declared independently so evaluator code never depends on a specific model's enum.
 */
export type LandmarkId =
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle'
  | 'left_heel'
  | 'right_heel'
  | 'left_foot_index'
  | 'right_foot_index';

export type Landmarks = Partial<Record<LandmarkId, PosePoint>>;

/** A single pose inference result for one frame, in the internal coordinate convention. */
export interface PoseFrame {
  timestampMs: number;
  /** Normalised image coordinates: origin top-left, x/y in [0, 1], not mirrored. */
  landmarks: Landmarks;
  /** True if the source frame was horizontally mirrored before inference (e.g. front camera preview). */
  mirrored: boolean;
  /** Clockwise rotation in degrees applied to reach the internal coordinate convention. */
  rotationDegrees: 0 | 90 | 180 | 270;
  imageWidth: number;
  imageHeight: number;
}

export type CameraFacing = 'front' | 'back';
export type BodyView = 'front' | 'side' | 'back';
