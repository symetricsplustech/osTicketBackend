import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import type {
  UpdateOrganizationBrandingInput,
  UpdateOrganizationBusinessHoursInput,
  UpdateOrganizationInput,
  UpdateOrganizationLocalizationInput,
} from '../../validators/tenantadmin/organization.validators';

export interface OrganizationActor {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorType?: string;
  req?: import('express').Request;
}

const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  primaryContactName: true,
  primaryContactEmail: true,
  timezone: true,
  locale: true,
  industry: true,
  website: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

export type OrganizationProfile = Prisma.TenantGetPayload<{ select: typeof ORGANIZATION_SELECT }>;

export async function getOrganization(tenantId: string): Promise<OrganizationProfile> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: ORGANIZATION_SELECT,
  });
  if (!tenant) throw new NotFoundError('Organization');
  return tenant;
}

const EDITABLE_FIELDS = [
  'name',
  'primaryContactName',
  'primaryContactEmail',
  'timezone',
  'locale',
  'industry',
  'website',
  'notes',
] as const;

export async function updateOrganization(
  actor: OrganizationActor,
  input: UpdateOrganizationInput,
): Promise<OrganizationProfile> {
  const existing = await prisma.tenant.findFirst({
    where: { id: actor.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Organization');

  const data: Prisma.TenantUpdateInput = {};
  for (const field of EDITABLE_FIELDS) {
    const value = input[field];
    if (value !== undefined) {
      (data as Record<string, unknown>)[field] = value;
    }
  }
  if (input.metadata !== undefined) {
    data.metadata = input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue);
  }

  const before = await getOrganization(actor.tenantId);
  const updated = await prisma.tenant.update({
    where: { id: actor.tenantId },
    data,
    select: ORGANIZATION_SELECT,
  });

  await recordAudit({
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: updated.id,
    tenantId: actor.tenantId,
    before,
    after: updated,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });

  void publishEvent({
    eventKey: 'organization.updated',
    tenantId: actor.tenantId,
    payload: { id: updated.id },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Organization sub-resources stored as tenant settings
// ---------------------------------------------------------------------------

export const ORGANIZATION_BRANDING_KEY = 'organization.branding';
export const ORGANIZATION_LOCALIZATION_KEY = 'organization.localization';
export const ORGANIZATION_BUSINESS_HOURS_KEY = 'organization.business_hours';

type SettingValue = Record<string, unknown>;

async function readSetting(tenantId: string, key: string): Promise<SettingValue> {
  const setting = await prisma.tenantSetting.findUnique({ where: { tenantId_key: { tenantId, key } } });
  const value = setting?.value;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SettingValue) : {};
}

async function writeSetting(
  actor: OrganizationActor,
  key: string,
  value: SettingValue,
  action: string,
  resourceType: string,
): Promise<SettingValue> {
  const before = await readSetting(actor.tenantId, key);
  const setting = await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId: actor.tenantId, key } },
    create: { tenantId: actor.tenantId, key, value: value as Prisma.InputJsonValue, updatedById: actor.actorId ?? null },
    update: { value: value as Prisma.InputJsonValue, updatedById: actor.actorId ?? null },
  });

  await recordAudit({
    action,
    resourceType,
    resourceId: setting.id,
    tenantId: actor.tenantId,
    before,
    after: value,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: action, tenantId: actor.tenantId, payload: { key } });

  return value;
}

export function getOrganizationBranding(tenantId: string) {
  return readSetting(tenantId, ORGANIZATION_BRANDING_KEY);
}

export function updateOrganizationBranding(actor: OrganizationActor, input: UpdateOrganizationBrandingInput) {
  return writeSetting(
    actor,
    ORGANIZATION_BRANDING_KEY,
    input as SettingValue,
    'organization.branding.updated',
    'organization-branding',
  );
}

export function getOrganizationLocalization(tenantId: string) {
  return readSetting(tenantId, ORGANIZATION_LOCALIZATION_KEY);
}

export function updateOrganizationLocalization(actor: OrganizationActor, input: UpdateOrganizationLocalizationInput) {
  return writeSetting(
    actor,
    ORGANIZATION_LOCALIZATION_KEY,
    input as SettingValue,
    'organization.localization.updated',
    'organization-localization',
  );
}

export function getOrganizationBusinessHours(tenantId: string) {
  return readSetting(tenantId, ORGANIZATION_BUSINESS_HOURS_KEY);
}

export function updateOrganizationBusinessHours(
  actor: OrganizationActor,
  input: UpdateOrganizationBusinessHoursInput,
) {
  return writeSetting(
    actor,
    ORGANIZATION_BUSINESS_HOURS_KEY,
    input as SettingValue,
    'organization.business_hours.updated',
    'organization-business-hours',
  );
}
