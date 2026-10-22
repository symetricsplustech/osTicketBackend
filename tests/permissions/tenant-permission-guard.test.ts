import { describe, expect, it } from "vitest";
import type { AuthContext } from "../../src/shared/types/express";
import {
  assertAnyTenantPermission,
  assertTenantPermission,
  hasPermission,
} from "../../src/shared/permissions/guard";
import { ForbiddenError, UnauthorizedError } from "../../src/shared/errors";

function tenantAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    email: "member@example.com",
    userType: "TENANT_USER",
    sessionId: "session-1",
    roles: ["itsm-agent"],
    permissions: ["incidents.read", "incidents.update", "incidents.assign"],
    mfaVerified: true,
    activeTenantId: "tenant-1",
    membershipId: "membership-1",
    ...overrides,
  };
}

describe("tenant permission guard", () => {
  it("allows a member holding the tenant permission", () => {
    expect(() =>
      assertTenantPermission(tenantAuth(), "incidents.read"),
    ).not.toThrow();
    expect(hasPermission(tenantAuth(), "incidents.assign")).toBe(true);
  });

  it("rejects a member missing the tenant permission", () => {
    expect(() =>
      assertTenantPermission(tenantAuth(), "incidents.resolve"),
    ).toThrow(ForbiddenError);
  });

  it("rejects unauthenticated callers", () => {
    expect(() => assertTenantPermission(undefined, "incidents.read")).toThrow(
      UnauthorizedError,
    );
  });

  it("rejects codes that are not part of the tenant catalog", () => {
    expect(() =>
      assertTenantPermission(tenantAuth(), "incidents.destroy"),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertTenantPermission(tenantAuth(), "admin.tenants.read"),
    ).toThrow(ForbiddenError);
  });

  it("treats the platform wildcard as full access to tenant capabilities", () => {
    const owner = tenantAuth({ roles: ["platform-owner"], permissions: ["*"] });
    expect(() =>
      assertTenantPermission(owner, "organization.update"),
    ).not.toThrow();
    expect(() =>
      assertTenantPermission(owner, "security.sessions.revoke"),
    ).not.toThrow();
  });

  it("supports any-of checks for tenant permissions", () => {
    expect(() =>
      assertAnyTenantPermission(tenantAuth(), [
        "incidents.resolve",
        "incidents.read",
      ]),
    ).not.toThrow();
    expect(() =>
      assertAnyTenantPermission(tenantAuth(), [
        "incidents.resolve",
        "changes.approve",
      ]),
    ).toThrow(ForbiddenError);
  });

  describe("Remote Engineer cannot create incidents but can work assigned", () => {
    const remoteEngineer = tenantAuth({
      roles: ["remote-engineer"],
      permissions: [
        "incidents.read_assigned",
        "incidents.update_assigned",
        "requests.read_assigned",
        "requests.update_assigned",
        "attachments.upload",
        "escalations.create",
        "field_service.request",
        "knowledge.read",
        "dashboard.read",
      ],
    });

    it("cannot create incidents", () => {
      expect(() =>
        assertTenantPermission(remoteEngineer, "incidents.create"),
      ).toThrow(ForbiddenError);
    });

    it("cannot update incidents generally (only assigned)", () => {
      expect(() =>
        assertTenantPermission(remoteEngineer, "incidents.update"),
      ).toThrow(ForbiddenError);
    });

    it("can update assigned incidents", () => {
      expect(() =>
        assertTenantPermission(remoteEngineer, "incidents.update_assigned"),
      ).not.toThrow();
    });

    it("can read assigned incidents", () => {
      expect(() =>
        assertTenantPermission(remoteEngineer, "incidents.read_assigned"),
      ).not.toThrow();
    });

    it("cannot access field jobs", () => {
      expect(() =>
        assertTenantPermission(remoteEngineer, "field_jobs.complete"),
      ).toThrow(ForbiddenError);
    });
  });

  describe("Field Engineer cannot create incidents but can complete field jobs", () => {
    const fieldEngineer = tenantAuth({
      roles: ["field-engineer"],
      permissions: [
        "field_jobs.read_assigned",
        "field_jobs.update_assigned",
        "field_jobs.check_in",
        "field_jobs.check_out",
        "field_jobs.complete",
        "field_jobs.reschedule_request",
        "attachments.upload",
        "evidence.create",
        "knowledge.read",
        "escalations.create",
        "assets.read_assigned_site",
        "dashboard.read",
      ],
    });

    it("cannot create incidents", () => {
      expect(() =>
        assertTenantPermission(fieldEngineer, "incidents.create"),
      ).toThrow(ForbiddenError);
    });

    it("cannot update incidents", () => {
      expect(() =>
        assertTenantPermission(fieldEngineer, "incidents.update_assigned"),
      ).toThrow(ForbiddenError);
    });

    it("can complete assigned field jobs", () => {
      expect(() =>
        assertTenantPermission(fieldEngineer, "field_jobs.complete"),
      ).not.toThrow();
    });

    it("can check in at sites", () => {
      expect(() =>
        assertTenantPermission(fieldEngineer, "field_jobs.check_in"),
      ).not.toThrow();
    });

    it("can read assets at assigned sites", () => {
      expect(() =>
        assertTenantPermission(fieldEngineer, "assets.read_assigned_site"),
      ).not.toThrow();
    });
  });

  describe("Customer Contact can create own requests but not incidents", () => {
    const customerContact = tenantAuth({
      roles: ["customer-contact"],
      permissions: [
        "portal.read",
        "portal.tickets.create",
        "requests.read",
        "requests.create",
      ],
    });

    it("can create service requests", () => {
      expect(() =>
        assertTenantPermission(customerContact, "requests.create"),
      ).not.toThrow();
    });

    it("can create portal tickets", () => {
      expect(() =>
        assertTenantPermission(customerContact, "portal.tickets.create"),
      ).not.toThrow();
    });

    it("cannot create incidents", () => {
      expect(() =>
        assertTenantPermission(customerContact, "incidents.create"),
      ).toThrow(ForbiddenError);
    });

    it("cannot read incidents", () => {
      expect(() =>
        assertTenantPermission(customerContact, "incidents.read"),
      ).toThrow(ForbiddenError);
    });

    it("cannot access dashboard", () => {
      expect(() =>
        assertTenantPermission(customerContact, "dashboard.read"),
      ).toThrow(ForbiddenError);
    });
  });
});
