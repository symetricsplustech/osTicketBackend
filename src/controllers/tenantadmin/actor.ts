import type { Request } from 'express';
import { UnauthorizedError } from '../../shared/errors';

export interface TenantActor {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  actorType: string;
  req: Request;
}

export function tenantActor(req: Request): TenantActor {
  if (!req.auth?.activeTenantId) {
    throw new UnauthorizedError('No active organization is selected for this session.');
  }
  return {
    tenantId: req.auth.activeTenantId,
    actorId: req.auth.userId,
    actorEmail: req.auth.email,
    actorType: req.auth.userType,
    req,
  };
}
