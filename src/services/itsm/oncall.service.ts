import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { createItsmCrudService, assertUnique } from "./crud";

const base = createItsmCrudService({
  resourceType: "on_call_schedule",
  label: "On-call schedule",
  model: prisma.onCallSchedule,
  searchFields: ["name", "description"],
  allowedSortFields: [
    "name",
    "rotationType",
    "status",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "teamId", "rotationType"],
  include: { _count: { select: { shifts: true } } },
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.onCallSchedule,
        tenantId,
        "name",
        input.name,
        "on-call schedule",
        existing?.id,
      );
    }
  },
});

export const onCallScheduleService = {
  ...base,
  async listShifts(tenantId: string, scheduleId: string, req: Request) {
    await base.get(tenantId, scheduleId);
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { scheduleId, tenantId, deletedAt: null };
    const [rows, total] = await Promise.all([
      prisma.onCallShift.findMany({
        where,
        orderBy: { startAt: "asc" },
        ...paginationArgs(query),
      }),
      prisma.onCallShift.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

export const onCallShiftService = createItsmCrudService({
  resourceType: "on_call_shift",
  label: "On-call shift",
  model: prisma.onCallShift,
  searchFields: ["note"],
  allowedSortFields: [
    "startAt",
    "endAt",
    "status",
    "kind",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["scheduleId", "userId", "kind", "status"],
  validate: async (tenantId, input, existing) => {
    const scheduleId =
      (input.scheduleId as string | undefined) ??
      (existing?.scheduleId as string);
    const schedule = await prisma.onCallSchedule.findFirst({
      where: { id: scheduleId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundError("On-call schedule");
  },
});

export async function getOnCallShift(tenantId: string, id: string) {
  const record = await prisma.onCallShift.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { schedule: { select: { id: true, name: true, timezone: true } } },
  });
  if (!record) throw new NotFoundError("On-call shift");
  return record;
}
