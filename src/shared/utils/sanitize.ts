export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value);
}

const SECRET_KEYS = /(password|secret|token|apikey|api_key|authorization|credential|keyhash|refreshtoken|private)/i;

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function redactObject(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'function') return undefined;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    if (!isPlainObject(value)) {
      const custom = value as { toJSON?: () => unknown };
      if (typeof custom.toJSON === 'function') {
        try {
          return redactObject(custom.toJSON(), depth + 1);
        } catch {
          return '[unserializable]';
        }
      }
      return String(value);
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }
      const redacted = redactObject(entry, depth + 1);
      if (redacted !== undefined) result[key] = redacted;
    }
    return result;
  }
  return value;
}

export function truncate(value: string, max = 2000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated]`;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
