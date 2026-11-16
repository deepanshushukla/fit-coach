import { createId } from '@paralleldrive/cuid2';

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const suffix = createId().slice(0, 6);
  return `${base || 'org'}-${suffix}`;
}
