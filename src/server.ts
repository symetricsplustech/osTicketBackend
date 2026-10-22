import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { closeRedis } from "./config/redis";
import { startJobs, stopJobs } from "./jobs";

async function main(): Promise<void> {
  await connectDatabase();
  logger.info("Database connection established");

  const app = createApp();
  const server = http.createServer(app);

  if (env.JOBS_ENABLED) {
    startJobs();
    logger.info("Background jobs started");
  }

  await new Promise<void>((resolve) => {
    server.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          api: `${env.API_PREFIX}`,
          docs: `${env.API_PREFIX}/docs`,
        },
        `${env.APP_NAME} API listening`,
      );
      resolve();
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down gracefully");
    stopJobs();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      setTimeout(resolve, 10_000).unref();
    });

    await disconnectDatabase();
    await closeRedis();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught exception");
    void shutdown("uncaughtException");
  });
}

void main().catch((error) => {
  logger.error({ error }, "Fatal startup error");
  process.exit(1);
});
