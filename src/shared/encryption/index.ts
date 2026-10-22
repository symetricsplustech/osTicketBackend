import crypto from "crypto";
import { env, isProd } from "../../config/env";
import { logger } from "../../config/logger";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function loadKey(): Buffer {
  const configured = env.ENCRYPTION_KEY;
  if (configured) {
    if (/^[0-9a-fA-F]{64}$/.test(configured))
      return Buffer.from(configured, "hex");
    const base64 = Buffer.from(configured, "base64");
    if (base64.length === 32) return base64;
    if (Buffer.byteLength(configured) === 32)
      return Buffer.from(configured, "utf8");
    return crypto.createHash("sha256").update(configured).digest();
  }
  if (isProd) {
    throw new Error(
      "ENCRYPTION_KEY must be configured in production before storing secrets.",
    );
  }
  logger.warn(
    "ENCRYPTION_KEY is not set — deriving a development key from JWT_SECRET.",
  );
  return crypto
    .createHash("sha256")
    .update(`${env.JWT_SECRET}::dev-encryption`)
    .digest();
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Encrypted payload has an unsupported format.");
  }
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function encryptJson(value: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T = Record<string, unknown>>(payload: string): T {
  return JSON.parse(decryptSecret(payload)) as T;
}
