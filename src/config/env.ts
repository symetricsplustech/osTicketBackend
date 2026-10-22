import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const booleanish = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3008),
  API_PREFIX: z.string().default("/api/v1"),
  APP_NAME: z.string().default("ITSM SaaS Platform"),
  APP_VERSION: z.string().default("1.0.0"),
  PUBLIC_API_URL: z.string().default("http://localhost:3008"),
  ADMIN_APP_URL: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PG_SSL: booleanish.default(false),
  PG_CA_CERT: z.string().optional().default(""),

  REDIS_URL: z.string().optional().default(""),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  ENCRYPTION_KEY: z.string().optional().default(""),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(10),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanish.default(false),
  SMTP_USE_TLS: booleanish.default(false),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  MAIL_FROM: z.string().default("no-reply@example.com"),
  MAIL_FROM_NAME: z.string().default("ITSM Platform"),

  STORAGE_LOCAL_DIR: z.string().default("./storage"),

  JOBS_ENABLED: booleanish.default(true),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(6),
  REPORT_MAX_ROWS: z.coerce.number().int().positive().default(50000),
  REPORT_EXPORT_TTL_HOURS: z.coerce.number().int().positive().default(72),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${details}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProd && !env.ENCRYPTION_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[config] ENCRYPTION_KEY is not set. Storing provider credentials, webhook secrets and MFA secrets will fail in production.",
  );
}
