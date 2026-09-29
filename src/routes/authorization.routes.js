/**
 * Authorization route anchors — /authorization/*
 *
 * Data-driven endpoints for the permission tree, the effective-access
 * viewer and the permission simulator. All decision logic lives in
 * services/authorization.service; these routes only adapt it for the
 * frontend (and audit the lookups that privileged callers perform).
 */

const express = require("express");
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../middleware/auth");
const {
  resolveEffectivePermissions,
  hasPermission,
} = require("../services/authorization.service");
const {
  FIELD_POLICIES,
  tree,
} = require("../permissions/itsmCatalog");
const Agent = require("../models/Agent");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { audit } = require("../services/audit.service");
const AuthorizationGrant = require("../models/AuthorizationGrant");
const {
  layeredEffectivePermissions,
  grantPermission,
  revokeGrant,
} = require("../services/authorizationGrants.service");

const router = express.Router();
router.use(protectTenantPrincipal);

const currentPrincipal = (req) => req.agent || req.user || req.superAdmin;

const hasManageGrantAccess = (req) => {
  if (!req.agent) return false;
  if (req.agent.isAdmin || (req.agent.role && req.agent.role.isAdmin)) return true;
  return (
    hasPermission(req.agent, "tenant.permission.manage") ||
    hasPermission(req.agent, "access.manage")
  );
};

// ─── Permission tree (data-driven picker source) ─────────────────────────
router.get("/tree", (req, res) => {
  res.json({ success: true, modules: tree() });
});

// ─── Field-policy catalog (sensitive fields per resource) ────────────────
router.get("/field-policies", (req, res) => {
  res.json({ success: true, policies: FIELD_POLICIES });
});

// ─── Effective permissions for the logged-in principal ───────────────────
router.get(
  "/me/effective",
  asyncHandler(async (req, res) => {
    const principal = currentPrincipal(req);
    if (!principal) throw new ApiError(401, "Not authorized");
    principal.tenantId = req.companyId || principal.company;
    const base = resolveEffectivePermissions(principal);
    const layered = await layeredEffectivePermissions(
      principal,
      req.companyId || principal.company,
      base,
      { granteeType: req.agent ? "agent" : "user" },
    );
    res.json(layered);
  }),
);

// ─── Effective-permissions viewer for a specific agent/user (admin-only) ──
router.get(
  "/users/:id/effective",
  requirePermission("tenant.user.read"),
  asyncHandler(async (req, res) => {
    let target = await Agent.findById(req.params.id).populate("role");
    let targetType = "agent";
    if (!target) {
      target = await User.findById(req.params.id);
      targetType = "user";
    }
    if (!target) throw new ApiError(404, "User not found");
    if (
      req.companyId &&
      target.company &&
      String(target.company) !== String(req.companyId)
    ) {
      throw new ApiError(403, "Cannot view a user outside this instance");
    }
    target.tenantId = req.companyId || target.company;
    const base = resolveEffectivePermissions(target);
    const layered = await layeredEffectivePermissions(
      target,
      req.companyId || target.company,
      base,
      { granteeType: targetType },
    );
    if (req.agent) {
      audit({
        company: req.companyId,
        actorType: "agent",
        actor: req.agent._id,
        actorName: req.agent.name || "",
        action: "authorization.effective_viewed",
        entityType: "agent",
        entityId: target._id,
        after: { grants: layered.grants.length },
        source: "authorization",
        req,
      }).catch(() => {});
    }
    res.json(layered);
  }),
);

