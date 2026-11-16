import { createId } from '@paralleldrive/cuid2';

/** Opaque, non-sequential identifier — never expose database row numbers. */
export function newId(): string {
  return createId();
}

/** Public identifiers embedded in a mobile binary are not secrets; they only need to be hard to guess. */
export function newPublicIdentifier(prefix: string): string {
  return `${prefix}_${createId()}`;
}
