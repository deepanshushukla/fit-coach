import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';

interface SweepOptions {
  /** Defaults to env.usageRetentionDays / env.auditLogRetentionDays. Overridable for tests. */
  retentionDays?: number;
  now?: Date;
}

/**
 * Deletes usage events older than the retention window. Unset (the default, both via env
 * and here) means "keep forever" — this never runs with an implicit retention window,
 * only an explicit one.
 */
export async function sweepUsageEvents(options: SweepOptions = {}): Promise<{ deletedCount: number }> {
  const retentionDays = options.retentionDays ?? env.usageRetentionDays;
  if (retentionDays === undefined) return { deletedCount: 0 };

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.usageEvent.deleteMany({ where: { eventTimestamp: { lt: cutoff } } });
  return { deletedCount: result.count };
}

/** Same as sweepUsageEvents but for AuditLog rows, governed by its own retention window. */
export async function sweepAuditLogs(options: SweepOptions = {}): Promise<{ deletedCount: number }> {
  const retentionDays = options.retentionDays ?? env.auditLogRetentionDays;
  if (retentionDays === undefined) return { deletedCount: 0 };

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deletedCount: result.count };
}
