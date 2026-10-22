import { logger } from "../config/logger";
import { runWebhookRetryJob } from "./webhook-retry.job";
import { runTenantMaintenanceJob } from "./tenant-maintenance.job";
import { runNotificationDeliveryJob } from "./notification-delivery.job";
import { runSlaMonitorJob } from "./sla-monitor.job";
import { runReportGenerationJob } from "./report-generation.job";

interface JobDefinition {
  name: string;
  intervalMs: number;
  initialDelayMs: number;
  run: () => Promise<unknown>;
  running: boolean;
  lastStartedAt: Date | null;
  lastCompletedAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
  runCount: number;
}

const definitions: JobDefinition[] = [
  {
    name: "webhook-retry",
    intervalMs: 30_000,
    initialDelayMs: 10_000,
    run: runWebhookRetryJob,
    running: false,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
  },
  {
    name: "report-generation",
    intervalMs: 15_000,
    initialDelayMs: 5_000,
    run: runReportGenerationJob,
    running: false,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
  },
  {
    name: "notification-delivery",
    intervalMs: 120_000,
    initialDelayMs: 30_000,
    run: runNotificationDeliveryJob,
    running: false,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
  },
  {
    name: "tenant-maintenance",
    intervalMs: 600_000,
    initialDelayMs: 60_000,
    run: runTenantMaintenanceJob,
    running: false,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
  },
  {
    name: "sla-monitor",
    intervalMs: 900_000,
    initialDelayMs: 120_000,
    run: runSlaMonitorJob,
    running: false,
    lastStartedAt: null,
    lastCompletedAt: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
  },
];

const timers: NodeJS.Timeout[] = [];
let started = false;

async function execute(job: JobDefinition): Promise<void> {
  if (job.running) return;
  job.running = true;
  job.lastStartedAt = new Date();
  const startedAt = Date.now();
  try {
    await job.run();
    job.lastError = null;
  } catch (error) {
    job.lastError = error instanceof Error ? error.message : String(error);
    logger.error(
      { job: job.name, error: job.lastError },
      "Background job failed",
    );
  } finally {
    job.running = false;
    job.lastCompletedAt = new Date();
    job.lastDurationMs = Date.now() - startedAt;
    job.runCount += 1;
  }
}

export function startJobs(): void {
  if (started) return;
  started = true;
  for (const job of definitions) {
    const initial = setTimeout(() => {
      void execute(job);
      const timer = setInterval(() => void execute(job), job.intervalMs);
      timers.push(timer);
    }, job.initialDelayMs);
    timers.push(initial);
  }
  logger.info(
    { jobs: definitions.map((job) => job.name) },
    "Job scheduler started",
  );
}

export function stopJobs(): void {
  for (const timer of timers) clearTimeout(timer as unknown as NodeJS.Timeout);
  timers.length = 0;
  started = false;
}

export function getJobSchedulerState() {
  return {
    started,
    jobs: definitions.map((job) => ({
      name: job.name,
      intervalMs: job.intervalMs,
      running: job.running,
      runCount: job.runCount,
      lastStartedAt: job.lastStartedAt,
      lastCompletedAt: job.lastCompletedAt,
      lastDurationMs: job.lastDurationMs,
      lastError: job.lastError,
    })),
  };
}

export {
  runWebhookRetryJob,
  runTenantMaintenanceJob,
  runNotificationDeliveryJob,
  runSlaMonitorJob,
  runReportGenerationJob,
};
