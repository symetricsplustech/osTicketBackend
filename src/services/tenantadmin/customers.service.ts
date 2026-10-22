import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import { createTenantCrudService } from "./structure-crud";
import type { TenantActorContext } from "./roles.service";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function upper(value: unknown): string | undefined {
  const raw = text(value);
  return raw ? raw.toUpperCase() : undefined;
}

const CUSTOMER_INCLUDE = {
  contacts: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
  },
  sites: { where: { deletedAt: null }, orderBy: { name: "asc" as const } },
  _count: { select: { contacts: true, sites: true, incidents: true } },
};

/**
 * Customer directory CRUD. Scoped to the active tenant by `createTenantCrudService`.
 */
export const customerService = createTenantCrudService({
  resourceType: "customer",
  label: "Customer",
  model: prisma.customer,
  codeField: "code",
  searchFields: ["name", "code", "email", "industry", "city", "country"],
  allowedSortFields: ["name", "code", "status", "createdAt", "updatedAt"],
  include: CUSTOMER_INCLUDE,
  async validate(tenantId, input) {
    const slaPolicyId = text(input.slaPolicyId);
    if (!slaPolicyId) return;
    const assignment = await prisma.tenantSlaAssignment.findFirst({
      where: { tenantId, slaPolicyId, isActive: true },
      select: { id: true },
    });
    if (!assignment) {
      throw new ValidationError(
        "The selected SLA policy is not assigned to this organization.",
      );
    }
  },
  async beforeDelete(tenantId, record) {
    const openIncidents = await prisma.incident.count({
        where: {
          tenantId,
          customerId: record.id as string,
          deletedAt: null,
          closedAt: null,
        },
    });
    if (openIncidents > 0) {
      throw new ConflictError(
        "Close or reassign open incidents before deleting this customer.",
      );
    }
  },
});

async function findCustomerOrThrow(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  if (!customer) throw new NotFoundError("Customer");
  return customer;
}

async function findContactOrThrow(
  tenantId: string,
  customerId: string,
  contactId: string,
) {
  const contact = await prisma.customerContact.findFirst({
    where: { id: contactId, customerId, tenantId, deletedAt: null },
  });
  if (!contact) throw new NotFoundError("Customer contact");
  return contact;
}

async function findSiteOrThrow(
  tenantId: string,
  customerId: string,
  siteId: string,
) {
  const site = await prisma.customerSite.findFirst({
    where: { id: siteId, customerId, tenantId, deletedAt: null },
  });
  if (!site) throw new NotFoundError("Customer site");
  return site;
}

async function auditCustomerAction(
  action: string,
  resourceType: string,
  resourceId: string,
  tenantId: string,
  actor: TenantActorContext,
  payload?: { before?: unknown; after?: unknown },
): Promise<void> {
  await recordAudit({
    action,
    resourceType,
    resourceId,
    tenantId,
    before: (payload?.before ?? undefined) as never,
    after: (payload?.after ?? undefined) as never,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: action,
    tenantId,
    payload: { id: resourceId },
  });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactInput {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  jobTitle?: unknown;
  role?: unknown;
  isPrimary?: unknown;
  notes?: unknown;
}

function contactData(
  input: ContactInput,
): Prisma.CustomerContactUncheckedCreateInput | Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email)?.toLowerCase();
  const phone = text(input.phone);
  const jobTitle = text(input.jobTitle);
  const role = upper(input.role);
  const notes = text(input.notes);
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (jobTitle !== undefined) data.jobTitle = jobTitle;
  if (role !== undefined) data.role = role;
  if (notes !== undefined) data.notes = notes;
  if (typeof input.isPrimary === "boolean") data.isPrimary = input.isPrimary;
  return data;
}

export async function listCustomerContacts(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.CustomerContactWhereInput = { tenantId, deletedAt: null };

  const customerId = text(query.customerId);
  const portalStatus = upper(query.portalStatus);
  const role = upper(query.role);
  if (customerId) where.customerId = customerId;
  if (portalStatus) where.portalStatus = portalStatus as never;
  if (role) where.role = role as never;
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { customer: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  const orderBy = buildOrderBy(
    query,
    ["firstName", "lastName", "email", "createdAt"],
    { createdAt: "desc" as const },
  );
  const [rows, total] = await Promise.all([
    prisma.customerContact.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: { customer: { select: { id: true, name: true, code: true } } },
    }),
    prisma.customerContact.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createCustomerContact(
  tenantId: string,
  customerId: string,
  input: ContactInput,
  actor: TenantActorContext,
) {
  await findCustomerOrThrow(tenantId, customerId);
  const data = contactData(input);
  if (!data.firstName || !data.lastName || !data.email) {
    throw new ValidationError(
      "First name, last name and email are required for a contact.",
    );
  }
  const duplicate = await prisma.customerContact.findFirst({
    where: { customerId, email: data.email as string },
    select: { id: true, deletedAt: true },
  });
  if (duplicate && !duplicate.deletedAt) {
    throw new ConflictError(
      "A contact with this email already exists for the customer.",
    );
  }

  const contact = duplicate
    ? await prisma.customerContact.update({
        where: { id: duplicate.id },
        data: {
          ...data,
          deletedAt: null,
          portalStatus: "NONE",
          invitedAt: null,
        },
      })
    : await prisma.customerContact.create({
        data: {
          ...(data as Prisma.CustomerContactUncheckedCreateInput),
          tenantId,
          customerId,
          createdById: actor.actorId ?? null,
        },
      });

  await auditCustomerAction(
    "customer.contact.created",
    "customer_contact",
    contact.id,
    tenantId,
    actor,
    { after: contact },
  );
  return contact;
}

export async function updateCustomerContact(
  tenantId: string,
  customerId: string,
  contactId: string,
  input: ContactInput,
  actor: TenantActorContext,
) {
  const before = await findContactOrThrow(tenantId, customerId, contactId);
  const data = contactData(input);
  if (typeof data.email === "string" && data.email !== before.email) {
    const duplicate = await prisma.customerContact.findFirst({
      where: { customerId, email: data.email, id: { not: contactId } },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictError(
        "A contact with this email already exists for the customer.",
      );
  }
  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data,
  });
  await auditCustomerAction(
    "customer.contact.updated",
    "customer_contact",
    contactId,
    tenantId,
    actor,
    { before, after: contact },
  );
  return contact;
}

export async function removeCustomerContact(
  tenantId: string,
  customerId: string,
  contactId: string,
  actor: TenantActorContext,
) {
  const before = await findContactOrThrow(tenantId, customerId, contactId);
  await prisma.customerContact.update({
    where: { id: contactId },
    data: { deletedAt: new Date(), portalStatus: "REVOKED" },
  });
  await auditCustomerAction(
    "customer.contact.deleted",
    "customer_contact",
    contactId,
    tenantId,
    actor,
    { before },
  );
}

export async function inviteCustomerContactPortal(
  tenantId: string,
  customerId: string,
  contactId: string,
  actor: TenantActorContext,
) {
  const before = await findContactOrThrow(tenantId, customerId, contactId);
  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data: { portalStatus: "INVITED", invitedAt: new Date() },
  });
  await auditCustomerAction(
    "customer.contact.portal_invited",
    "customer_contact",
    contactId,
    tenantId,
    actor,
    { before, after: contact },
  );
  return contact;
}

