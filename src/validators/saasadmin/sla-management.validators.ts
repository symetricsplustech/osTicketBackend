import { z } from 'zod';

export const slaPolicyKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    'Key must contain only lowercase letters, numbers and hyphens.',
  );

export const slaServiceLevelSchema = z.object({
  priority: z.string().trim().min(1, 'A priority reference is required.').max(120),
  responseMinutes: z.number().int().positive('Response minutes must be a positive integer.'),
  resolutionMinutes: z.number().int().positive('Resolution minutes must be a positive integer.').optional(),
});

export const createSlaPolicySchema = z.object({
  key: slaPolicyKeySchema,
  name: z.string().trim().min(2, 'Policy name must be at least 2 characters.').max(160),
  description: z.string().trim().max(2000).optional(),
  serviceLevels: z.array(slaServiceLevelSchema).min(1, 'At least one service level is required.'),
  settings: z.record(z.unknown()).optional(),
});

export const updateSlaPolicySchema = z.object({
  name: z.string().trim().min(2, 'Policy name must be at least 2 characters.').max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  serviceLevels: z.array(slaServiceLevelSchema).min(1, 'At least one service level is required.').optional(),
  settings: z.record(z.unknown()).optional(),
});

export const slaPolicyIdParamSchema = z.object({
  policyId: z.string().min(1, 'Policy identifier is required.'),
});

const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:MM (24-hour) format.');

export const businessCalendarWorkingHoursSchema = z.record(
  z.array(z.object({ start: timeOfDaySchema, end: timeOfDaySchema })),
);

export const businessCalendarHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Holiday dates must use YYYY-MM-DD format.'),
  name: z.string().trim().min(1, 'A holiday name is required.').max(160),
});

export const createBusinessCalendarSchema = z.object({
  name: z.string().trim().min(2, 'Calendar name must be at least 2 characters.').max(160),
  timezone: z.string().trim().min(1).max(80).optional().default('UTC'),
  workingHours: businessCalendarWorkingHoursSchema,
  holidays: z.array(businessCalendarHolidaySchema).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateBusinessCalendarSchema = z.object({
  name: z.string().trim().min(2, 'Calendar name must be at least 2 characters.').max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  workingHours: businessCalendarWorkingHoursSchema.optional(),
  holidays: z.array(businessCalendarHolidaySchema).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const businessCalendarIdParamSchema = z.object({
  calendarId: z.string().min(1, 'Calendar identifier is required.'),
});

export const escalationActionSchema = z
  .union([z.record(z.unknown()), z.array(z.unknown())])
  .refine(
    (value) => (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0),
    'Escalation actions must not be empty.',
  );

export const createEscalationRuleSchema = z.object({
  name: z.string().trim().min(2, 'Rule name must be at least 2 characters.').max(160),
  slaPolicyId: z.string().min(1).nullable().optional(),
  trigger: z.enum(['RESPONSE', 'RESOLUTION']),
  thresholdMinutes: z.number().int().positive('Threshold minutes must be a positive integer.'),
  actions: escalationActionSchema,
  isEnabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export const updateEscalationRuleSchema = z.object({
  name: z.string().trim().min(2, 'Rule name must be at least 2 characters.').max(160).optional(),
  slaPolicyId: z.string().min(1).nullable().optional(),
  trigger: z.enum(['RESPONSE', 'RESOLUTION']).optional(),
  thresholdMinutes: z.number().int().positive('Threshold minutes must be a positive integer.').optional(),
  actions: escalationActionSchema.optional(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const escalationRuleIdParamSchema = z.object({
  ruleId: z.string().min(1, 'Rule identifier is required.'),
});

export const tenantSlaAssignmentsSchema = z.object({
  slaPolicyIds: z.array(z.string().min(1)).max(500, 'At most 500 SLA policies can be assigned at once.'),
});

export const tenantSlaAssignmentParamSchema = z.object({
  tenantId: z.string().min(1, 'Tenant identifier is required.'),
});

export type CreateSlaPolicyInput = z.infer<typeof createSlaPolicySchema>;
export type UpdateSlaPolicyInput = z.infer<typeof updateSlaPolicySchema>;
export type CreateBusinessCalendarInput = z.infer<typeof createBusinessCalendarSchema>;
export type UpdateBusinessCalendarInput = z.infer<typeof updateBusinessCalendarSchema>;
export type CreateEscalationRuleInput = z.infer<typeof createEscalationRuleSchema>;
export type UpdateEscalationRuleInput = z.infer<typeof updateEscalationRuleSchema>;
export type TenantSlaAssignmentsInput = z.infer<typeof tenantSlaAssignmentsSchema>;
