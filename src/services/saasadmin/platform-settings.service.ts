import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import { recordAudit, recordSecurityEvent } from "../../shared/audit";
import {
  parseListQuery,
  paginationArgs,
  buildPaginationMeta,
} from "../../shared/pagination";
import { SETTING_KEYS, PLATFORM_SETTING_GROUPS } from "../../shared/constants";
import type {
  UpdateBrandingInput,
  UpdateFeatureFlagInput,
  UpdateLocalizationInput,
  UpdateRetentionInput,
  UpdateSecurityInput,
} from "../../validators/saasadmin/platform-settings.validators";

type SettingType = "string" | "boolean" | "number" | "json" | "array";

interface SettingDefinition {
  key: string;
  group: (typeof PLATFORM_SETTING_GROUPS)[number];
  type: SettingType;
  default: Prisma.InputJsonValue;
  description: string;
}

const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: SETTING_KEYS.PLATFORM_NAME,
    group: "general",
    type: "string",
    default: "ITSM SaaS Platform",
    description: "Display name of the platform.",
  },
  {
    key: SETTING_KEYS.PLATFORM_SUPPORT_EMAIL,
    group: "general",
    type: "string",
    default: "support@example.com",
    description: "Support contact email shown to tenants.",
  },
  {
    key: SETTING_KEYS.BRANDING_LOGO_URL,
    group: "branding",
    type: "string",
    default: "",
    description: "URL of the platform logo.",
  },
  {
    key: SETTING_KEYS.BRANDING_FAVICON_URL,
    group: "branding",
    type: "string",
    default: "",
    description: "URL of the platform favicon.",
  },
  {
    key: SETTING_KEYS.BRANDING_PRIMARY_COLOR,
    group: "branding",
    type: "string",
    default: "#2563eb",
    description: "Primary accent colour (hex).",
  },
  {
    key: SETTING_KEYS.PLATFORM_TIMEZONE,
    group: "localization",
    type: "string",
    default: "UTC",
    description: "Default timezone for new tenants and reports.",
  },
  {
    key: SETTING_KEYS.PLATFORM_LOCALE,
    group: "localization",
    type: "string",
    default: "en-US",
    description: "Default locale for new tenants.",
  },
  {
    key: SETTING_KEYS.PLATFORM_DATE_FORMAT,
    group: "localization",
    type: "string",
    default: "ISO",
    description: "Default date display format.",
  },
  {
    key: SETTING_KEYS.SECURITY_PASSWORD_POLICY,
    group: "security",
    type: "json",
    default: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: true,
      maxAgeDays: 0,
    },
    description: "Password complexity policy for platform staff.",
  },
  {
    key: SETTING_KEYS.SECURITY_SESSION_TIMEOUT_MINUTES,
    group: "security",
    type: "number",
    default: 30,
    description: "Staff session access-token lifetime in minutes.",
  },
  {
    key: SETTING_KEYS.SECURITY_REQUIRE_MFA,
    group: "security",
    type: "boolean",
    default: false,
    description: "Require MFA for all platform staff.",
  },
  {
    key: SETTING_KEYS.SECURITY_IP_ALLOWLIST,
    group: "security",
    type: "array",
    default: [],
    description: "Staff access IP allowlist (CIDR ranges).",
  },
  {
    key: SETTING_KEYS.MAINTENANCE_MODE,
    group: "maintenance",
    type: "boolean",
    default: false,
    description: "Enable platform maintenance mode.",
  },
  {
    key: SETTING_KEYS.MAINTENANCE_MESSAGE,
    group: "maintenance",
    type: "string",
    default:
      "The platform is undergoing scheduled maintenance. Please try again shortly.",
    description: "Message shown during maintenance.",
  },
  {
    key: SETTING_KEYS.MAINTENANCE_ALLOWED_IPS,
    group: "maintenance",
    type: "array",
    default: [],
    description: "IPs allowed to bypass maintenance mode.",
  },
];

const definitionIndex = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

