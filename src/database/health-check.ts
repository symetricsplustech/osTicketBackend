import { prisma } from "../config/database";
import { redisHealth } from "../config/redis";
import { storage } from "../config/storage";

export interface DatabaseHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export async function checkDatabase(): Promise<DatabaseHealth> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

export interface InfrastructureHealth {
  database: DatabaseHealth;
  redis: { configured: boolean; connected: boolean };
  storage: { ok: boolean; baseDir: string; usedBytes: number };
  uptimeSeconds: number;
  memoryBytes: number;
}

export async function checkInfrastructure(): Promise<InfrastructureHealth> {
  const database = await checkDatabase();
  let storageOk = true;
  let usedBytes = 0;
  try {
    usedBytes = storage.statSizeSync();
  } catch {
    storageOk = false;
  }
  return {
    database,
    redis: redisHealth(),
    storage: { ok: storageOk, baseDir: storage.baseDir, usedBytes },
    uptimeSeconds: Math.round(process.uptime()),
    memoryBytes: process.memoryUsage().rss,
  };
}
