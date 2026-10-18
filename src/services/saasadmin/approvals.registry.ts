import { registerApprovalExecutor } from './approvals.service';
import { performTenantArchive, performTenantSuspend } from './tenants.service';
import { PreconditionFailedError } from '../../shared/errors';

let registered = false;

function payloadOf(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

export function registerApprovalExecutors(): void {
  if (registered) return;
  registered = true;

  registerApprovalExecutor('tenant.suspend', async (request) => {
    const payload = payloadOf(request.payload);
    const tenantId = (typeof payload['tenantId'] === 'string' ? payload['tenantId'] : request.resourceId) ?? null;
    if (!tenantId) throw new PreconditionFailedError('The approval request does not reference a tenant.');
    const reason = typeof payload['reason'] === 'string' ? payload['reason'] : 'Approved by approval policy.';
    await performTenantSuspend(tenantId, reason, { actorId: request.requestedById });
  });

  registerApprovalExecutor('tenant.archive', async (request) => {
    const payload = payloadOf(request.payload);
    const tenantId = (typeof payload['tenantId'] === 'string' ? payload['tenantId'] : request.resourceId) ?? null;
    if (!tenantId) throw new PreconditionFailedError('The approval request does not reference a tenant.');
    const reason = typeof payload['reason'] === 'string' ? payload['reason'] : 'Approved by approval policy.';
    await performTenantArchive(tenantId, reason, { actorId: request.requestedById });
  });
}