function assertSettingValue(
  definition: SettingDefinition,
  value: unknown,
): void {
  const label = definition.key;
  switch (definition.type) {
    case "string":
      if (typeof value !== "string")
        throw new BadRequestError(`Setting ${label} must be a string.`);
      break;
    case "boolean":
      if (typeof value !== "boolean")
        throw new BadRequestError(`Setting ${label} must be a boolean.`);
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value))
        throw new BadRequestError(`Setting ${label} must be a number.`);
      break;
    case "array":
      if (!Array.isArray(value))
        throw new BadRequestError(`Setting ${label} must be an array.`);
      break;
    case "json":
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new BadRequestError(`Setting ${label} must be a JSON object.`);
      }
      break;
    default:
      break;
  }
}

async function readSetting(
  key: string,
): Promise<{
  definition: SettingDefinition;
  value: unknown;
  source: "database" | "default";
}> {
  const definition = definitionIndex.get(key);
  if (!definition) throw new NotFoundError("Platform setting");
  const record = await prisma.platformSetting.findUnique({ where: { key } });
  return {
    definition,
    value: record ? record.value : definition.default,
    source: record ? "database" : "default",
  };
}

export async function getSettingValue<T = unknown>(key: string): Promise<T> {
  const setting = await readSetting(key);
  return setting.value as T;
}

export async function listSettings(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const group = typeof query.group === "string" ? query.group : undefined;
  const definitions = SETTING_DEFINITIONS.filter((definition) =>
    group ? definition.group === group : true,
  ).filter(
    (definition) =>
      !query.search ||
      definition.key.toLowerCase().includes(query.search.toLowerCase()) ||
      definition.description.toLowerCase().includes(query.search.toLowerCase()),
  );

  const records = await prisma.platformSetting.findMany({
    where: { key: { in: definitions.map((definition) => definition.key) } },
  });
  const recordIndex = new Map(records.map((record) => [record.key, record]));

  const rows = definitions.map((definition) => {
    const record = recordIndex.get(definition.key);
    return {
      key: definition.key,
      group: definition.group,
      type: definition.type,
      description: definition.description,
      value: record ? record.value : definition.default,
      isOverridden: Boolean(record),
      updatedAt: record?.updatedAt ?? null,
      updatedById: record?.updatedById ?? null,
    };
  });

  const total = rows.length;
  const paged = rows.slice(
    (query.page - 1) * query.limit,
    query.page * query.limit,
  );
  return {
    rows: paged,
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getGroups() {
  const records = await prisma.platformSetting.findMany();
  const recordIndex = new Map(records.map((record) => [record.key, record]));
  return PLATFORM_SETTING_GROUPS.map((group) => ({
    group,
    settings: SETTING_DEFINITIONS.filter(
      (definition) => definition.group === group,
    ).map((definition) => {
      const record = recordIndex.get(definition.key);
      return {
        key: definition.key,
        type: definition.type,
        description: definition.description,
        value: record ? record.value : definition.default,
        isOverridden: Boolean(record),
      };
    }),
  }));
}

export async function getSetting(key: string) {
  const setting = await readSetting(key);
  return {
    key: setting.definition.key,
    group: setting.definition.group,
    type: setting.definition.type,
    description: setting.definition.description,
    value: setting.value,
    source: setting.source,
  };
}

export async function updateSetting(key: string, value: unknown, req: Request) {
  const definition = definitionIndex.get(key);
  if (!definition) throw new NotFoundError("Platform setting");
  assertSettingValue(definition, value);

  const before = await prisma.platformSetting.findUnique({ where: { key } });
  const record = await prisma.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as Prisma.InputJsonValue,
      group: definition.group,
      description: definition.description,
      updatedById: req.auth?.userId ?? null,
    },
    update: {
      value: value as Prisma.InputJsonValue,
      updatedById: req.auth?.userId ?? null,
    },
  });

  await recordAudit({
    action: "platform-setting.updated",
    resourceType: "platform-setting",
    resourceId: record.id,
    before: before ? { value: before.value } : { value: definition.default },
    after: { value },
    metadata: { key, group: definition.group },
    req,
  });

  if (definition.group === "security" || definition.group === "maintenance") {
    await recordSecurityEvent({
      eventType: `platform-settings.${definition.group}.changed`,
      severity: "HIGH",
      req,
      details: { key, value },
    });
  }

  return getSetting(key);
}

