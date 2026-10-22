import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3999/api/v1";
const EMAIL = process.env.E2E_EMAIL ?? "owner@test.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "Str0ng!Passw0rd#2026";
const DIRECT_DB_URL =
  process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

let token = "";
let refreshToken = "";
let tenantId = "";
let domainId = "";
let apiKeyId = "";
let apiKeySecret = "";
let failures = 0;
let step = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  step += 1;
  if (condition) {
    console.log(`  PASS ${step}. ${name}`);
  } else {
    failures += 1;
    console.log(
      `  FAIL ${step}. ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 300)}` : ""}`,
    );
  }
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  opts?: { auth?: boolean; raw?: boolean },
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.auth !== false && token)
    headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function main(): Promise<void> {
  console.log("\n== Authentication ==");
  let res = await api(
    "POST",
    "/auth/login",
    { email: EMAIL, password: PASSWORD },
    { auth: false },
  );
  check(
    "login succeeds",
    res.status === 200 && res.body.success === true,
    res.body,
  );
  token = res.body?.data?.accessToken ?? "";
  refreshToken = res.body?.data?.refreshToken ?? "";
  check(
    "login returns tokens and permissions",
    Boolean(token && refreshToken) &&
      Array.isArray(res.body?.data?.permissions),
    res.body?.data,
  );
  check(
    "owner receives permission catalog (>=50)",
    (res.body?.data?.permissions?.length ?? 0) >= 50,
    res.body?.data?.permissions?.length,
  );

  res = await api("GET", "/auth/me");
  check(
    "GET /auth/me returns profile",
    res.status === 200 && res.body?.data?.profile?.email === EMAIL,
    res.body,
  );

  res = await api("POST", "/auth/refresh", { refreshToken }, { auth: false });
  check(
    "refresh rotates tokens",
    res.status === 200 &&
      res.body?.data?.accessToken &&
      res.body?.data?.accessToken !== token,
    res.status,
  );
  token = res.body?.data?.accessToken ?? token;
  refreshToken = res.body?.data?.refreshToken ?? refreshToken;

  console.log("\n== Tenants ==");
  res = await api("POST", "/admin/tenants", {
    name: "Acme Technologies",
    slug: "acme",
    primaryContactName: "Admin User",
    primaryContactEmail: "admin@acme.example.com",
    timezone: "Asia/Kolkata",
    locale: "en-IN",
  });
  check("create tenant returns 201", res.status === 201, res.body);
  tenantId = res.body?.data?.id ?? "";
  check(
    "tenant provisioning completed",
    res.body?.data?.provisioningStatus === "COMPLETED",
    res.body?.data?.provisioningStatus,
  );
  check(
    "tenant provisioning created settings and assignments",
    res.body?.data?.provisioning?.steps?.length === 6,
    res.body?.data?.provisioning,
  );

  res = await api("POST", `/admin/tenants/${tenantId}/activate`);
  check(
    "activate tenant becomes ACTIVE",
    res.status === 200 && res.body?.data?.status === "ACTIVE",
    res.body,
  );

  res = await api("GET", "/admin/tenants?search=acme");
  check(
    "tenant list search returns the tenant",
    res.status === 200 && (res.body?.meta?.total ?? 0) >= 1,
    res.body?.meta,
  );

  res = await api("GET", `/admin/tenants/${tenantId}/overview`);
  check(
    "tenant overview returns operational data",
    res.status === 200 && res.body?.data?.operational?.enabledServices >= 6,
    res.body?.data?.operational,
  );

  res = await api("GET", `/admin/tenants/${tenantId}/health`);
  check(
    "tenant health is healthy",
    res.status === 200 && res.body?.data?.status === "healthy",
    res.body?.data,
  );

  res = await api("GET", `/admin/tenants/${tenantId}/provisioning-status`);
  check(
    "provisioning status endpoint",
    res.status === 200 &&
      res.body?.data?.tenant?.provisioningStatus === "COMPLETED",
    res.status,
  );

  console.log("\n== Tenant Domains ==");
  res = await api("POST", `/admin/tenants/${tenantId}/domains`, {
    domain: "portal.acme.example.com",
    type: "CUSTOM",
  });
  check(
    "add domain",
    res.status === 201 && res.body?.data?.status === "PENDING_VERIFICATION",
    res.body,
  );
  domainId = res.body?.data?.id ?? "";

  res = await api(
    "GET",
    `/admin/tenants/${tenantId}/domains/${domainId}/verification-status`,
  );
  check(
    "verification status includes DNS instructions",
    res.status === 200 && res.body?.data?.dnsInstructions?.recordType === "TXT",
    res.body?.data,
  );

  res = await api(
    "POST",
    `/admin/tenants/${tenantId}/domains/${domainId}/verify`,
  );
  check(
    "server-side verification correctly fails without DNS record",
    res.status === 200 && res.body?.data?.status === "PENDING_VERIFICATION",
    res.body?.data?.status,
  );

  res = await api(
    "POST",
    `/admin/tenants/${tenantId}/domains/${domainId}/activate`,
  );
  check("cannot activate unverified domain", res.status === 412, res.status);

  console.log("\n== Tenant lifecycle ==");
  res = await api("POST", `/admin/tenants/${tenantId}/suspend`, {
    reason: "Non-payment simulation for E2E test",
  });
  check(
    "suspend tenant",
    res.status === 200 && res.body?.data?.status === "SUSPENDED",
    res.body,
  );
  res = await api("POST", `/admin/tenants/${tenantId}/reactivate`);
  check(
    "reactivate tenant",
    res.status === 200 && res.body?.data?.status === "ACTIVE",
    res.body,
  );
  res = await api("POST", `/admin/tenants/${tenantId}/archive`, {
    reason: "E2E archive test reason",
  });
  check("archive requires suspension first", res.status === 412, res.status);
  res = await api("POST", `/admin/tenants/${tenantId}/suspend`, {
    reason: "Preparing for archive in E2E test",
  });
  res = await api("POST", `/admin/tenants/${tenantId}/archive`, {
    reason: "E2E archive test reason",
  });
  check(
    "archive suspended tenant",
    res.status === 200 && res.body?.data?.status === "ARCHIVED",
    res.body,
  );

  console.log("\n== Staff, roles, permissions ==");
  res = await api("GET", "/admin/staff");
  check(
    "staff list contains owner",
    res.status === 200 && res.body?.meta?.total >= 1,
    res.body?.meta,
  );
  res = await api("GET", "/admin/roles");
  check(
    "roles list contains 5 system roles",
    res.status === 200 && res.body?.meta?.total === 5,
    res.body?.rows?.length,
  );
  res = await api("GET", "/admin/roles/permission-catalog");
  check(
    "permission catalog grouped by module",
    res.status === 200 && Object.keys(res.body?.data ?? {}).length >= 15,
    Object.keys(res.body?.data ?? {}).length,
  );
  res = await api("GET", "/admin/permissions/groups");
  check(
    "permissions groups endpoint",
    res.status === 200 && Array.isArray(res.body?.data),
    res.status,
  );

  console.log("\n== Approvals ==");
  res = await api("GET", "/admin/approvals/my-pending");
  check(
    "my pending approvals",
    res.status === 200 && Array.isArray(res.body?.data),
    res.status,
  );

  console.log("\n== Service catalog / SLA / workflows / config ==");
  res = await api("GET", "/admin/service-management/services");
  check(
    "seeded services visible",
    res.status === 200 && res.body?.meta?.total >= 6,
    res.body?.meta,
  );
  res = await api("GET", "/admin/sla-management/calendars");
  check(
    "business calendar seeded",
    res.status === 200 && res.body?.meta?.total >= 1,
    res.body?.meta,
  );
  res = await api("GET", "/admin/workflow-management/templates");
  check("workflow templates list", res.status === 200, res.status);
  res = await api("GET", "/admin/itsm-configuration/modules");
  check(
    "20 ITSM modules configured",
    res.status === 200 && res.body?.data?.length === 20,
    res.body?.data?.length,
  );
  res = await api("GET", "/admin/knowledge-management/policies");
  check(
    "knowledge policy seeded",
    res.status === 200 && res.body?.data?.length >= 1,
    res.body?.data?.length,
  );
  res = await api("GET", "/admin/cmdb-assets/ci-types");
  check("cmdb ci types list", res.status === 200, res.status);

  console.log("\n== Email, integrations, API keys, webhooks ==");
  res = await api("GET", "/admin/email-notifications/providers");
  check("email providers list", res.status === 200, res.status);
  res = await api("GET", "/admin/email-notifications/delivery-logs");
  check("delivery logs list", res.status === 200, res.status);
  res = await api("GET", "/admin/integrations");
  check("integrations list", res.status === 200, res.status);

  res = await api("POST", "/admin/api-keys", {
    name: "E2E key",
    scopes: ["admin.tenants.read"],
    expiresInDays: 30,
  });
  check(
    "create API key returns secret once",
    res.status === 201 && typeof res.body?.data?.secret === "string",
    res.body?.data,
  );
  apiKeyId = res.body?.data?.id ?? "";
  apiKeySecret = res.body?.data?.secret ?? "";
  res = await api("GET", `/admin/api-keys/${apiKeyId}`);
  check(
    "API key detail never returns secret/hash",
    res.status === 200 &&
      !("secret" in (res.body?.data ?? {})) &&
      !("keyHash" in (res.body?.data ?? {})),
    res.body?.data,
  );

  res = await api("POST", "/admin/webhooks", {
    name: "Bad endpoint",
    url: "http://127.0.0.1:9/hook",
    eventKeys: ["tenant.created"],
  });
  check(
    "SSRF guard blocks private webhook URL",
    res.status === 422 || res.status === 400,
    res.body,
  );

  res = await api("POST", "/admin/webhooks", {
    name: "E2E hook",
    url: "https://93.184.216.34/hook",
    eventKeys: ["tenant.created"],
  });
  check(
    "create webhook with public URL",
    res.status === 201 && typeof res.body?.data?.secret === "string",
    res.status,
  );

  console.log("\n== API key authentication scope enforcement ==");
  const keyRes = await fetch(`${BASE}/admin/tenants`, {
    headers: { "X-Api-Key": apiKeySecret },
  });
  check(
    "API key with tenants read scope can list tenants",
    keyRes.status === 200,
    keyRes.status,
  );
  const keyForbidden = await fetch(`${BASE}/admin/staff`, {
    headers: { "X-Api-Key": apiKeySecret },
  });
  check(
    "API key scope denies staff access",
    keyForbidden.status === 403,
    keyForbidden.status,
  );

  console.log("\n== Dashboard, reports, audit, system administration ==");
  res = await api("GET", "/admin/dashboard/summary");
  check(
    "dashboard summary counts tenants",
    res.status === 200 && (res.body?.data?.tenants?.total ?? 0) >= 1,
    res.body?.data?.tenants,
  );
  res = await api("GET", "/admin/dashboard/platform-health");
  check(
    "platform health returns components",
    res.status === 200 && Array.isArray(res.body?.data?.components),
    res.status,
  );
  res = await api("GET", "/admin/dashboard/alerts");
  check(
    "dashboard alerts",
    res.status === 200 && Array.isArray(res.body?.data?.alerts),
    res.status,
  );
  res = await api("GET", "/admin/dashboard/work-queue");
  check("work queue", res.status === 200 && res.body?.data?.counts, res.status);

  res = await api("POST", "/admin/reports/run", {
    reportKey: "tenant-usage",
    filters: {},
    limit: 50,
  });
  check(
    "run tenant-usage report",
    res.status === 200 && (res.body?.data?.rows?.length ?? 0) >= 1,
    res.body?.data?.rowCount,
  );
  res = await api("GET", "/admin/reports/security-summary");
  check(
    "security summary metrics",
    res.status === 200 && Array.isArray(res.body?.data?.metrics),
    res.status,
  );

  res = await api("POST", "/admin/reports/exports", {
    reportKey: "audit-events",
    format: "CSV",
    reason: "E2E export validation",
  });
  check(
    "export queued",
    res.status === 202 && res.body?.data?.status === "QUEUED",
    res.body?.data?.status,
  );
  const exportId = res.body?.data?.id ?? "";
  let exportStatus = "";
  for (let i = 0; i < 20 && exportStatus !== "COMPLETED"; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    res = await api("GET", `/admin/reports/exports/${exportId}`);
    exportStatus = res.body?.data?.status ?? "";
  }
  check(
    "export processed by background job to COMPLETED",
    exportStatus === "COMPLETED",
    exportStatus,
  );
  const download = await fetch(
    `${BASE}/admin/reports/runs/${exportId}/download`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  check(
    "export file downloads as CSV",
    download.status === 200 &&
      (download.headers.get("content-type") ?? "").includes("text/csv"),
    download.status,
  );

  res = await api("GET", "/admin/audit/events?search=tenant.created");
  check(
    "audit events recorded for tenant creation",
    res.status === 200 && res.body?.meta?.total >= 1,
    res.body?.meta,
  );
  res = await api("GET", "/admin/audit/privileged-actions");
  check(
    "privileged actions searchable",
    res.status === 200 && res.body?.meta?.total >= 1,
    res.body?.meta,
  );
  res = await api("GET", "/admin/audit/login-events?outcome=SUCCESS");
  check(
    "login events recorded",
    res.status === 200 && res.body?.meta?.total >= 1,
    res.body?.meta,
  );

  res = await api("GET", "/admin/system-administration/health");
  check(
    "system health",
    res.status === 200 &&
      ["healthy", "degraded"].includes(res.body?.data?.status),
    res.body?.data?.status,
  );
  res = await api("GET", "/admin/system-administration/version");
  check(
    "version endpoint",
    res.status === 200 && res.body?.data?.nodeVersion,
    res.status,
  );
  res = await api("GET", "/admin/system-administration/diagnostics");
  check(
    "diagnostics run",
    res.status === 200 && Array.isArray(res.body?.data?.checks),
    res.status,
  );

  console.log("\n== Platform settings, my account ==");
  res = await api("GET", "/admin/platform-settings/security");
  check(
    "security settings with defaults",
    res.status === 200 && res.body?.data?.passwordPolicy,
    res.body?.data,
  );
  res = await api("PATCH", "/admin/platform-settings/branding", {
    platformName: "Acme ITSM",
  });
  check(
    "branding update",
    res.status === 200 && res.body?.data?.platformName === "Acme ITSM",
    res.body?.data,
  );
  res = await api("GET", "/admin/my-account/profile");
  check(
    "my account profile",
    res.status === 200 && res.body?.data?.profile?.email === EMAIL,
    res.status,
  );
  res = await api("GET", "/admin/my-account/security");
  check(
    "my account security shows MFA status",
    res.status === 200 && res.body?.data?.mfa?.enabled === false,
    res.body?.data?.mfa,
  );

  console.log("\n== Approval policy execution ==");
  if (!DIRECT_DB_URL) {
    console.error(
      "E2E_DATABASE_URL (or DATABASE_URL) must be set explicitly so the test writes only to the intended database. Refusing to fall back to backend/.env.",
    );
    process.exit(1);
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: DIRECT_DB_URL } },
  });
  try {
    const secondEmail = "approver-test@test.local";
    const secondPassword = "An0ther!Passw0rd#77";
    const passwordHash = await bcrypt.hash(secondPassword, 12);
    const second = await prisma.user.upsert({
      where: { email: secondEmail },
      create: {
        email: secondEmail,
        passwordHash,
        firstName: "Second",
        lastName: "Admin",
        userType: "PLATFORM_STAFF",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      update: { passwordHash, status: "ACTIVE" },
    });
    const platformAdminRole = await prisma.platformRole.findUnique({
      where: { key: "platform-admin" },
    });
    const ownerRole = await prisma.platformRole.findUnique({
      where: { key: "platform-owner" },
    });
    check("test roles resolved", Boolean(platformAdminRole && ownerRole), null);
    await prisma.staffRoleAssignment.upsert({
      where: {
        userId_roleId: { userId: second.id, roleId: platformAdminRole!.id },
      },
      create: { userId: second.id, roleId: platformAdminRole!.id },
      update: {},
    });

    res = await api("POST", "/admin/approvals/policies", {
      name: "Tier-2 suspension approval",
      actionScope: "tenant.suspend",
      approverRoleIds: [ownerRole!.id],
      minApprovals: 1,
    });
    check("create suspension approval policy", res.status === 201, res.body);

    res = await api("POST", "/admin/tenants", {
      name: "Beta Corp",
      slug: "beta-corp",
      primaryContactEmail: "ops@beta.example.com",
    });
    const betaId = res.body?.data?.id ?? "";
    await api("POST", `/admin/tenants/${betaId}/activate`);
    check("second tenant created for approval test", Boolean(betaId), res.body);

    const login2 = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: secondEmail, password: secondPassword }),
    });
    const login2Body: any = await login2.json();
    check(
      "second (non-owner) admin can sign in",
      login2.status === 200 && Boolean(login2Body?.data?.accessToken),
      login2.status,
    );
    const token2 = login2Body?.data?.accessToken ?? "";

    const suspendAsSecond = await fetch(
      `${BASE}/admin/tenants/${betaId}/suspend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({ reason: "Approval flow validation" }),
      },
    );
    const suspendBody: any = await suspendAsSecond.json();
    check(
      "gated suspension returns 202 APPROVAL_REQUIRED",
      suspendAsSecond.status === 202 &&
        suspendBody?.error?.code === "APPROVAL_REQUIRED",
      suspendBody,
    );
    const approvalRequestId = suspendBody?.error?.meta?.approvalRequestId ?? "";

    res = await api("GET", "/admin/approvals/my-pending");
    check(
      "approver sees the pending request",
      res.status === 200 &&
        (res.body?.data ?? []).some(
          (request: any) => request.id === approvalRequestId,
        ),
      res.status,
    );

    res = await api(
      "POST",
      `/admin/approvals/requests/${approvalRequestId}/approve`,
      { decision: "APPROVED" },
    );
    check(
      "approver approves the request",
      res.status === 200 && res.body?.data?.status === "APPROVED",
      res.body?.data?.status,
    );

    res = await api("GET", `/admin/tenants/${betaId}`);
    check(
      "approved action executed (tenant suspended)",
      res.status === 200 && res.body?.data?.status === "SUSPENDED",
      res.body?.data?.status,
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n== Error envelopes ==");
  res = await api("POST", "/does-not-exist", {}, { auth: false });
  check("unknown route returns 404 envelope", res.status === 404, res.status);

  console.log("\n== Logout ==");
  res = await api("POST", "/auth/logout");
  check("logout succeeds", res.status === 204, res.status);
  res = await api("GET", "/auth/me");
  check("session revoked after logout", res.status === 401, res.status);

  console.log(
    `\n${failures === 0 ? "ALL E2E CHECKS PASSED" : `${failures} E2E CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("E2E run crashed:", error);
  process.exit(1);
});
