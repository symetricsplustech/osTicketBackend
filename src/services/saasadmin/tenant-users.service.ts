import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ConflictError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { hashPassword } from '../../shared/utils/passwords';
import { normaliseEmail } from '../../shared/utils/sanitize';
import { inviteUser } from '../tenantadmin/users.service';
import type { CreateTenantUserInput } from '../../validators/saasadmin/tenants.validators';

const USER_SUMMARY_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  jobTitle: true,
  phone: true,
  userType: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface TenantOrgUserActor {
  actorId?: string | null;
  actorEmail?: string | null;
  req?: Request;
}

async function resolveTenantRolesByKey(tenantId: string, roleKeys?: string[]) {
  const unique = Array.from(new Set((roleKeys ?? []).map((key) => key.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  const roles = await prisma.tenantRole.findMany({
    where: { tenantId, key: { in: unique }, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, key: true },
  });
  if (roles.length !== unique.length) {
    throw new ConflictError('One or more of the selected roles could not be found in this organization.');
  }
  return roles;
}

export async function createTenantOrgUser(
  tenantId: string,
  input: CreateTenantUserInput,
  actor: TenantOrgUserActor,
) {
  const email = normaliseEmail(input.email);
  const roles = await resolveTenantRolesByKey(tenantId, input.roleKeys);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.deletedAt) throw new ConflictError('A user with this email address already exists.');

  if (existingUser) {
    const existingMembership = await prisma.tenantMembership.findFirst({
      where: { tenantId, userId: existingUser.id },
      select: { id: true },
    });
    if (existingMembership) throw new ConflictError('This user is already a member of the organization.');
  }

  if (!input.password) {
    const invited = await inviteUser(
      tenantId,
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        roleIds: roles.map((role) => role.id),
        ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle }),
        ...(input.phone !== undefined && { phone: input.phone }),
      },
      {
        tenantId,
        actorId: actor.actorId ?? null,
        actorEmail: actor.actorEmail ?? null,
        actorType: 'PLATFORM_ADMIN',
        req: actor.req,
      },
    );
    return { ...invited, status: 'INVITED' as const };
  }

  const passwordHash = await hashPassword(input.password);

  const { user, membership } = await prisma.$transaction(async (tx) => {
    const createdUser = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            invitationTokenHash: null,
            invitationExpiresAt: null,
          },
          select: USER_SUMMARY_SELECT,
        })
      : await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: `${input.firstName} ${input.lastName}`.trim(),
            jobTitle: input.jobTitle ?? null,
            phone: input.phone ?? null,
            userType: 'TENANT_USER',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            createdById: actor.actorId ?? null,
          },
          select: USER_SUMMARY_SELECT,
        });

    const createdMembership = await tx.tenantMembership.create({
      data: {
        tenantId,
        userId: createdUser.id,
        status: 'ACTIVE',
        joinedAt: new Date(),
        invitedById: actor.actorId ?? null,
      },
    });

    if (roles.length > 0) {
      await tx.tenantUserRole.createMany({
        data: roles.map((role) => ({
          tenantId,
          membershipId: createdMembership.id,
          tenantRoleId: role.id,
          assignedById: actor.actorId ?? null,
        })),
        skipDuplicates: true,
      });
    }

    return { user: createdUser, membership: createdMembership };
  });

  await recordAudit({
    action: 'tenant.user.created',
    resourceType: 'tenant-membership',
    resourceId: membership.id,
    tenantId,
    after: {
      ...user,
      membershipId: membership.id,
      membershipStatus: membership.status,
      roleKeys: roles.map((role) => role.key),
    },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: 'PLATFORM_ADMIN',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.user.created', tenantId, payload: { userId: user.id, email: user.email } });

  return {
    userId: user.id,
    membershipId: membership.id,
    email: user.email,
    status: 'ACTIVE' as const,
    roles: roles.map((role) => role.key),
  };
}