function brandingPayload(settings: Map<string, unknown>) {
  return {
    platformName:
      settings.get(SETTING_KEYS.PLATFORM_NAME) ?? "ITSM SaaS Platform",
    logoUrl: settings.get(SETTING_KEYS.BRANDING_LOGO_URL) ?? "",
    faviconUrl: settings.get(SETTING_KEYS.BRANDING_FAVICON_URL) ?? "",
    primaryColor:
      settings.get(SETTING_KEYS.BRANDING_PRIMARY_COLOR) ?? "#2563eb",
  };
}

async function readSettingsMap(keys: string[]): Promise<Map<string, unknown>> {
  const records = await prisma.platformSetting.findMany({
    where: { key: { in: keys } },
  });
  const map = new Map<string, unknown>(
    records.map((record) => [record.key, record.value]),
  );
  for (const key of keys) {
    const definition = definitionIndex.get(key);
    if (!map.has(key) && definition) map.set(key, definition.default);
  }
  return map;
}

export async function getBranding() {
  const map = await readSettingsMap([
    SETTING_KEYS.PLATFORM_NAME,
    SETTING_KEYS.BRANDING_LOGO_URL,
    SETTING_KEYS.BRANDING_FAVICON_URL,
    SETTING_KEYS.BRANDING_PRIMARY_COLOR,
  ]);
  return brandingPayload(map);
}

export async function updateBranding(input: UpdateBrandingInput, req: Request) {
  const updates: { key: string; value: unknown }[] = [];
  if (input.platformName !== undefined)
    updates.push({
      key: SETTING_KEYS.PLATFORM_NAME,
      value: input.platformName,
    });
  if (input.logoUrl !== undefined)
    updates.push({
      key: SETTING_KEYS.BRANDING_LOGO_URL,
      value: input.logoUrl ?? "",
    });
  if (input.faviconUrl !== undefined)
    updates.push({
      key: SETTING_KEYS.BRANDING_FAVICON_URL,
      value: input.faviconUrl ?? "",
    });
  if (input.primaryColor !== undefined)
    updates.push({
      key: SETTING_KEYS.BRANDING_PRIMARY_COLOR,
      value: input.primaryColor,
    });

  for (const update of updates) {
    await updateSetting(update.key, update.value, req);
  }
  return getBranding();
}

export async function getLocalization() {
  const map = await readSettingsMap([
    SETTING_KEYS.PLATFORM_TIMEZONE,
    SETTING_KEYS.PLATFORM_LOCALE,
    SETTING_KEYS.PLATFORM_DATE_FORMAT,
  ]);
  return {
    defaultTimezone: map.get(SETTING_KEYS.PLATFORM_TIMEZONE) ?? "UTC",
    defaultLocale: map.get(SETTING_KEYS.PLATFORM_LOCALE) ?? "en-US",
    dateFormat: map.get(SETTING_KEYS.PLATFORM_DATE_FORMAT) ?? "ISO",
  };
}

export async function updateLocalization(
  input: UpdateLocalizationInput,
  req: Request,
) {
  if (input.defaultTimezone !== undefined)
    await updateSetting(
      SETTING_KEYS.PLATFORM_TIMEZONE,
      input.defaultTimezone,
      req,
    );
  if (input.defaultLocale !== undefined)
    await updateSetting(SETTING_KEYS.PLATFORM_LOCALE, input.defaultLocale, req);
  if (input.dateFormat !== undefined)
    await updateSetting(
      SETTING_KEYS.PLATFORM_DATE_FORMAT,
      input.dateFormat,
      req,
    );
  return getLocalization();
}

export async function getSecurity() {
  const map = await readSettingsMap([
    SETTING_KEYS.SECURITY_PASSWORD_POLICY,
    SETTING_KEYS.SECURITY_SESSION_TIMEOUT_MINUTES,
    SETTING_KEYS.SECURITY_REQUIRE_MFA,
    SETTING_KEYS.SECURITY_IP_ALLOWLIST,
  ]);
  return {
    passwordPolicy: map.get(SETTING_KEYS.SECURITY_PASSWORD_POLICY),
    sessionTimeoutMinutes:
      map.get(SETTING_KEYS.SECURITY_SESSION_TIMEOUT_MINUTES) ?? 30,
    requireMfaForStaff: map.get(SETTING_KEYS.SECURITY_REQUIRE_MFA) ?? false,
    ipAllowlist: map.get(SETTING_KEYS.SECURITY_IP_ALLOWLIST) ?? [],
  };
}

