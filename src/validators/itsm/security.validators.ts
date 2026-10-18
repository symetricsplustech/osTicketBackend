import { z } from 'zod';

export const sessionIdParamSchema = z.object({ sessionId: z.string().min(1) });
