import type { CreateSessionConfig, FormCoachEventName, SessionSummary, TrackingStatus } from '@formcoach/types';

export interface NativeSessionHandle {
  sessionId: string;
}

export type NativeEventListener = (eventName: FormCoachEventName, payload: Record<string, unknown>) => void;

export interface NativeMetricsSnapshot {
  repCount: number;
  currentPhase: string;
}

/**
 * Contract a real native module (Kotlin/Swift, via the RN bridge) implements: camera
 * capture, pose inference and exercise evaluation all happen natively; only compact
 * events cross the bridge (spec 7.2/8.2). No implementation of this interface backed
 * by a real camera exists in this environment — see native/README.md. `Simulator*`
 * implementations below satisfy this same contract using @formcoach/core directly, so
 * the rest of the facade (Session, FormCoach) is exercised exactly as it would be
 * against real native code.
 */
export interface NativeBridge {
  createSession(config: CreateSessionConfig): Promise<NativeSessionHandle>;
  start(sessionId: string): Promise<void>;
  pause(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<SessionSummary>;
  dispose(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<TrackingStatus>;
  getMetrics(sessionId: string): Promise<NativeMetricsSnapshot>;
  subscribe(sessionId: string, listener: NativeEventListener): () => void;
}
