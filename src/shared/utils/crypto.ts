import crypto from 'crypto';
import { env } from '../../config/env';

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomHex(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomNumericCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function generateApiKey(): { secret: string; prefix: string; hash: string } {
  const envKey = env.NODE_ENV === 'test' ? 'test' : 'live';
  const prefix = `itsm_${envKey}_${randomHex(4)}`;
  const secret = `${prefix}_${randomToken(24)}`;
  return { secret, prefix, hash: sha256(secret) };
}
