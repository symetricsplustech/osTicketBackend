import { describe, expect, it } from 'vitest';
import type { AuthContext } from '../../src/shared/types/express';
import {
  assertAllPermissions,
  assertAnyPermission,
  assertPermission,
  hasPermission,
} from '../../src/shared/permissions/guard';
import { ForbiddenError, UnauthorizedError } from '../../src/shared/errors';

function auth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    email: 'staff@example.com',
    userType: 'PLATFORM_STAFF',
    sessionId: 'session-1',
    roles: ['platform-admin'],
    permissions: ['admin.tenants.read', 'admin.tenants.create'],
    mfaVerified: true,
    ...overrides,
  };
}

describe('permission guard', () => {
  it('allows a caller holding the permission', () => {
    expect(() => assertPermission(auth(), 'admin.tenants.read')).not.toThrow();
    expect(hasPermission(auth(), 'admin.tenants.create')).toBe(true);
  });

  it('rejects a caller missing the permission', () => {
    expect(() => assertPermission(auth(), 'admin.staff.manage')).toThrow(ForbiddenError);
  });

  it('rejects unauthenticated callers', () => {
    expect(() => assertPermission(undefined, 'admin.tenants.read')).toThrow(UnauthorizedError);
  });

  it('rejects unknown permission codes', () => {
    expect(() => assertPermission(auth(), 'admin.not-a-real-permission')).toThrow(ForbiddenError);
  });

  it('treats the wildcard permission as full access', () => {
    const owner = auth({ roles: ['platform-owner'], permissions: ['*'] });
    expect(() => assertPermission(owner, 'admin.staff.privileged')).not.toThrow();
    expect(hasPermission(owner, 'admin.settings.manage')).toBe(true);
  });

  it('supports any-of checks', () => {
    expect(() => assertAnyPermission(auth(), ['admin.staff.manage', 'admin.tenants.read'])).not.toThrow();
    expect(() => assertAnyPermission(auth(), ['admin.staff.manage', 'admin.roles.manage'])).toThrow(ForbiddenError);
  });

  it('supports all-of checks and reports missing permissions', () => {
    expect(() => assertAllPermissions(auth(), ['admin.tenants.read', 'admin.tenants.create'])).not.toThrow();
    expect(() => assertAllPermissions(auth(), ['admin.tenants.read', 'admin.roles.manage'])).toThrow(
      /admin\.roles\.manage/,
    );
  });
});
