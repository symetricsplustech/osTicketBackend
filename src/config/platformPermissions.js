const P = Object.freeze({
  DASHBOARD_READ: 'saas.dashboard.read',
  TENANT_CREATE: 'saas.tenant.create', TENANT_READ: 'saas.tenant.read', TENANT_UPDATE: 'saas.tenant.update',
  TENANT_ACTIVATE: 'saas.tenant.activate', TENANT_SUSPEND: 'saas.tenant.suspend', TENANT_ARCHIVE: 'saas.tenant.archive',
  TENANT_RESTORE: 'saas.tenant.restore', TENANT_TERMINATE: 'saas.tenant.terminate', TENANT_MANAGE_ADMIN: 'saas.tenant.manage_admin',
  TENANT_MANAGE_MODULES: 'saas.tenant.manage_modules', TENANT_MANAGE_LIMITS: 'saas.tenant.manage_limits', TENANT_VIEW_USAGE: 'saas.tenant.view_usage',
  PLAN_CREATE: 'saas.plan.create', PLAN_READ: 'saas.plan.read', PLAN_UPDATE: 'saas.plan.update', PLAN_DISABLE: 'saas.plan.disable', PLAN_ASSIGN: 'saas.plan.assign',
  BILLING_READ: 'saas.billing.read', BILLING_MANAGE: 'saas.billing.manage',
  MODULE_READ: 'saas.module.read', MODULE_CONFIGURE: 'saas.module.configure', MODULE_FEATURE_FLAGS: 'saas.module.manage_feature_flags',
  SECURITY_READ: 'saas.security.read', SECURITY_CONFIGURE: 'saas.security.configure', SESSION_REVOKE: 'saas.session.revoke',
  SUPPORT_IMPERSONATE: 'saas.support.impersonate', SECURITY_BREAK_GLASS: 'saas.security.break_glass',
  AUDIT_READ: 'saas.audit.read', AUDIT_EXPORT: 'saas.audit.export',
  OPERATIONS_READ: 'saas.operations.health.read', OPERATIONS_MANAGE: 'saas.operations.manage',
  PLATFORM_CONFIGURE: 'saas.platform.configure', ADMIN_MANAGE: 'saas.admin.manage',
  SLA_READ: 'saas.sla.read', SLA_MANAGE: 'saas.sla.manage', SLA_MEASURE: 'saas.sla.measure',
});

const without = (...keys) => Object.values(P).filter((permission) => !keys.includes(permission));
const ROLE_PERMISSIONS = Object.freeze({
  platform_administrator: without(P.ADMIN_MANAGE, P.SECURITY_BREAK_GLASS),
  platform_operations_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_UPDATE, P.TENANT_ACTIVATE, P.TENANT_SUSPEND, P.TENANT_ARCHIVE, P.TENANT_RESTORE, P.TENANT_MANAGE_MODULES, P.TENANT_MANAGE_LIMITS, P.TENANT_VIEW_USAGE, P.MODULE_READ, P.MODULE_CONFIGURE, P.MODULE_FEATURE_FLAGS, P.OPERATIONS_READ, P.OPERATIONS_MANAGE, P.AUDIT_READ, P.PLATFORM_CONFIGURE, P.SLA_READ, P.SLA_MANAGE, P.SLA_MEASURE],
  platform_support_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_UPDATE, P.TENANT_VIEW_USAGE, P.SUPPORT_IMPERSONATE, P.AUDIT_READ, P.OPERATIONS_READ, P.SLA_READ],
  platform_customer_success_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_UPDATE, P.TENANT_VIEW_USAGE, P.PLAN_READ, P.BILLING_READ, P.AUDIT_READ, P.SLA_READ],
  platform_billing_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_VIEW_USAGE, P.PLAN_CREATE, P.PLAN_READ, P.PLAN_UPDATE, P.PLAN_DISABLE, P.PLAN_ASSIGN, P.BILLING_READ, P.BILLING_MANAGE, P.AUDIT_READ],
  platform_security_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.SECURITY_READ, P.SECURITY_CONFIGURE, P.SESSION_REVOKE, P.SECURITY_BREAK_GLASS, P.AUDIT_READ, P.AUDIT_EXPORT, P.OPERATIONS_READ],
  platform_developer_administrator: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_VIEW_USAGE, P.MODULE_READ, P.MODULE_FEATURE_FLAGS, P.OPERATIONS_READ, P.OPERATIONS_MANAGE, P.AUDIT_READ, P.PLATFORM_CONFIGURE],
  platform_auditor: [P.DASHBOARD_READ, P.TENANT_READ, P.TENANT_VIEW_USAGE, P.PLAN_READ, P.BILLING_READ, P.SECURITY_READ, P.AUDIT_READ, P.AUDIT_EXPORT, P.OPERATIONS_READ, P.MODULE_READ, P.SLA_READ],
});

module.exports = { P, ROLE_PERMISSIONS };
