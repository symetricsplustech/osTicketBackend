import { z } from "zod";

export const supportTicketIdParamSchema = z.object({
  ticketId: z.string().min(1),
});

export const createSupportTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(20000),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    category: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateSupportTicketSchema = z
  .object({
    subject: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().min(1).max(20000).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    category: z.string().trim().max(120).optional(),
  })
  .strict();

export const replySupportTicketSchema = z
  .object({
    body: z.string().trim().min(1).max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();
