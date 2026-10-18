import { z } from 'zod';

export const ACCESS_POLICY_TYPES = [
  'PASSWORD_POLICY',
  'SESSION_POLICY',
  'IP_ALLOWLIST',
  'MFA_ENFORCEMENT',
  'ACCESS_WINDOW',
  'API_RESTRICTION',
] as const;

export type AccessPolicyType = (typeof ACCESS_POLICY_TYPES)[number];

export const policyRulesSchema = z
  .record(z.unknown())
  .refine((value) => Object.keys(value).length > 0, 'Policy rules must contain at least one rule.');

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function validateRulesForPolicyType(policyType: string, rules: Record<string, unknown>): string[] {
  const issues: string[] = [];

  switch (policyType) {
    case 'IP_ALLOWLIST':
      if (!isStringArray(rules['cidrs'])) {
        issues.push('IP_ALLOWLIST policies require "rules.cidrs" to be a non-empty array of CIDR strings.');
      }
      break;
    case 'SESSION_POLICY':
      if (!isPositiveNumber(rules['maxIdleMinutes'])) {
        issues.push('SESSION_POLICY policies require "rules.maxIdleMinutes" to be a positive number of minutes.');
      }
      break;
    case 'MFA_ENFORCEMENT':
      if (!isStringArray(rules['requiredFor'])) {
        issues.push('MFA_ENFORCEMENT policies require "rules.requiredFor" to be a non-empty array of subject descriptors.');
      }
      break;
    case 'ACCESS_WINDOW':
      if (rules['days'] !== undefined && !isStringArray(rules['days'])) {
        issues.push('ACCESS_WINDOW "rules.days" must be a non-empty array of weekdays when provided.');
      }
      break;
    case 'API_RESTRICTION':
      if (rules['allowedMethods'] !== undefined && !isStringArray(rules['allowedMethods'])) {
        issues.push('API_RESTRICTION "rules.allowedMethods" must be a non-empty array of HTTP methods when provided.');
      }
      break;
    default:
      break;
  }

  return issues;
}

export const createAccessPolicySchema = z.object({
  name: z.string().trim().min(2, 'Policy name must be at least 2 characters.').max(120),
  description: z.string().trim().max(1000).optional(),
  policyType: z.enum(ACCESS_POLICY_TYPES),
  rules: policyRulesSchema,
  priority: z.number().int().min(0).max(10000).optional().default(100),
  isEnabled: z.boolean().optional().default(true),
});

export const updateAccessPolicySchema = z.object({
  name: z.string().trim().min(2, 'Policy name must be at least 2 characters.').max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  rules: policyRulesSchema.optional(),
  priority: z.number().int().min(0).max(10000).optional(),
});

export const accessPolicyIdParamSchema = z.object({
  policyId: z.string().min(1, 'Policy identifier is required.'),
});

export const accessPolicyAssignmentParamSchema = z.object({
  policyId: z.string().min(1, 'Policy identifier is required.'),
  assignmentId: z.string().min(1, 'Assignment identifier is required.'),
});

export const createAccessPolicyAssignmentSchema = z.object({
  subjectType: z.enum(['USER', 'ROLE']),
  subjectId: z.string().min(1, 'Subject identifier is required.'),
});

export type CreateAccessPolicyInput = z.infer<typeof createAccessPolicySchema>;
export type UpdateAccessPolicyInput = z.infer<typeof updateAccessPolicySchema>;
export type CreateAccessPolicyAssignmentInput = z.infer<typeof createAccessPolicyAssignmentSchema>;
