import type {
  CreateSessionConfig,
  ExerciseDetails,
  ExerciseSummary,
  InitializeConfig,
} from '@formcoach/types';
import { FormCoachError } from '@formcoach/types';
import type { NativeBridge } from './nativeBridge';
import { SimulatorNativeBridge } from './simulatorNativeBridge';
import { Session } from './session';
import { MemoryStorage, type Storage } from './storage';
import { EntitlementCache } from './entitlementCache';
import { FormCoachApiClient } from './apiClient';
import { decodeEntitlementPayload, isEntitlementExpired } from './jwt';

export const SDK_VERSION = '0.1.0';

export interface FormCoachClientOptions {
  /** Injected persistence for the cached entitlement; defaults to in-memory (does not survive restarts). */
  storage?: Storage;
  /** FormCoach backend base URL. */
  apiBaseUrl?: string;
  /** Override the native bridge — used by tests and by the demo app's simulator. Real builds would inject a bridge backed by actual native modules. */
  nativeBridge?: NativeBridge;
}

const DEFAULT_CONFIG = {
  inference: { targetFps: 24, processingResolution: '720p' as const },
  privacy: { processLocally: true, uploadVideo: false, collectUsage: true },
};

export class FormCoachClient {
  private readonly bridge: NativeBridge;
  private readonly apiBaseUrl: string;
  private readonly entitlementCache: EntitlementCache;
  private apiClient?: FormCoachApiClient;

  private config?: InitializeConfig;
  private cachedEntitlementToken?: string;
  private cachedExercises?: string[];
  private cachedExpiresAt?: number;
  private cachedOfflineGraceUntil?: number;
  private sdkSessionToken?: string;
  private initialized = false;

  constructor(options: FormCoachClientOptions = {}) {
    this.bridge = options.nativeBridge ?? new SimulatorNativeBridge();
    this.apiBaseUrl = options.apiBaseUrl ?? 'http://localhost:4000';
    this.entitlementCache = new EntitlementCache(options.storage ?? new MemoryStorage());
  }

  async initialize(config: InitializeConfig): Promise<void> {
    if (!config.appId) {
      throw new FormCoachError('UNSUPPORTED_PLATFORM', 'initialize() requires a non-empty appId (environment public identifier).');
    }

    this.config = {
      ...config,
      inference: { ...DEFAULT_CONFIG.inference, ...config.inference },
      privacy: { ...DEFAULT_CONFIG.privacy, ...config.privacy, uploadVideo: false },
    };
    this.apiClient = new FormCoachApiClient(this.apiBaseUrl);

    const cached = await this.entitlementCache.load();

    try {
      const boot = await this.apiClient.bootstrap({
        environmentPublicIdentifier: config.appId,
        sdkVersion: SDK_VERSION,
        platform: 'react-native',
      });
      this.sdkSessionToken = boot.sdkSessionToken;
      this.applyEntitlementToken(boot.entitlementToken);
      await this.entitlementCache.save(boot.entitlementToken);
    } catch (networkError) {
      // Offline-first per spec 11.4: fall back to the last cached, previously verified
      // entitlement rather than failing initialisation just because the network is down.
      if (!cached) {
        throw new FormCoachError(
          'LICENCE_INVALID',
          'No network connection and no cached entitlement is available.',
          true
        );
      }
      if (isEntitlementExpired(cached.claims)) {
        throw new FormCoachError('LICENCE_EXPIRED', 'Cached entitlement is outside its offline grace period.', false);
      }
      this.applyEntitlementToken(cached.token);
    }

    this.initialized = true;
  }

  private applyEntitlementToken(token: string): void {
    const claims = decodeEntitlementPayload(token);
    this.cachedEntitlementToken = token;
    this.cachedExercises = claims.exercises;
    this.cachedExpiresAt = claims.expiresAt;
    this.cachedOfflineGraceUntil = claims.offlineGraceUntil;
  }

  private assertInitialized(): void {
    if (!this.initialized || !this.config || !this.apiClient) {
      throw new FormCoachError('SDK_NOT_INITIALIZED', 'FormCoach.initialize() must complete before this call.');
    }
  }

  async getExercises(): Promise<ExerciseSummary[]> {
    this.assertInitialized();
    const response = await fetch(`${this.apiBaseUrl}/v1/exercises`);
    if (!response.ok) throw new FormCoachError('INTERNAL_ERROR', 'Unable to load the exercise catalogue.', true);
    const catalogue = (await response.json()) as Array<{ id: string; name: string }>;
    const licensed = new Set(this.cachedExercises ?? []);
    return catalogue.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      entitlement: licensed.has(exercise.id) ? 'included' : 'locked',
    }));
  }

  async getExerciseDetails(exerciseId: string): Promise<ExerciseDetails> {
    this.assertInitialized();
    const response = await fetch(`${this.apiBaseUrl}/v1/exercises/${exerciseId}`);
    if (!response.ok) throw new FormCoachError('EXERCISE_NOT_FOUND', `Exercise '${exerciseId}' was not found.`);
    const details = (await response.json()) as Omit<ExerciseDetails, 'entitlement'>;
    const licensed = new Set(this.cachedExercises ?? []);
    return { ...details, entitlement: licensed.has(exerciseId) ? 'included' : 'locked' };
  }

  async createSession(config: CreateSessionConfig): Promise<Session> {
    this.assertInitialized();

    if (!this.cachedEntitlementToken || this.cachedExpiresAt === undefined || this.cachedOfflineGraceUntil === undefined) {
      throw new FormCoachError('LICENCE_INVALID', 'No verified entitlement is available.');
    }
    const nowSeconds = Date.now() / 1000;
    if (nowSeconds > this.cachedOfflineGraceUntil) {
      throw new FormCoachError('LICENCE_EXPIRED', 'Entitlement has expired and the offline grace period has passed.');
    }
    if (!this.cachedExercises?.includes(config.exercise)) {
      throw new FormCoachError('EXERCISE_NOT_LICENSED', `Exercise '${config.exercise}' is not included in the current entitlement.`);
    }

    const handle = await this.bridge.createSession(config);
    return new Session(this.bridge, handle.sessionId, config.exercise);
  }
}

/** Singleton facade matching the public API shown in spec section 9. */
export const FormCoach = new FormCoachClient();
