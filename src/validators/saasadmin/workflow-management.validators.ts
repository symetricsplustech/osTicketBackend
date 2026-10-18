import { z } from 'zod';

export const workflowKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    'Key must contain only lowercase letters, numbers and hyphens.',
  );

export const workflowNodeTypeSchema = z.enum([
  'START',
  'CONDITION',
  'ACTION',
  'APPROVAL',
  'NOTIFICATION',
  'END',
]);

export const workflowNodeSchema = z.object({
  id: z.string().trim().min(1, 'Node id is required.').max(120),
  type: workflowNodeTypeSchema,
  name: z.string().trim().min(1, 'Node name is required.').max(200),
  config: z.record(z.unknown()).optional(),
  next: z.array(z.string().trim().min(1, 'Transition targets must be non-empty node ids.')).optional(),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1, 'A workflow definition requires at least one node.'),
  initialNodeId: z.string().trim().min(1, 'An initial node id is required.'),
});

export const createWorkflowTemplateSchema = z.object({
  key: workflowKeySchema,
  name: z.string().trim().min(2, 'Template name must be at least 2 characters.').max(160),
  description: z.string().trim().max(2000).optional(),
  definition: workflowDefinitionSchema,
});

export const updateWorkflowTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Template name must be at least 2 characters.').max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  definition: workflowDefinitionSchema.optional(),
});

export const validateWorkflowDefinitionBodySchema = z.object({
  definition: workflowDefinitionSchema.optional(),
});

export const workflowTemplateIdParamSchema = z.object({
  templateId: z.string().min(1, 'Template identifier is required.'),
});

export const workflowRunIdParamSchema = z.object({
  runId: z.string().min(1, 'Run identifier is required.'),
});

export const workflowTenantParamSchema = z.object({
  tenantId: z.string().min(1, 'Tenant identifier is required.'),
});

export const tenantWorkflowAssignmentEntrySchema = z.object({
  templateId: z.string().min(1, 'Template identifier is required.'),
  moduleKey: z.string().trim().min(1).max(60).optional(),
});

export const tenantWorkflowAssignmentsSchema = z.object({
  assignments: z
    .array(tenantWorkflowAssignmentEntrySchema)
    .max(500, 'At most 500 workflow assignments can be set at once.'),
});

export type WorkflowNodeType = z.infer<typeof workflowNodeTypeSchema>;
export type WorkflowNodeInput = z.infer<typeof workflowNodeSchema>;
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;
export type CreateWorkflowTemplateInput = z.infer<typeof createWorkflowTemplateSchema>;
export type UpdateWorkflowTemplateInput = z.infer<typeof updateWorkflowTemplateSchema>;
export type ValidateWorkflowDefinitionBodyInput = z.infer<typeof validateWorkflowDefinitionBodySchema>;
export type TenantWorkflowAssignmentEntryInput = z.infer<typeof tenantWorkflowAssignmentEntrySchema>;
export type TenantWorkflowAssignmentsInput = z.infer<typeof tenantWorkflowAssignmentsSchema>;

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ParsedNode {
  id: string;
  type: WorkflowNodeType;
  next: string[];
  hasConfig: boolean;
}

/**
 * Validates a workflow definition graph. Accepts unknown input so stored JSON
 * definitions can be validated in addition to request payloads.
 */
