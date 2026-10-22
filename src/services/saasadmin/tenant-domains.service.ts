import dns from "dns";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "../../shared/errors";
import {
  parseListQuery,
  paginationArgs,
  buildPaginationMeta,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import { randomToken } from "../../shared/utils/crypto";
import type { AddDomainInput } from "../../validators/saasadmin/tenant-domains.validators";

const TXT_RECORD_PREFIX = "_itsm-verification";

export interface DomainActor {
  actorId?: string | null;
  req: Request;
}

export async function listDomains(tenantId: string, req: Request) {
  const query = parseListQuery(req, {
    defaultSortOrder: "desc",
    maxLimit: 100,
  });
  const where = { tenantId, ...(query.status ? { status: query.status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.tenantDomain.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.tenantDomain.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function listAllDomains(req: Request) {
  const query = parseListQuery(req, {
    defaultSortOrder: "desc",
    maxLimit: 100,
  });
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.search
      ? {
          OR: [
            {
              domain: { contains: query.search, mode: "insensitive" as const },
            },
            {
              tenant: {
                name: { contains: query.search, mode: "insensitive" as const },
              },
            },
            {
              tenant: {
                slug: { contains: query.search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.tenantDomain.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.tenantDomain.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function addDomain(
  tenantId: string,
  input: AddDomainInput,
  actor: DomainActor,
) {
  const existing = await prisma.tenantDomain.findUnique({
    where: { domain: input.domain },
  });
  if (existing) {
    throw new ConflictError(
      existing.tenantId === tenantId
        ? "This domain is already registered for this tenant."
        : "This domain is already registered for another tenant.",
    );
  }

  const domain = await prisma.tenantDomain.create({
    data: {
      tenantId,
      domain: input.domain,
      type: input.type,
      status: "PENDING_VERIFICATION",
      verificationToken: randomToken(16),
      certificateStatus: "NONE",
    },
  });

  await recordAudit({
    action: "tenant.domain.added",
    resourceType: "tenant-domain",
    resourceId: domain.id,
    tenantId,
    after: { domain: domain.domain, type: domain.type },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.domain.added",
    tenantId,
    payload: { domainId: domain.id, domain: domain.domain },
  });

  return domain;
}

export async function getDomain(tenantId: string, domainId: string) {
  const domain = await prisma.tenantDomain.findFirst({
    where: { id: domainId, tenantId },
  });
  if (!domain) throw new NotFoundError("Domain");
  return domain;
}

async function lookupTxtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.promises.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch (error) {
    logger.debug({ name, error }, "DNS TXT lookup failed");
    return [];
  }
}

export async function verifyDomain(
  tenantId: string,
  domainId: string,
  actor: DomainActor,
) {
  const domain = await getDomain(tenantId, domainId);
  if (domain.status === "ACTIVE")
    throw new PreconditionFailedError("This domain is already active.");
  if (domain.status === "DISABLED")
    throw new PreconditionFailedError("Enable the domain before verifying it.");
  if (!domain.verificationToken)
    throw new PreconditionFailedError(
      "This domain has no verification token. Remove and re-add it.",
    );

  const records = await lookupTxtRecords(
    `${TXT_RECORD_PREFIX}.${domain.domain}`,
  );
  const verified = records.some(
    (record) => record.trim() === domain.verificationToken,
  );

  if (!verified) {
    const updated = await prisma.tenantDomain.update({
      where: { id: domain.id },
      data: {
        status: "PENDING_VERIFICATION",
        lastCheckedAt: new Date(),
        lastError: `No matching TXT record found at ${TXT_RECORD_PREFIX}.${domain.domain}.`,
      },
    });
    await recordAudit({
      action: "tenant.domain.verification_failed",
      resourceType: "tenant-domain",
      resourceId: domain.id,
      tenantId,
      outcome: "FAILURE",
      actorId: actor.actorId ?? null,
      req: actor.req,
    });
    return updated;
  }

  const updated = await prisma.tenantDomain.update({
    where: { id: domain.id },
    data: {
      status: "VERIFIED",
      verifiedAt: new Date(),
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  await recordAudit({
    action: "tenant.domain.verified",
    resourceType: "tenant-domain",
    resourceId: domain.id,
    tenantId,
    after: { domain: domain.domain, status: "VERIFIED" },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.domain.verified",
    tenantId,
    payload: { domainId: domain.id, domain: domain.domain },
  });

  return updated;
}

export async function activateDomain(
  tenantId: string,
  domainId: string,
  actor: DomainActor,
) {
  const domain = await getDomain(tenantId, domainId);
  if (domain.status === "ACTIVE")
    throw new PreconditionFailedError("This domain is already active.");
  if (domain.status !== "VERIFIED") {
    throw new PreconditionFailedError(
      "The domain must be verified before it can be activated.",
    );
  }

  const certificateStatus = domain.type === "SUBDOMAIN" ? "ISSUED" : "PENDING";
  const updated = await prisma.tenantDomain.update({
    where: { id: domain.id },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
      certificateStatus,
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  await recordAudit({
    action: "tenant.domain.activated",
    resourceType: "tenant-domain",
    resourceId: domain.id,
    tenantId,
    after: { domain: domain.domain, status: "ACTIVE", certificateStatus },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.domain.activated",
    tenantId,
    payload: { domainId: domain.id, domain: domain.domain },
  });

  return updated;
}

export async function disableDomain(
  tenantId: string,
  domainId: string,
  actor: DomainActor,
) {
  const domain = await getDomain(tenantId, domainId);
  if (domain.status === "DISABLED")
    throw new PreconditionFailedError("This domain is already disabled.");
  if (domain.status !== "ACTIVE")
    throw new PreconditionFailedError("Only active domains can be disabled.");

  const updated = await prisma.tenantDomain.update({
    where: { id: domain.id },
    data: {
      status: "DISABLED",
      disabledAt: new Date(),
      lastCheckedAt: new Date(),
    },
  });

  await recordAudit({
    action: "tenant.domain.disabled",
    resourceType: "tenant-domain",
    resourceId: domain.id,
    tenantId,
    after: { domain: domain.domain, status: "DISABLED" },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  return updated;
}

export async function removeDomain(
  tenantId: string,
  domainId: string,
  actor: DomainActor,
) {
  const domain = await getDomain(tenantId, domainId);
  if (domain.status === "ACTIVE") {
    throw new PreconditionFailedError("Disable the domain before removing it.");
  }

  await prisma.tenantDomain.delete({ where: { id: domain.id } });
  await recordAudit({
    action: "tenant.domain.removed",
    resourceType: "tenant-domain",
    resourceId: domain.id,
    tenantId,
    before: { domain: domain.domain, status: domain.status },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
}

export async function getVerificationStatus(
  tenantId: string,
  domainId: string,
) {
  const domain = await getDomain(tenantId, domainId);
  return {
    domainId: domain.id,
    domain: domain.domain,
    status: domain.status,
    type: domain.type,
    verifiedAt: domain.verifiedAt,
    activatedAt: domain.activatedAt,
    lastCheckedAt: domain.lastCheckedAt,
    lastError: domain.lastError,
    certificateStatus: domain.certificateStatus,
    dnsInstructions: domain.verificationToken
      ? {
          recordType: "TXT",
          recordName: `${TXT_RECORD_PREFIX}.${domain.domain}`,
          recordValue: domain.verificationToken,
          note: "Create this DNS record with your DNS provider, then run verification. Verification is always performed server-side.",
        }
      : null,
  };
}
