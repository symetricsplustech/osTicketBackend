import { prisma } from "../config/database";
import { logger } from "../config/logger";
import { recordSecurityEvent } from "../shared/audit";

interface ServiceLevel {
  targetMinutes?: unknown;
  responseMinutes?: unknown;
  resolutionMinutes?: unknown;
  priority?: unknown;
}

function validateServiceLevels(serviceLevels: unknown): string[] {
  const issues: string[] = [];
  if (!Array.isArray(serviceLevels) || serviceLevels.length === 0) {
    issues.push(
      "serviceLevels must be a non-empty array of response/resolution targets.",
    );
    return issues;
  }
  serviceLevels.forEach((level, index) => {
    if (typeof level !== "object" || level === null) {
      issues.push(`serviceLevels[${index}] must be an object.`);
      return;
    }
    const entry = level as ServiceLevel;
    const response = entry.responseMinutes ?? entry.targetMinutes;
    const resolution = entry.resolutionMinutes;
    if (typeof response !== "number" || response <= 0) {
      issues.push(
        `serviceLevels[${index}] is missing a positive responseMinutes (or targetMinutes) value.`,
      );
    }
    if (
      resolution !== undefined &&
      (typeof resolution !== "number" || resolution <= 0)
    ) {
      issues.push(
        `serviceLevels[${index}].resolutionMinutes must be a positive number when provided.`,
      );
    }
  });
  return issues;
}

export async function runSlaMonitorJob(): Promise<{
  policiesChecked: number;
  invalidPolicies: number;
}> {
  const policies = await prisma.slaPolicy.findMany({
    where: { status: "ENABLED", deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      serviceLevels: true,
      settings: true,
    },
  });

  let invalidPolicies = 0;
  for (const policy of policies) {
    const issues = validateServiceLevels(policy.serviceLevels);

    const settings = (policy.settings ?? {}) as Record<string, unknown>;
    const calendarId = settings["calendarId"];
    if (typeof calendarId === "string" && calendarId) {
      const calendar = await prisma.businessCalendar.findUnique({
        where: { id: calendarId },
      });
      if (!calendar) {
        issues.push(
          `Referenced business calendar ${calendarId} does not exist.`,
        );
      }
    }

    if (issues.length > 0) {
      invalidPolicies += 1;
      await recordSecurityEvent({
        eventType: "sla.policy.invalid_definition",
        severity: "MEDIUM",
        details: { policyId: policy.id, policyKey: policy.key, issues },
      });
    }
  }

  if (invalidPolicies > 0) {
    logger.warn(
      { policiesChecked: policies.length, invalidPolicies },
      "SLA monitor found invalid policy definitions",
    );
  }
  return { policiesChecked: policies.length, invalidPolicies };
}
