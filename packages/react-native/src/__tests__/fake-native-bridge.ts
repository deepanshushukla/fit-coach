import type { SessionSummary } from '@formcoach/types';
import type { NativeBridge, NativeEventListener, NativeMetricsSnapshot, NativeSessionHandle } from '../nativeBridge';

/** Deterministic, synchronous-ish NativeBridge for testing Session's own state machine in isolation. */
export class FakeNativeBridge implements NativeBridge {
  public calls: string[] = [];
  private listeners = new Map<string, Set<NativeEventListener>>();
  private counter = 0;

  async createSession(): Promise<NativeSessionHandle> {
    this.counter += 1;
    const sessionId = `fake_${this.counter}`;
    this.listeners.set(sessionId, new Set());
    return { sessionId };
  }

  async start(sessionId: string): Promise<void> {
    this.calls.push(`start:${sessionId}`);
  }

  async pause(sessionId: string): Promise<void> {
    this.calls.push(`pause:${sessionId}`);
  }

  async resume(sessionId: string): Promise<void> {
    this.calls.push(`resume:${sessionId}`);
  }

  async stop(sessionId: string): Promise<SessionSummary> {
    this.calls.push(`stop:${sessionId}`);
    return {
      sessionId,
      exerciseId: 'squat',
      evaluatorVersion: '1.0.0',
      startedAtMs: 0,
      endedAtMs: 1000,
      repCount: 0,
      formIssueCounts: {},
      abstentionDurationMs: 0,
    };
  }

  async dispose(sessionId: string): Promise<void> {
    this.calls.push(`dispose:${sessionId}`);
    this.listeners.delete(sessionId);
  }

  async getStatus(): Promise<'ready' | 'tracking' | 'partial' | 'lost' | 'calibrating'> {
    return 'tracking';
  }

  async getMetrics(): Promise<NativeMetricsSnapshot> {
    return { repCount: 0, currentPhase: 'ready' };
  }

  subscribe(sessionId: string, listener: NativeEventListener): () => void {
    const set = this.listeners.get(sessionId) ?? new Set();
    set.add(listener);
    this.listeners.set(sessionId, set);
    return () => set.delete(listener);
  }

  emit(sessionId: string, eventName: Parameters<NativeEventListener>[0], payload: Record<string, unknown>): void {
    for (const listener of this.listeners.get(sessionId) ?? []) listener(eventName, payload);
  }
}
