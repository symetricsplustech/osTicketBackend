import { z } from "zod";

export const createStaffSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email address is required.")
    .max(254),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z.string().trim().max(30).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
  roleIds: z
    .array(z.string().min(1, "Role identifier is required."))
    .default([]),
});

export const updateStaffSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80)
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(80)
    .optional(),
  displayName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
});

export const replaceStaffRolesSchema = z.object({
  roleIds: z
    .array(z.string().min(1, "Role identifier is required."))
    .default([]),
});

export const staffIdParamSchema = z.object({
  staffId: z.string().min(1, "Staff identifier is required."),
});

export const staffSessionParamSchema = z.object({
  staffId: z.string().min(1, "Staff identifier is required."),
  sessionId: z.string().min(1, "Session identifier is required."),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type ReplaceStaffRolesInput = z.infer<typeof replaceStaffRolesSchema>;
