import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { cleanupExpiredSessions } from '../services/auth/session.service';
import { expireStaleRequests } from '../services/saasadmin/approvals.service';

export interface MaintenanceResult {
  sessionsCleaned: number;
  approvalsExpired: number;
  resetTokensCleaned: number;
  auditEventsPurged: number;
  backgroundJobsCleaned: number;
}

export async function runTenantMaintenanceJob(): Promise<MaintenanceResult> {
  const sessionsCleaned = await cleanupExpiredSessions();
  const approvalsExpired = await expireStaleRequests();

  const resetTokens = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null, lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }] },
  });

  let auditEventsPurged = 0;
  const auditRetention = await prisma.retentionPolicy.findUnique({ where: { resourceKey: 'audit-events' } });
  if (auditRetention?.isEnabled && auditRetention.action === 'DELETE') {
    const cutoff = new Date(Date.now() - auditRetention.retentionDays * 24 * 60 * 60 * 1000);
    const purged = await prisma.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    auditEventsPurged = purged.count;
  } else if (env.AUDIT_RETENTION_DAYS > 0) {
    const cutoff = new Date(Date.now() - env.AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const purged = await prisma.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    auditEventsPurged = purged.count;
  }

  const backgroundJobs = await prisma.backgroundJob.deleteMany({
    where: {
      status: { in: ['COMPLETED', 'CANCELLED', 'FAILED'] },
      completedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  const result: MaintenanceResult = {
    sessionsCleaned,
    approvalsExpired,
    resetTokensCleaned: resetTokens.count,
    auditEventsPurged,
    backgroundJobsCleaned: backgroundJobs.count,
  };

  if (Object.values(result).some((count) => count > 0)) {
    logger.info(result, 'Tenant maintenance job completed');
  }
  return result;
}