export async function revokeCustomerContactPortal(
  tenantId: string,
  customerId: string,
  contactId: string,
  actor: TenantActorContext,
) {
  const before = await findContactOrThrow(tenantId, customerId, contactId);
  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data: { portalStatus: "REVOKED" },
  });
  await auditCustomerAction(
    "customer.contact.portal_revoked",
    "customer_contact",
    contactId,
    tenantId,
    actor,
    { before, after: contact },
  );
  return contact;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export interface SiteInput {
  name?: unknown;
  code?: unknown;
  siteType?: unknown;
  isDataCenter?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
  timezone?: unknown;
  status?: unknown;
  notes?: unknown;
}

function siteData(input: SiteInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const name = text(input.name);
  const code = text(input.code);
  const siteType = upper(input.siteType);
  const fields = [
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "country",
    "timezone",
    "notes",
  ] as const;
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code;
  if (siteType !== undefined) data.siteType = siteType;
  if (typeof input.isDataCenter === "boolean")
    data.isDataCenter = input.isDataCenter;
  if (upper(input.status) !== undefined) data.status = upper(input.status);
  for (const field of fields) {
    const value = text(input[field]);
    if (value !== undefined) data[field] = value;
  }
  return data;
}

export async function listCustomerSites(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.CustomerSiteWhereInput = { tenantId, deletedAt: null };
  const customerId = text(query.customerId);
  if (customerId) where.customerId = customerId;
  if (typeof query.isDataCenter === "string")
    where.isDataCenter = query.isDataCenter === "true";
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { city: { contains: query.search, mode: "insensitive" } },
      { customer: { name: { contains: query.search, mode: "insensitive" } } },
    ];
  }
  const orderBy = buildOrderBy(query, ["name", "code", "city", "createdAt"], {
    createdAt: "desc" as const,
  });
  const [rows, total] = await Promise.all([
    prisma.customerSite.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: { customer: { select: { id: true, name: true, code: true } } },
    }),
    prisma.customerSite.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createCustomerSite(
  tenantId: string,
  customerId: string,
  input: SiteInput,
  actor: TenantActorContext,
) {
  await findCustomerOrThrow(tenantId, customerId);
  const data = siteData(input);
  if (!data.name) throw new ValidationError("Site name is required.");
  if (typeof data.code === "string") {
    const duplicate = await prisma.customerSite.findFirst({
      where: { customerId, code: data.code, deletedAt: null },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictError(
        "A site with this code already exists for the customer.",
      );
  }
  const site = await prisma.customerSite.create({
    data: {
      ...(data as Prisma.CustomerSiteUncheckedCreateInput),
      tenantId,
      customerId,
      createdById: actor.actorId ?? null,
    },
  });
  await auditCustomerAction(
    "customer.site.created",
    "customer_site",
    site.id,
    tenantId,
    actor,
    { after: site },
  );
  return site;
}

export async function updateCustomerSite(
  tenantId: string,
  customerId: string,
  siteId: string,
  input: SiteInput,
  actor: TenantActorContext,
) {
  const before = await findSiteOrThrow(tenantId, customerId, siteId);
  const data = siteData(input);
  if (typeof data.code === "string" && data.code !== before.code) {
    const duplicate = await prisma.customerSite.findFirst({
      where: {
        customerId,
        code: data.code,
        id: { not: siteId },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictError(
        "A site with this code already exists for the customer.",
      );
  }
  const site = await prisma.customerSite.update({
    where: { id: siteId },
    data,
  });
  await auditCustomerAction(
    "customer.site.updated",
    "customer_site",
    siteId,
    tenantId,
    actor,
    { before, after: site },
  );
  return site;
}

export async function removeCustomerSite(
  tenantId: string,
  customerId: string,
  siteId: string,
  actor: TenantActorContext,
) {
  const before = await findSiteOrThrow(tenantId, customerId, siteId);
  await prisma.customerSite.update({
    where: { id: siteId },
    data: { deletedAt: new Date() },
  });
  await auditCustomerAction(
    "customer.site.deleted",
    "customer_site",
    siteId,
    tenantId,
    actor,
    { before },
  );
}
