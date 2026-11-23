import {
  createEvaluator,
  createSyntheticFrameGenerator,
  type EvaluatorEvent,
  type ExerciseEvaluator,
  type SyntheticFrameGenerator,
} from '@formcoach/core';
import type { CreateSessionConfig, FeedbackSeverity, SessionSummary, TrackingStatus } from '@formcoach/types';
import { FormCoachError } from '@formcoach/types';
import type { NativeBridge, NativeEventListener, NativeMetricsSnapshot, NativeSessionHandle } from './nativeBridge';

type RunState = 'created' | 'running' | 'paused' | 'stopped' | 'disposed';

interface InternalSession {
  id: string;
  exerciseId: string;
  evaluator: ExerciseEvaluator;
  generator: SyntheticFrameGenerator;
  listeners: Set<NativeEventListener>;
  timer?: ReturnType<typeof setInterval>;
  virtualElapsedMs: number;
  lastTickWallMs?: number;
  lastTrackingStatus: TrackingStatus;
  repCount: number;
  formIssueCounts: Record<string, number>;
  startedAtMs?: number;
  runState: RunState;
}

const TICK_MS = 33;
const PERFORMANCE_EVENT_INTERVAL_MS = 2000;

function severityToPriority(severity: FeedbackSeverity): 2 | 3 {
  return severity === 'warning' ? 2 : 3;
}

let sessionCounter = 0;

/**
 * Drives @formcoach/core evaluators on a wall-clock timer using synthetic pose data,
 * emitting the exact same event shapes a real native module would. This is how the
 * demo app gets genuine rep-counting/form-issue behaviour without a camera.
 */
export class SimulatorNativeBridge implements NativeBridge {
  private readonly sessions = new Map<string, InternalSession>();

