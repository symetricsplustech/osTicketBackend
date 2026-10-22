import { z } from "zod";

const structureNodeSchema: z.ZodType<{
  id?: string;
  name: string;
  type?: string;
  parentId?: string | null;
  managerId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  children?: unknown[];
  metadata?: Record<string, unknown> | null;
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(160),
    type: z.string().trim().max(60).optional(),
    parentId: z.string().min(1).nullable().optional(),
    managerId: z.string().min(1).nullable().optional(),
    departmentId: z.string().min(1).nullable().optional(),
    teamId: z.string().min(1).nullable().optional(),
    children: z.array(structureNodeSchema).max(2000).optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
);

export const updateOrganizationStructureSchema = z
  .object({
    reportingMode: z.enum(["DEPARTMENT", "TEAM", "HYBRID"]).optional(),
    rootNodeId: z.string().min(1).nullable().optional(),
    nodes: z.array(structureNodeSchema).max(2000).optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export type UpdateOrganizationStructureInput = z.infer<
  typeof updateOrganizationStructureSchema
>;
export type OrganizationStructureNode = z.infer<typeof structureNodeSchema>;
