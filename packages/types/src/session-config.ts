import type { BodyView, CameraFacing } from './pose';

export interface InferenceConfig {
  targetFps: number;
  processingResolution: '480p' | '720p' | '1080p';
}

export interface PrivacyConfig {
  /** Must default to true. Processing any other way requires a future, separately reviewed product. */
  processLocally: boolean;
  /** Must default to false and must not be enabled in the first release. */
  uploadVideo: boolean;
  collectUsage: boolean;
}

export interface InitializeConfig {
  appId: string;
  environment: 'development' | 'staging' | 'production';
  inference?: Partial<InferenceConfig>;
  privacy?: Partial<PrivacyConfig>;
}

export interface SessionCameraConfig {
  facing: CameraFacing;
  /** Omit to leave resolution to the platform default. */
  resolution?: '480p' | '720p' | '1080p';
  /** Omit to leave frame rate to the platform default. */
  targetFps?: number;
}

export interface SessionSubjectConfig {
  requiredView: BodyView;
}

export interface SessionFeedbackConfig {
  visual: boolean;
  voice: boolean;
  haptic: boolean;
}

export interface CreateSessionConfig {
  exercise: string;
  camera: SessionCameraConfig;
  subject: SessionSubjectConfig;
  feedback: SessionFeedbackConfig;
}
