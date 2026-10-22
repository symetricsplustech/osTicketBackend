import { processQueuedReportJobs } from "../services/saasadmin/reports.service";
import { logger } from "../config/logger";

export async function runReportGenerationJob(): Promise<{ processed: number }> {
  const processed = await processQueuedReportJobs(3);
  if (processed > 0) {
    logger.debug(
      { processed },
      "Report generation job processed queued exports",
    );
  }
  return { processed };
}
