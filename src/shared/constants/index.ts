export const ITSM_MODULE_KEYS = [
  'incident',
  'problem',
  'change',
  'request',
  'service-catalog',
  'knowledge',
  'sla',
  'asset',
  'cmdb',
  'release',
  'task',
  'approval',
  'workflow',
  'notification',
  'report',
  'on-call',
  'team',
  'vendor',
  'employee-center',
  'discovery',
] as const;

export type ItsmModuleKey = (typeof ITSM_MODULE_KEYS)[number];

export const JOB_TYPES = {
  TENANT_PROVISIONING: 'TENANT_PROVISIONING',
  NOTIFICATION_DELIVERY: 'NOTIFICATION_DELIVERY',
  WEBHOOK_RETRY: 'WEBHOOK_RETRY',
  REPORT_GENERATION: 'REPORT_GENERATION',
  SLA_MONITOR: 'SLA_MONITOR',
  AUDIT_RETENTION: 'AUDIT_RETENTION',
} as const;

export const WEBHOOK_EVENT_KEYS = [
  'tenant.created',
  'tenant.activated',
  'tenant.suspended',
  'tenant.reactivated',
  'tenant.archived',
  'tenant.provisioning.completed',
  'tenant.provisioning.failed',
  'tenant.domain.added',
  'tenant.domain.verified',
  'tenant.domain.activated',
  'staff.created',
  'staff.activated',
  'staff.suspended',
  'staff.deactivated',
  'staff.roles.changed',
  'role.created',
  'role.updated',
  'role.deleted',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'approval.cancelled',
  'service.published',
  'sla.policy.updated',
  'workflow.published',
  'integration.enabled',
  'integration.disabled',
  'apikey.created',
  'apikey.revoked',
  'webhook.test',
  'support.ticket.created',
  'support.ticket.resolved',
  'report.completed',
  'security.login.failed',
  'security.privileged.action',
] as const;

export type WebhookEventKey = (typeof WEBHOOK_EVENT_KEYS)[number];

export const NOTIFICATION_EVENT_KEYS = [
  ...WEBHOOK_EVENT_KEYS,
  'auth.password.reset',
  'auth.invitation',
  'auth.mfa.enabled',
  'auth.mfa.disabled',
  'auth.email.change',
  'report.failed',
  'tenant.provisioning.started',
] as const;

export const PLATFORM_SETTING_GROUPS = ['general', 'branding', 'localization', 'security', 'retention', 'maintenance'] as const;

export const SETTING_KEYS = {
  PLATFORM_NAME: 'general.platformName',
  PLATFORM_SUPPORT_EMAIL: 'general.supportEmail',
  PLATFORM_TIMEZONE: 'localization.defaultTimezone',
  PLATFORM_LOCALE: 'localization.defaultLocale',
  PLATFORM_DATE_FORMAT: 'localization.dateFormat',
  BRANDING_LOGO_URL: 'branding.logoUrl',
  BRANDING_PRIMARY_COLOR: 'branding.primaryColor',
  BRANDING_FAVICON_URL: 'branding.faviconUrl',
  SECURITY_PASSWORD_POLICY: 'security.passwordPolicy',
  SECURITY_SESSION_TIMEOUT_MINUTES: 'security.sessionTimeoutMinutes',
  SECURITY_REQUIRE_MFA: 'security.requireMfaForStaff',
  SECURITY_IP_ALLOWLIST: 'security.ipAllowlist',
  MAINTENANCE_MODE: 'maintenance.enabled',
  MAINTENANCE_MESSAGE: 'maintenance.message',
  MAINTENANCE_ALLOWED_IPS: 'maintenance.allowedIps',
} as const;

export const DEFAULTS = {
  SESSION_TIMEOUT_MINUTES: 30,
  PAGE_LIMIT: 20,
  DOMAIN_VERIFICATION_TTL_HOURS: 72,
  WORKFLOW_MAX_STEPS: 500,
} as const;
