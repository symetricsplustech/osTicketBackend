import { z } from 'zod';

const codeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, 'Code may only contain letters, numbers, dots, underscores and hyphens.');

export const teamIdParamSchema = z.object({
  teamId: z.string().min(1, 'Team identifier is required.'),
});

export const teamMemberParamSchema = z.object({
  teamId: z.string().min(1, 'Team identifier is required.'),
  userId: z.string().min(1, 'User identifier is required.'),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required.').max(160),
  code: codeSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  departmentId: z.string().min(1).nullable().optional(),
  leadId: z.string().min(1).nullable().optional(),
  email: z.string().trim().email('A valid email address is required.').max(200).optional(),
});

export const updateTeamSchema = createTeamSchema.partial().strict();

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1, 'User identifier is required.'),
  role: z.string().trim().max(60).optional(),
  isLead: z.boolean().optional(),
});

export const assignTeamQueueSchema = z.object({
  queueId: z.string().min(1, 'Queue identifier is required.'),
});

export const teamQueueParamSchema = z.object({
  teamId: z.string().min(1, 'Team identifier is required.'),
  queueId: z.string().min(1, 'Queue identifier is required.'),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type AssignTeamQueueInput = z.infer<typeof assignTeamQueueSchema>;
