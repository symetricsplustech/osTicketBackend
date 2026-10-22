import type { AuthContext } from "../types/express";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { isKnownPermission } from "./catalog";
import { isKnownTenantPermission } from "./tenant-catalog";

export function assertAuthenticated(
  auth: AuthContext | undefined,
): asserts auth is AuthContext {
  if (!auth) throw new UnauthorizedError();
}

export function hasPermission(
  auth: AuthContext | undefined,
  code: string,
): boolean {
  if (!auth) return false;
  return auth.permissions.includes(code) || auth.permissions.includes("*");
}

export function assertPermission(
  auth: AuthContext | undefined,
  code: string,
): void {
  assertAuthenticated(auth);
  if (!isKnownPermission(code)) {
    throw new ForbiddenError(
      "Permission code is not recognised by the platform.",
    );
  }
  if (!hasPermission(auth, code)) {
    throw new ForbiddenError(`Missing required permission: ${code}.`);
  }
}

export function assertAnyPermission(
  auth: AuthContext | undefined,
  codes: string[],
): void {
  assertAuthenticated(auth);
  if (codes.some((code) => hasPermission(auth, code))) return;
  throw new ForbiddenError(
    `Missing required permission: one of ${codes.join(", ")}.`,
  );
}

export function assertAllPermissions(
  auth: AuthContext | undefined,
  codes: string[],
): void {
  assertAuthenticated(auth);
  const missing = codes.filter((code) => !hasPermission(auth, code));
  if (missing.length > 0) {
    throw new ForbiddenError(
      `Missing required permissions: ${missing.join(", ")}.`,
    );
  }
}

export function assertTenantPermission(
  auth: AuthContext | undefined,
  code: string,
): void {
  assertAuthenticated(auth);
  if (!isKnownTenantPermission(code)) {
    throw new ForbiddenError(
      "Permission code is not recognised by the platform.",
    );
  }
  if (!hasPermission(auth, code)) {
    throw new ForbiddenError(`Missing required permission: ${code}.`);
  }
}

export function assertAnyTenantPermission(
  auth: AuthContext | undefined,
  codes: string[],
): void {
  assertAuthenticated(auth);
  if (codes.some((code) => hasPermission(auth, code))) return;
  throw new ForbiddenError(
    `Missing required permission: one of ${codes.join(", ")}.`,
  );
}
