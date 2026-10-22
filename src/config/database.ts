import { PrismaClient } from "@prisma/client";
import { env, isProd } from "./env";
import { logger } from "./logger";

const prismaLogConfig = isProd
  ? [{ emit: "event" as const, level: "error" as const }]
  : [
      { emit: "event" as const, level: "error" as const },
      { emit: "event" as const, level: "warn" as const },
    ];

export const prisma = new PrismaClient({
  log: prismaLogConfig,
  datasources: {
    db: { url: env.DATABASE_URL },
  },
});

prisma.$on("error" as never, (event: { message: string }) => {
  logger.error({ prisma: true, message: event.message }, "Prisma error");
});

if (!isProd) {
  prisma.$on("warn" as never, (event: { message: string }) => {
    logger.warn({ prisma: true, message: event.message }, "Prisma warning");
  });
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
