/**
 * Time-scoped permission grants ("temporary grants").
 *
 * Temporary grants layer single permission keys on top of a principal's
 * resolved permissions (source badge: "temporary"). They surface in the
 * EffectiveAccess viewer, may carry an expiry, and are revoked through
 * DELETE /authorization/grants/:id (soft delete — row kept for audit).
 *
 * Permission resolution itself stays pure (authorization.service); this
 * service only reads/writes the grant rows and merges them into the
 * effective response via mergeGrants (pure).
 */

const AuthorizationGrant = require("../models/AuthorizationGrant");
const { expandGrants } = require("./authorization.service");
const ApiError = require("../utils/ApiError");

const GRANTEE_TYPES = ["agent", "user"];

const KNOWN_ROOTS = [
  "itsm.",
  "tenant.",
  "instance.",
  "access.",
  "knowledge.",
  "api.",
  "field:",
];

function isValidPermissionKey(key) {
  if (typeof key !== "string" || !key) return false;
  if (/\s/.test(key)) return false;
  return KNOWN_ROOTS.some((root) => key.startsWith(root));
}

async function activeGrantsFor({ tenantId, granteeId, granteeType }) {
  const rows = await AuthorizationGrant.find({
    tenantId,
    granteeId,
    granteeType,
    revokedAt: null,
  });
  const now = Date.now();
  return (rows || []).filter(
    (grant) =>
      !grant.expiresAt || new Date(grant.expiresAt).getTime() > now,
  );
}

/**
 * Merge active grant rows into a resolveEffectivePermissions result.
 * Pure — no DB access — so it is unit-testable offline.
 */
function mergeGrants(base, grants) {
  const result = {
    ...base,
    grants: [...(base.grants || [])],
    effective: [...(base.effective || base.grants || [])],
    sources: { ...(base.sources || {}) },
  };
  const temporaryGrants = [];
  for (const grant of grants || []) {
    const grantId = String(grant._id || grant.id || "");
    const expanded = [...expandGrants([grant.permission])].filter(
      (key) => key !== "*",
    );
    temporaryGrants.push({
      grantId,
      permission: grant.permission,
      expanded,
      expiresAt:
        grant.expiresAt == null
          ? null
          : grant.expiresAt instanceof Date
          ? grant.expiresAt.toISOString()
          : grant.expiresAt,
      grantedBy: grant.grantedBy ? String(grant.grantedBy) : null,
    });
    for (const key of expanded) {
      if (!result.sources[key]) {
        result.grants.push(key);
        result.effective.push(key);
        result.sources[key] = "temporary";
      }
    }
  }
  result.temporaryGrants = temporaryGrants;
  return result;
}

/**
 * Fetch active grants for a principal and layer them over the effective
 * result. `options.granteeType` is "agent" | "user" and mirrors the
 * principal kind.
 */
async function layeredEffectivePermissions(
  principal,
  tenantId,
  base,
  options = {},
) {
  if (!principal || !tenantId) return base;
  const granteeType = options.granteeType || principal._granteeType || "agent";
  const granteeId = String(principal._id || principal.id || "");
  if (!granteeId) return base;
  const active = await activeGrantsFor({ tenantId, granteeId, granteeType });
  return mergeGrants(base, active);
}

async function grantPermission({
  tenantId,
  granteeId,
  granteeType,
  permission,
  expiresAt = null,
  grantedBy = null,
}) {
  if (!GRANTEE_TYPES.includes(granteeType))
    throw new ApiError(422, "granteeType must be 'agent' or 'user'");
  const key = String(permission || "").trim();
  if (!isValidPermissionKey(key))
    throw new ApiError(422, "A valid permission key is required");
  return AuthorizationGrant.create({
    tenantId,
    granteeId,
    granteeType,
    permission: key,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    grantedBy: grantedBy || null,
  });
}

/**
 * Soft-revoke a grant. Returns the updated row, or null when the grant does
 * not exist or does not belong to the supplied tenant (no cross-tenant
 * enumeration).
 */
async function revokeGrant({ id, tenantId, revokedBy = null }) {
  const existing = await AuthorizationGrant.findById(id);
  if (!existing) return null;
  if (String(existing.tenantId) !== String(tenantId)) return null;
  return AuthorizationGrant.findByIdAndUpdate(
    id,
    { revokedAt: new Date(), revokedBy: revokedBy || null },
    { new: true },
  );
}

module.exports = {
  GRANTEE_TYPES,
  isValidPermissionKey,
  activeGrantsFor,
  mergeGrants,
  layeredEffectivePermissions,
  grantPermission,
  revokeGrant,
};