import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let client: Redis | null = null;
let initialised = false;

export function getRedis(): Redis | null {
  if (initialised) return client;
  initialised = true;
  if (!env.REDIS_URL) return null;
  try {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    client.on("error", (error) => {
      logger.warn(
        { error: error.message },
        "Redis connection error — falling back to in-memory cache",
      );
    });
    return client;
  } catch (error) {
    logger.warn(
      { error },
      "Failed to initialise Redis — falling back to in-memory cache",
    );
    client = null;
    return null;
  }
}

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

const memoryStore = new Map<string, MemoryEntry>();

export const cache = {
  async get(key: string): Promise<string | null> {
    const redis = getRedis();
    if (redis) {
      try {
        return await redis.get(key);
      } catch {
        /* fall through to memory */
      }
    }
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        if (ttlSeconds) await redis.set(key, value, "EX", ttlSeconds);
        else await redis.set(key, value);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  },

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(key);
      } catch {
        /* fall through to memory */
      }
    }
    memoryStore.delete(key);
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  },

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const redis = getRedis();
    if (redis) {
      try {
        const value = await redis.incr(key);
        if (value === 1) await redis.expire(key, ttlSeconds);
        return value;
      } catch {
        /* fall through to memory */
      }
    }
    const entry = memoryStore.get(key);
    const now = Date.now();
    if (!entry || (entry.expiresAt !== null && entry.expiresAt <= now)) {
      memoryStore.set(key, { value: "1", expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number.parseInt(entry.value, 10) + 1;
    entry.value = String(next);
    return next;
  },
};

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}

export function redisHealth(): { configured: boolean; connected: boolean } {
  const redis = getRedis();
  return {
    configured: Boolean(env.REDIS_URL),
    connected: Boolean(redis && redis.status === "ready"),
  };
}
