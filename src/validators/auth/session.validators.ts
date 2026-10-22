import { z } from "zod";

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, "Session identifier is required."),
});

export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
