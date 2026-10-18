import { prisma } from '../config/database';
import { logger } from '../config/logger';

const STALE_QUEUE_MINUTES = 15;

export async function runNotificationDeliveryJob(): Promise<{ staleMarked: number }> {
  const cutoff = new Date(Date.now() - STALE_QUEUE_MINUTES * 60 * 1000);
  const result = await prisma.deliveryLog.updateMany({
    where: { status: 'QUEUED', createdAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      lastError: `Delivery was queued for more than ${STALE_QUEUE_MINUTES} minutes and did not complete.`,
    },
  });

  if (result.count > 0) {
    logger.warn({ count: result.count }, 'Marked stale queued email deliveries as failed');
  }
  return { staleMarked: result.count };
}
