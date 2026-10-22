import { prisma } from "../../config/database";
import { NotFoundError, ValidationError } from "../../shared/errors";

export const USER_SUMMARY = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  jobTitle: true,
  status: true,
} as const;

/**
 * Generate the next human-readable record number for a tenant-scoped module.
 * Numbers are unique per tenant (enforced by a compound unique index); the
 * prefix and padding are read from the platform NumberingRule when present.
 */
export async function generateTicketNumber(
  moduleKey: string,
  defaultPrefix: string,
  exists: (number: string) => Promise<boolean>,
  startAt = 1,
): Promise<string> {
  const rule = await prisma.numberingRule.findUnique({ where: { moduleKey } });
  const prefix = rule?.prefix ?? defaultPrefix;
  const padding = rule?.padding ?? 5;

  let seq = Math.max(1, startAt);
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const number = `${prefix}-${String(seq).padStart(padding, "0")}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(number))) return number;
    seq += 1;
  }
  throw new ValidationError(
    "Unable to generate a unique reference number for this record.",
  );
}

/**
 * Build a `mapInput` hook that assigns a unique per-tenant record number on
 * create (skipped on update). Uses the platform NumberingRule for the module.
 */
export function withGeneratedNumber(opts: {
  moduleKey: string;
  prefix: string;
  count: (tenantId: string) => Promise<number>;
  exists: (tenantId: string, number: string) => Promise<boolean>;
}) {
  return async (
    input: Record<string, unknown>,
    ctx: { tenantId: string; existing?: unknown },
  ) => {
    if (ctx.existing) return input;
    const count = await opts.count(ctx.tenantId);
    const number = await generateTicketNumber(
      opts.moduleKey,
      opts.prefix,
      (candidate) => opts.exists(ctx.tenantId, candidate),
      count + 1,
    );
    return { ...input, number };
  };
}

export async function assertTenantUser(
  tenantId: string,
  userId: string | null | undefined,
  label: string,
): Promise<void> {
  if (!userId) return;
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
  if (!membership)
    throw new ValidationError(
      `The selected ${label} is not a member of this organization.`,
    );
}

export async function assertTenantTeam(
  tenantId: string,
  teamId: string | null | undefined,
): Promise<void> {
  if (!teamId) return;
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!team) throw new ValidationError("The selected team could not be found.");
}

export async function assertTenantDepartment(
  tenantId: string,
  departmentId: string | null | undefined,
): Promise<void> {
  if (!departmentId) return;
  const department = await prisma.department.findFirst({
    where: { id: departmentId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!department)
    throw new ValidationError("The selected department could not be found.");
}

export async function assertTenantLocation(
  tenantId: string,
  locationId: string | null | undefined,
): Promise<void> {
  if (!locationId) return;
  const location = await prisma.location.findFirst({
    where: { id: locationId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!location)
    throw new ValidationError("The selected location could not be found.");
}

export async function assertTenantCategory(
  tenantId: string,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.classificationCategory.findFirst({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category)
    throw new ValidationError("The selected category could not be found.");
}

export class ItsmRecordNotFound extends NotFoundError {
  constructor(label: string) {
    super(label);
  }
}
