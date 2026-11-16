import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface AuditEntry {
  actorUserId?: string;
  organisationId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/** Every sensitive mutation (role, licence, credential, publication change) must call this. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      organisationId: entry.organisationId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      requestId: entry.requestId,
      metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
