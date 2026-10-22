import { z } from "zod";

const ticketPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters.")
    .max(200),
  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters.")
    .max(10000),
  priority: ticketPrioritySchema.optional().default("NORMAL"),
  category: z.string().trim().max(120).optional(),
  requesterName: z
    .string()
    .trim()
    .min(2, "Requester name is required.")
    .max(120),
  requesterEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid requester email is required.")
    .max(255),
  tenantId: z.string().min(1).optional(),
  queueId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updateTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters.")
    .max(200)
    .optional(),
  priority: ticketPrioritySchema.optional(),
  category: z.string().trim().max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  queueId: z.string().min(1).nullable().optional(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().min(1, "An assignee is required."),
  note: z.string().trim().max(1000).optional(),
});

export const replyTicketSchema = z.object({
  body: z.string().trim().min(1, "Reply body is required.").max(10000),
  isInternal: z.boolean().optional().default(false),
});

export const resolveTicketSchema = z.object({
  resolutionNote: z
    .string()
    .trim()
    .min(1, "Resolution note cannot be empty.")
    .max(5000)
    .optional(),
});

export const createQueueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Queue name must be at least 2 characters.")
    .max(120),
  description: z.string().trim().max(1000).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid queue email is required.")
    .max(255)
    .optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateQueueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Queue name must be at least 2 characters.")
    .max(120)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid queue email is required.")
    .max(255)
    .nullable()
    .optional(),
  isDefault: z.boolean().optional(),
});

export const ticketIdParamSchema = z.object({
  ticketId: z.string().min(1, "Ticket identifier is required."),
});

export const queueIdParamSchema = z.object({
  queueId: z.string().min(1, "Queue identifier is required."),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
export type CreateQueueInput = z.infer<typeof createQueueSchema>;
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;
