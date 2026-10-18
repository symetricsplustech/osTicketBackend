import { describe, expect, it } from 'vitest';
import type { AuthContext } from '../../src/shared/types/express';
import {
  assertAnyTenantPermission,
  assertTenantPermission,
  hasPermission,
} from '../../src/shared/permissions/guard';
import { ForbiddenError, UnauthorizedError } from '../../src/shared/errors';

function tenantAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    email: 'member@example.com',
    userType: 'TENANT_USER',
    sessionId: 'session-1',
    roles: ['itsm-agent'],
    permissions: ['incidents.read', 'incidents.update', 'incidents.assign'],
    mfaVerified: true,
    activeTenantId: 'tenant-1',
    membershipId: 'membership-1',
    ...overrides,
  };
}

describe('tenant permission guard', () => {
  it('allows a member holding the tenant permission', () => {
    expect(() => assertTenantPermission(tenantAuth(), 'incidents.read')).not.toThrow();
    expect(hasPermission(tenantAuth(), 'incidents.assign')).toBe(true);
  });

  it('rejects a member missing the tenant permission', () => {
    expect(() => assertTenantPermission(tenantAuth(), 'incidents.resolve')).toThrow(ForbiddenError);
  });

  it('rejects unauthenticated callers', () => {
    expect(() => assertTenantPermission(undefined, 'incidents.read')).toThrow(UnauthorizedError);
  });

  it('rejects codes that are not part of the tenant catalog', () => {
    expect(() => assertTenantPermission(tenantAuth(), 'incidents.destroy')).toThrow(ForbiddenError);
    expect(() => assertTenantPermission(tenantAuth(), 'admin.tenants.read')).toThrow(ForbiddenError);
  });

  it('treats the platform wildcard as full access to tenant capabilities', () => {
    const owner = tenantAuth({ roles: ['platform-owner'], permissions: ['*'] });
    expect(() => assertTenantPermission(owner, 'organization.update')).not.toThrow();
    expect(() => assertTenantPermission(owner, 'security.sessions.revoke')).not.toThrow();
  });

  it('supports any-of checks for tenant permissions', () => {
    expect(() =>
      assertAnyTenantPermission(tenantAuth(), ['incidents.resolve', 'incidents.read']),
    ).not.toThrow();
    expect(() =>
      assertAnyTenantPermission(tenantAuth(), ['incidents.resolve', 'changes.approve']),
    ).toThrow(ForbiddenError);
  });
});