export async function updateSecurity(input: UpdateSecurityInput, req: Request) {
  if (input.passwordPolicy !== undefined) {
    const existing =
      (await getSettingValue<Record<string, unknown>>(
        SETTING_KEYS.SECURITY_PASSWORD_POLICY,
      )) ?? {};
    await updateSetting(
      SETTING_KEYS.SECURITY_PASSWORD_POLICY,
      { ...existing, ...input.passwordPolicy },
      req,
    );
  }
  if (input.sessionTimeoutMinutes !== undefined)
    await updateSetting(
      SETTING_KEYS.SECURITY_SESSION_TIMEOUT_MINUTES,
      input.sessionTimeoutMinutes,
      req,
    );
  if (input.requireMfaForStaff !== undefined)
    await updateSetting(
      SETTING_KEYS.SECURITY_REQUIRE_MFA,
      input.requireMfaForStaff,
      req,
    );
  if (input.ipAllowlist !== undefined)
    await updateSetting(
      SETTING_KEYS.SECURITY_IP_ALLOWLIST,
      input.ipAllowlist,
      req,
    );
  return getSecurity();
}

export async function getRetention() {
  const policies = await prisma.retentionPolicy.findMany({
    orderBy: { resourceKey: "asc" },
  });
  return {
    policies: policies.map((policy) => ({
      resourceKey: policy.resourceKey,
      retentionDays: policy.retentionDays,
      action: policy.action,
      isEnabled: policy.isEnabled,
      updatedAt: policy.updatedAt,
    })),
  };
}

export async function updateRetention(
  input: UpdateRetentionInput,
  req: Request,
) {
  for (const policy of input.policies) {
    await prisma.retentionPolicy.upsert({
      where: { resourceKey: policy.resourceKey },
      create: {
        resourceKey: policy.resourceKey,
        retentionDays: policy.retentionDays,
        action: policy.action,
        isEnabled: policy.isEnabled,
        updatedById: req.auth?.userId ?? null,
      },
      update: {
        retentionDays: policy.retentionDays,
        action: policy.action,
        isEnabled: policy.isEnabled,
        updatedById: req.auth?.userId ?? null,
      },
    });
  }
  await recordAudit({
    action: "platform-settings.retention.updated",
    resourceType: "retention-policy",
    after: { policies: input.policies },
    req,
  });
  return getRetention();
}

export async function listFeatureFlags(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = {
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: "insensitive" as const } },
            { name: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.featureFlag.findMany({
      where,
      orderBy: { key: "asc" },
      ...paginationArgs(query),
    }),
    prisma.featureFlag.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function updateFeatureFlag(
  flagKey: string,
  input: UpdateFeatureFlagInput,
  req: Request,
) {
  const existing = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
  });
  if (!existing) throw new NotFoundError("Feature flag");

  const updated = await prisma.featureFlag.update({
    where: { key: flagKey },
    data: {
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.rolloutPercentage !== undefined
        ? { rolloutPercentage: input.rolloutPercentage }
        : {}),
      ...(input.rules !== undefined
        ? {
            rules:
              input.rules === null
                ? Prisma.JsonNull
                : (input.rules as Prisma.InputJsonValue),
          }
        : {}),
      updatedById: req.auth?.userId ?? null,
    },
  });

  await recordAudit({
    action: "platform-settings.feature-flag.updated",
    resourceType: "feature-flag",
    resourceId: updated.id,
    before: {
      isEnabled: existing.isEnabled,
      rolloutPercentage: existing.rolloutPercentage,
      rules: existing.rules,
    },
    after: {
      isEnabled: updated.isEnabled,
      rolloutPercentage: updated.rolloutPercentage,
      rules: updated.rules,
    },
    req,
  });
  return updated;
}