// ─── Permission simulator ─────────────────────────────────────────────────
// Body: { permission, record? } for the current principal, or
//       { principal, permission, record? } with a synthetic principal spec.
// Returns { decision: 'ALLOW'|'DENY', trace: string[] }.
router.post(
  "/simulate",
  asyncHandler(async (req, res) => {
    const { permission, record, principal: principalSpec } = req.body || {};
    if (!permission || typeof permission !== "string")
      throw new ApiError(422, "A permission key is required");
    let principal;
    if (principalSpec) {
      if (!req.agent)
        throw new ApiError(403, "Only staff may simulate another principal");
      principal = principalSpec;
    } else {
      principal = currentPrincipal(req);
    }
    if (!principal) throw new ApiError(401, "Not authorized");
    const trace = [];
    const parseRecord = (value) => {
      if (!value || typeof value !== "object") return undefined;
      return value;
    };
    const resolvedRecord = parseRecord(record);
    const granted = hasPermission(principal, permission);
    trace.push(
      `${granted ? "ALLOW" : "DENY"} ${permission} (via ${
        granted ? "grants" : "no matching grant"
      })`,
    );
    if (granted && resolvedRecord) {
      const { checkScope } = require("../services/authorization.service");
      const scope = checkScope(
        principal,
        resolvedRecord,
        req.companyId || principal.tenantId,
      );
      trace.push(scope.ok ? `Record matches scope ${scope.scope}` : "Record rejected by scope");
      res.json({
        decision: scope.ok ? "ALLOW" : "DENY",
        trace,
      });
      return;
    }
    res.json({ decision: granted ? "ALLOW" : "DENY", trace });
  }),
);

// ─── Temporary (time-scoped) permission grants ────────────────────────────
// Grant a single permission key to an agent/user with an optional expiry.
// Creation is admin-only; revocation is admin-or-self.
router.post(
  "/grants",
  asyncHandler(async (req, res) => {
    if (!hasManageGrantAccess(req))
      throw new ApiError(
        403,
        "Only admins or users with permission management access can create grants",
      );
    const { granteeId, granteeType, permission, expiresAt } = req.body || {};
    let target, targetType;
    if (granteeType === "user") {
      target = await User.findById(granteeId);
      targetType = "user";
    } else {
      target = await Agent.findById(granteeId);
      targetType = "agent";
    }
    if (!target)
      throw new ApiError(422, "Grantee does not exist as the given type");
    if (
      req.companyId &&
      target.company &&
      String(target.company) !== String(req.companyId)
    ) {
      throw new ApiError(403, "Cannot grant access outside this instance");
    }
    const grant = await grantPermission({
      tenantId: req.companyId,
      granteeId,
      granteeType: targetType,
      permission,
      expiresAt: expiresAt || null,
      grantedBy: req.agent._id,
    });
    audit({
      company: req.companyId,
      actorType: "agent",
      actor: req.agent._id,
      actorName: req.agent.name || "",
      action: "authorization.grant_created",
      entityType: "authorization_grant",
      entityId: grant._id,
      after: {
        granteeId,
        granteeType: targetType,
        permission,
        expiresAt: expiresAt || null,
      },
      source: "authorization",
      req,
    }).catch(() => {});
    res.status(201).json({ success: true, grant });
  }),
);

router.delete(
  "/grants/:id",
  asyncHandler(async (req, res) => {
    const requesterId = String((req.agent || req.user)?._id || "");
    const requesterType = req.agent ? "agent" : "user";
    const requesterName = (req.agent || req.user)?.name || "";
    const grant = await AuthorizationGrant.find({
      tenantId: req.companyId,
      _id: req.params.id,
      revokedAt: null,
    });
    const current = grant ? grant[0] : null;
    if (!current) throw new ApiError(404, "Grant not found in this instance");
    const granteeId = String(current.granteeId || current.grantee_id || "");
    const isSelf =
      requesterId === granteeId &&
      String(current.granteeType) === requesterType;
    if (!isSelf && !hasManageGrantAccess(req))
      throw new ApiError(
        403,
        "You can only revoke grants issued to yourself",
      );
    const revoked = await revokeGrant({
      id: req.params.id,
      tenantId: req.companyId,
      revokedBy: requesterId || null,
    });
    if (!revoked)
      throw new ApiError(404, "Grant not found in this instance");
    audit({
      company: req.companyId,
      actorType: requesterType,
      actor: (req.agent || req.user)?._id,
      actorName: requesterName,
      action: "authorization.grant_revoked",
      entityType: "authorization_grant",
      entityId: revoked._id,
      before: { permission: revoked.permission, granteeId: revoked.granteeId },
      after: { revoked: true, permission: revoked.permission },
      source: "authorization",
      req,
    }).catch(() => {});
    res.json({ success: true, grant: revoked });
  }),
);

module.exports = router;