export function validateWorkflowDefinition(definition: unknown): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (definition === null || typeof definition !== 'object' || Array.isArray(definition)) {
    return {
      valid: false,
      errors: ['Workflow definition must be an object with "nodes" and "initialNodeId".'],
      warnings,
    };
  }

  const candidate = definition as { nodes?: unknown; initialNodeId?: unknown };
  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0) {
    return {
      valid: false,
      errors: ['Workflow definition must contain a non-empty "nodes" array.'],
      warnings,
    };
  }

  const validTypes = new Set<string>(workflowNodeTypeSchema.options);
  const nodeById = new Map<string, ParsedNode>();
  const duplicateIds = new Set<string>();

  candidate.nodes.forEach((rawNode, index) => {
    if (rawNode === null || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      errors.push(`Node at index ${index} must be an object.`);
      return;
    }

    const node = rawNode as { id?: unknown; type?: unknown; name?: unknown; config?: unknown; next?: unknown };

    if (typeof node.id !== 'string' || node.id.trim().length === 0) {
      errors.push(`Node at index ${index} is missing a valid "id".`);
      return;
    }
    const id = node.id.trim();

    if (nodeById.has(id) || duplicateIds.has(id)) {
      duplicateIds.add(id);
      return;
    }

    if (typeof node.type !== 'string' || !validTypes.has(node.type)) {
      errors.push(`Node "${id}" has an invalid type.`);
      return;
    }

    if (typeof node.name !== 'string' || node.name.trim().length === 0) {
      errors.push(`Node "${id}" is missing a valid "name".`);
    }

    let next: string[] = [];
    if (node.next !== undefined) {
      if (!Array.isArray(node.next) || node.next.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        errors.push(`Node "${id}" has an invalid "next" list.`);
      } else {
        next = (node.next as string[]).map((entry) => entry.trim());
      }
    }

    nodeById.set(id, {
      id,
      type: node.type as WorkflowNodeType,
      next,
      hasConfig:
        node.config !== undefined &&
        node.config !== null &&
        typeof node.config === 'object' &&
        (Array.isArray(node.config) ? node.config.length > 0 : Object.keys(node.config).length > 0),
    });
  });

  for (const id of duplicateIds) {
    errors.push(`Node id "${id}" is used more than once.`);
  }

  const startNodes = Array.from(nodeById.values()).filter((node) => node.type === 'START');
  const endNodes = Array.from(nodeById.values()).filter((node) => node.type === 'END');

  if (startNodes.length !== 1) {
    errors.push(`Workflow definition must contain exactly one START node (found ${startNodes.length}).`);
  }
  if (endNodes.length === 0) {
    errors.push('Workflow definition must contain at least one END node.');
  }

  const initialNodeId = typeof candidate.initialNodeId === 'string' ? candidate.initialNodeId.trim() : '';
  if (initialNodeId.length === 0) {
    errors.push('An "initialNodeId" is required.');
  } else {
    const initialNode = nodeById.get(initialNodeId);
    if (!initialNode) {
      errors.push(`Initial node "${initialNodeId}" does not exist.`);
    } else if (initialNode.type !== 'START') {
      errors.push(`Initial node "${initialNodeId}" must be of type START.`);
    }
  }

  for (const node of nodeById.values()) {
    for (const target of node.next) {
      if (!nodeById.has(target)) {
        errors.push(`Node "${node.id}" references unknown node "${target}" in "next".`);
      }
    }
    if (node.type !== 'END' && node.next.length === 0) {
      errors.push(`Node "${node.id}" (${node.type}) must have at least one outgoing transition in "next".`);
    }
    if (node.type === 'END' && node.next.length > 0) {
      warnings.push(`Node "${node.id}" is an END node but declares outgoing transitions; they will be ignored.`);
    }
    if (node.type === 'CONDITION' && !node.hasConfig) {
      warnings.push(`Node "${node.id}" is a CONDITION node without configuration.`);
    }
  }

  const traversalStartId = nodeById.has(initialNodeId) ? initialNodeId : startNodes[0]?.id;
  if (traversalStartId) {
    const visited = new Set<string>();
    const queue: string[] = [traversalStartId];
    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = nodeById.get(currentId);
      if (!current) continue;
      for (const target of current.next) {
        if (nodeById.has(target) && !visited.has(target)) queue.push(target);
      }
    }

    const unreachable = Array.from(nodeById.keys()).filter((id) => !visited.has(id));
    if (unreachable.length > 0) {
      errors.push(`Nodes unreachable from the START node: ${unreachable.join(', ')}.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
