import type { EntitlementClaims } from '@formcoach/types';
import type { Storage } from './storage';
import { decodeEntitlementPayload } from './jwt';

const STORAGE_KEY = 'formcoach.entitlement.token';

export interface CachedEntitlement {
  token: string;
  claims: EntitlementClaims;
}

export class EntitlementCache {
  constructor(private readonly storage: Storage) {}

  async save(token: string): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, token);
  }

  async load(): Promise<CachedEntitlement | null> {
    const token = await this.storage.getItem(STORAGE_KEY);
    if (!token) return null;
    try {
      return { token, claims: decodeEntitlementPayload(token) };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.storage.removeItem(STORAGE_KEY);
  }
}
