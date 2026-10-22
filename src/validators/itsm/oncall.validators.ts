import { z } from "zod";

export const onCallScheduleIdParamSchema = z.object({
  scheduleId: z.string().min(1),
});
export const onCallShiftIdParamSchema = z.object({
  shiftId: z.string().min(1),
});

export const createOnCallScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    timezone: z.string().trim().max(80).optional(),
    rotationType: z
      .enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"])
      .optional(),
    status: z.string().trim().max(40).optional(),
    teamId: z.string().min(1).nullable().optional(),
    escalationPolicy: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateOnCallScheduleSchema = createOnCallScheduleSchema
  .partial()
  .strict();

export const createOnCallShiftSchema = z
  .object({
    scheduleId: z.string().min(1),
    userId: z.string().min(1),
    kind: z.enum(["SHIFT", "OVERRIDE"]).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    note: z.string().trim().max(2000).optional(),
    status: z.string().trim().max(40).optional(),
  })
  .strict();
export const updateOnCallShiftSchema = createOnCallShiftSchema
  .partial()
  .strict();
