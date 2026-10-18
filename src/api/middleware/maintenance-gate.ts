import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { cache } from '../../config/redis';
import { logger } from '../../config/logger';
import { fail } from '../../shared/response';
import { SETTING_KEYS } from '../../shared/constants';
import { clientIp } from '../../shared/utils/sanitize-request';
import { verifyAccessToken, loadPermissions } from './authenticate';

const CACHE_KEY = 'platform:maintenance-mode';
const CACHE_TTL_SECONDS = 15;

interface MaintenanceState {
  enabled: boolean;
  message: string;
  allowedIps: string[];
}

function ipMatches(ip: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    if (entry === ip) return true;
    if (entry.includes('/')) {
      const [range, bitsRaw] = entry.split('/');
      const bits = Number.parseInt(bitsRaw ?? '', 10);
      if (!range || Number.isNaN(bits)) return false;
      const ipParts = ip.split('.').map(Number);
      const rangeParts = range.split('.').map(Number);
      if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
      const ipValue = ipParts.reduce((acc, part) => (acc << 8) + (part & 0xff), 0) >>> 0;
      const rangeValue = rangeParts.reduce((acc, part) => (acc << 8) + (part & 0xff), 0) >>> 0;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (ipValue & mask) === (rangeValue & mask);
    }
    return false;
  });
}

async function readMaintenanceState(): Promise<MaintenanceState> {
  const cached = await cache.getJson<MaintenanceState>(CACHE_KEY);
  if (cached) return cached;

  try {
    const records = await prisma.platformSetting.findMany({
      where: {
        key: { in: [SETTING_KEYS.MAINTENANCE_MODE, SETTING_KEYS.MAINTENANCE_MESSAGE, SETTING_KEYS.MAINTENANCE_ALLOWED_IPS] },
      },
    });
    const index = new Map(records.map((record) => [record.key, record.value]));
    const state: MaintenanceState = {
      enabled: index.get(SETTING_KEYS.MAINTENANCE_MODE) === true,
      message:
        typeof index.get(SETTING_KEYS.MAINTENANCE_MESSAGE) === 'string'
          ? (index.get(SETTING_KEYS.MAINTENANCE_MESSAGE) as string)
          : 'The platform is undergoing scheduled maintenance.',
      allowedIps: Array.isArray(index.get(SETTING_KEYS.MAINTENANCE_ALLOWED_IPS))
        ? (index.get(SETTING_KEYS.MAINTENANCE_ALLOWED_IPS) as string[])
        : [],
    };
    await cache.setJson(CACHE_KEY, state, CACHE_TTL_SECONDS);
    return state;
  } catch (error) {
    logger.warn({ error }, 'Failed to read maintenance mode — continuing without maintenance enforcement');
    return { enabled: false, message: '', allowedIps: [] };
  }
}

const EXEMPT_PREFIXES = ['/health', '/auth', '/docs', '/openapi.json'];

export async function maintenanceGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const state = await readMaintenanceState();
  if (!state.enabled) {
    next();
    return;
  }

  const path = req.path;
  if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    next();
    return;
  }

  if (ipMatches(clientIp(req), state.allowedIps)) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
      const { permissions } = await loadPermissions(payload.sub);
      if (permissions.includes('*')) {
        next();
        return;
      }
    } catch {
      /* fall through to maintenance response */
    }
  }

  fail(res, 503, 'MAINTENANCE_MODE', state.message);
}