  async createSession(config: CreateSessionConfig): Promise<NativeSessionHandle> {
    const evaluator = createEvaluator(config.exercise, config.subject.requiredView);
    if (!evaluator) {
      throw new FormCoachError('EXERCISE_NOT_FOUND', `Unknown exercise id '${config.exercise}'.`);
    }
    let generator: SyntheticFrameGenerator;
    try {
      generator = createSyntheticFrameGenerator(config.exercise, config.subject.requiredView);
    } catch {
      throw new FormCoachError(
        'UNSUPPORTED_PLATFORM',
        `The simulator does not have synthetic pose data for '${config.exercise}'.`
      );
    }

    sessionCounter += 1;
    const sessionId = `sim_session_${sessionCounter}_${Date.now()}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      exerciseId: config.exercise,
      evaluator,
      generator,
      listeners: new Set(),
      virtualElapsedMs: 0,
      lastTrackingStatus: 'calibrating',
      repCount: 0,
      formIssueCounts: {},
      runState: 'created',
    });

    return { sessionId };
  }

  async start(sessionId: string): Promise<void> {
    const session = this.require(sessionId);
    if (session.runState !== 'created' && session.runState !== 'paused') {
      throw new FormCoachError('SESSION_INVALID_STATE', `Cannot start a session in state '${session.runState}'.`);
    }
    session.runState = 'running';
    session.startedAtMs = session.startedAtMs ?? Date.now();
    session.lastTickWallMs = Date.now();
    this.emit(session, 'ready', { exerciseId: session.exerciseId, evaluatorVersion: session.evaluator.version });
    session.timer = setInterval(() => this.tick(session), TICK_MS);
    this.schedulePerformanceEvents(session);
  }

  async pause(sessionId: string): Promise<void> {
    const session = this.require(sessionId);
    if (session.runState === 'paused') return; // idempotent, per spec 9.4
    if (session.runState !== 'running') {
      throw new FormCoachError('SESSION_INVALID_STATE', `Cannot pause a session in state '${session.runState}'.`);
    }
    session.runState = 'paused';
    this.clearTimer(session);
  }

  async resume(sessionId: string): Promise<void> {
    const session = this.require(sessionId);
    if (session.runState !== 'paused') {
      throw new FormCoachError('SESSION_INVALID_STATE', `Cannot resume a session in state '${session.runState}'.`);
    }
    session.runState = 'running';
    session.lastTickWallMs = Date.now();
    session.timer = setInterval(() => this.tick(session), TICK_MS);
    this.schedulePerformanceEvents(session);
  }

  async stop(sessionId: string): Promise<SessionSummary> {
    const session = this.require(sessionId);
    this.clearTimer(session);
    session.runState = 'stopped';

    const summary: SessionSummary = {
      sessionId: session.id,
      exerciseId: session.exerciseId,
      evaluatorVersion: session.evaluator.version,
      startedAtMs: session.startedAtMs ?? Date.now(),
      endedAtMs: Date.now(),
      repCount: session.repCount,
      formIssueCounts: session.formIssueCounts,
      abstentionDurationMs: 0,
    };
    this.emit(session, 'sessionCompleted', { summary });
    return summary;
  }

  async dispose(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.clearTimer(session);
    session.runState = 'disposed';
    session.listeners.clear();
    this.sessions.delete(sessionId);
  }

  async getStatus(sessionId: string): Promise<TrackingStatus> {
    return this.require(sessionId).lastTrackingStatus;
  }

  async getMetrics(sessionId: string): Promise<NativeMetricsSnapshot> {
    const session = this.require(sessionId);
    const metrics = session.evaluator.getMetrics();
    return { repCount: metrics.repCount, currentPhase: metrics.currentPhase };
  }

  subscribe(sessionId: string, listener: NativeEventListener): () => void {
    const session = this.require(sessionId);
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  private require(sessionId: string): InternalSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new FormCoachError('RESOURCE_DISPOSED', `Session '${sessionId}' does not exist or was disposed.`);
    return session;
  }

  private clearTimer(session: InternalSession): void {
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = undefined;
    }
  }

  private schedulePerformanceEvents(session: InternalSession): void {
    const emitPerformance = () => {
      if (session.runState !== 'running') return;
      this.emit(session, 'performance', {
        effectiveFps: Math.round(1000 / TICK_MS),
        droppedFrameCount: 0,
        inferenceLatencyMsP50: 8,
        inferenceLatencyMsP95: 14,
        thermalState: 'nominal',
      });
      setTimeout(emitPerformance, PERFORMANCE_EVENT_INTERVAL_MS);
    };
    setTimeout(emitPerformance, PERFORMANCE_EVENT_INTERVAL_MS);
  }

  private tick(session: InternalSession): void {
    const now = Date.now();
    const dt = session.lastTickWallMs ? now - session.lastTickWallMs : TICK_MS;
    session.lastTickWallMs = now;
    session.virtualElapsedMs += dt;

    const frame = session.generator.nextFrame(session.virtualElapsedMs);
    const output = session.evaluator.update(frame);

    if (output.trackingStatus !== session.lastTrackingStatus) {
      if (output.trackingStatus === 'lost') {
        this.emit(session, 'trackingLost', { reason: 'unknown' });
      }
      session.lastTrackingStatus = output.trackingStatus;
    }
    this.emit(session, 'trackingUpdate', {
      status: output.trackingStatus,
      visibleLandmarkCount: output.trackingStatus === 'lost' ? 0 : 12,
    });

    for (const event of output.events) {
      this.emitEvaluatorEvent(session, event);
    }
  }

  private emitEvaluatorEvent(session: InternalSession, event: EvaluatorEvent): void {
    switch (event.type) {
      case 'phaseChanged':
        this.emit(session, 'phaseChanged', { exerciseId: session.exerciseId, fromPhase: event.fromPhase, toPhase: event.toPhase });
        break;
      case 'repCompleted':
        session.repCount = event.repCount;
        this.emit(session, 'repCompleted', {
          exerciseId: session.exerciseId,
          repCount: event.repCount,
          durationMs: event.durationMs,
          quality: event.quality,
        });
        break;
      case 'formIssue':
        session.formIssueCounts[event.issueId] = (session.formIssueCounts[event.issueId] ?? 0) + 1;
        this.emit(session, 'formIssue', {
          exerciseId: session.exerciseId,
          issueId: event.issueId,
          severity: event.severity,
          message: event.message,
          assessment: event.assessment,
          confidence: event.confidence,
        });
        this.emit(session, 'feedback', {
          exerciseId: session.exerciseId,
          priority: severityToPriority(event.severity),
          message: event.message,
          channel: 'visual',
        });
        break;
      case 'calibrationRequired':
        this.emit(session, 'calibrationRequired', { requiredView: event.requiredView, guidance: event.guidance });
        break;
      case 'calibrationCompleted':
        this.emit(session, 'calibrationCompleted', { requiredView: event.requiredView });
        break;
    }
  }

  private emit(session: InternalSession, eventName: Parameters<NativeEventListener>[0], payload: Record<string, unknown>): void {
    const fullPayload = { sessionId: session.id, timestampMs: Date.now(), ...payload };
    for (const listener of session.listeners) listener(eventName, fullPayload);
  }
}
