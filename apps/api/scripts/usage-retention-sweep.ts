import 'dotenv/config';
import { sweepUsageEvents, sweepAuditLogs } from '../src/modules/usage/retention';
import { prisma } from '../src/lib/prisma';

/**
 * Deletes usage events / audit logs older than USAGE_RETENTION_DAYS / AUDIT_LOG_RETENTION_DAYS.
 * No in-repo scheduler exists for this — invoke it from an external cron. A no-op (both
 * env vars unset) prints that retention is disabled rather than silently doing nothing.
 */
async function main() {
  const usage = await sweepUsageEvents();
  const auditLogs = await sweepAuditLogs();
  console.log(`Deleted ${usage.deletedCount} usage event(s), ${auditLogs.deletedCount} audit log row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
