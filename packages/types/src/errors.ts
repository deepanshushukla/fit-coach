export const SDK_ERROR_CODES = [
  'SDK_NOT_INITIALIZED',
  'UNSUPPORTED_PLATFORM',
  'CAMERA_PERMISSION_DENIED',
  'CAMERA_IN_USE',
  'MODEL_LOAD_FAILED',
  'EXERCISE_NOT_FOUND',
  'EXERCISE_NOT_LICENSED',
  'LICENCE_EXPIRED',
  'LICENCE_INVALID',
  'LICENCE_REFRESH_REQUIRED',
  'SESSION_INVALID_STATE',
  'TRACKING_UNAVAILABLE',
  'INSUFFICIENT_DATA',
  'RESOURCE_DISPOSED',
  'INTERNAL_ERROR',
] as const;

export type SdkErrorCode = (typeof SDK_ERROR_CODES)[number];

export interface SdkError {
  code: SdkErrorCode;
  /** Safe for display; never contains secrets, raw frames or sensitive device data. */
  message: string;
  /** Whether a caller can reasonably retry (e.g. after refreshing entitlement or permission). */
  recoverable: boolean;
  /** Opaque ID a user can share with support without exposing diagnostic payload contents. */
  diagnosticId?: string;
}

export class FormCoachError extends Error implements SdkError {
  readonly code: SdkErrorCode;
  readonly recoverable: boolean;
  readonly diagnosticId?: string;

  constructor(code: SdkErrorCode, message: string, recoverable = false, diagnosticId?: string) {
    super(message);
    this.name = 'FormCoachError';
    this.code = code;
    this.recoverable = recoverable;
    this.diagnosticId = diagnosticId;
  }
}
