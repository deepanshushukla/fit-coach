import type { FormCoachEventMap, FormCoachEventName, SessionSummary, TrackingStatus } from '@formcoach/types';
import { FormCoachError } from '@formcoach/types';
import type { NativeBridge, NativeMetricsSnapshot } from './nativeBridge';

type SessionState = 'created' | 'running' | 'paused' | 'stopped' | 'disposed';

type Handler<K extends FormCoachEventName> = (payload: FormCoachEventMap[K]) => void;

/**
 * Public session handle (spec 9.4/9.6). Owns no camera/inference resources directly —
 * those live behind `NativeBridge`. Enforces the documented lifecycle state machine so
 * callers get a stable `SESSION_INVALID_STATE`/`RESOURCE_DISPOSED` error instead of
 * undefined native behaviour.
 */
export class Session {
  readonly sessionId: string;
  readonly exerciseId: string;

  private state: SessionState = 'created';
  private readonly bridge: NativeBridge;
  private readonly unsubscribeNative: () => void;
  private readonly handlers = new Map<FormCoachEventName, Set<Handler<FormCoachEventName>>>();

  constructor(bridge: NativeBridge, sessionId: string, exerciseId: string) {
    this.bridge = bridge;
    this.sessionId = sessionId;
    this.exerciseId = exerciseId;
    this.unsubscribeNative = bridge.subscribe(sessionId, (eventName, payload) => {
      this.dispatch(eventName, payload as unknown as FormCoachEventMap[FormCoachEventName]);
    });
  }

  on<K extends FormCoachEventName>(eventName: K, handler: Handler<K>): () => void {
    this.assertNotDisposed();
    let set = this.handlers.get(eventName);
    if (!set) {
      set = new Set();
      this.handlers.set(eventName, set);
    }
    set.add(handler as Handler<FormCoachEventName>);
    return () => this.off(eventName, handler);
  }

  off<K extends FormCoachEventName>(eventName: K, handler: Handler<K>): void {
    this.handlers.get(eventName)?.delete(handler as Handler<FormCoachEventName>);
  }

  private dispatch<K extends FormCoachEventName>(eventName: K, payload: FormCoachEventMap[K]): void {
    const set = this.handlers.get(eventName);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  async start(): Promise<void> {
    this.assertNotDisposed();
    if (this.state !== 'created' && this.state !== 'paused') {
      throw new FormCoachError('SESSION_INVALID_STATE', `start() is only valid from 'created' or 'paused' (current: '${this.state}').`);
    }
    await this.bridge.start(this.sessionId);
    this.state = 'running';
  }

  async pause(): Promise<void> {
    this.assertNotDisposed();
    if (this.state === 'paused') return; // idempotent, per spec 9.4
    if (this.state !== 'running') {
      throw new FormCoachError('SESSION_INVALID_STATE', `pause() is only valid from 'running' (current: '${this.state}').`);
    }
    await this.bridge.pause(this.sessionId);
    this.state = 'paused';
  }

  async resume(): Promise<void> {
    this.assertNotDisposed();
    if (this.state !== 'paused') {
      throw new FormCoachError('SESSION_INVALID_STATE', `resume() is only valid from 'paused' (current: '${this.state}').`);
    }
    await this.bridge.resume(this.sessionId);
    this.state = 'running';
  }

  async stop(): Promise<SessionSummary> {
    this.assertNotDisposed();
    if (this.state !== 'running' && this.state !== 'paused') {
      throw new FormCoachError('SESSION_INVALID_STATE', `stop() is only valid from 'running' or 'paused' (current: '${this.state}').`);
    }
    const summary = await this.bridge.stop(this.sessionId);
    this.state = 'stopped';
    return summary;
  }

  async dispose(): Promise<void> {
    if (this.state === 'disposed') return;
    await this.bridge.dispose(this.sessionId);
    this.unsubscribeNative();
    this.handlers.clear();
    this.state = 'disposed';
  }

  async getStatus(): Promise<TrackingStatus> {
    this.assertNotDisposed();
    return this.bridge.getStatus(this.sessionId);
  }

  async getMetrics(): Promise<NativeMetricsSnapshot> {
    this.assertNotDisposed();
    return this.bridge.getMetrics(this.sessionId);
  }

  private assertNotDisposed(): void {
    if (this.state === 'disposed') {
      throw new FormCoachError('RESOURCE_DISPOSED', 'Operation attempted on a disposed session.');
    }
  }
}
