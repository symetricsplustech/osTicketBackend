/**
 * Field-level RBAC middleware.
 * Reads rolePermission.fieldRestrictions from the request and applies
 * field-level read/write filtering to the response body and request body.
 */
const RolePermission = require("../models/core/RolePermission");
const UserRole = require("../models/core/UserRole");
const ApiError = require("../utils/ApiError");

function buildFieldRestrictionMap(permissions) {
  const map = {};
  for (const p of permissions) {
    if (p.fieldRestrictions && Object.keys(p.fieldRestrictions).length > 0) {
      for (const [field, access] of Object.entries(p.fieldRestrictions)) {
        if (!map[field] || access === "deny") {
          map[field] = access;
        }
      }
    }
  }
  return map;
}

function filterFields(obj, restrictions, mode = "read") {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj))
    return obj.map((item) => filterFields(item, restrictions, mode));

  const result = { ...obj };
  for (const [field, access] of Object.entries(restrictions)) {
    if (mode === "read" && access === "hide") {
      delete result[field];
    } else if (
      mode === "write" &&
      (access === "readonly" || access === "hide")
    ) {
      delete result[field];
    }
  }
  return result;
}

function requireFieldPermission(resource, action) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();

      const tenantId = req.user.company || req.companyId;
      const userId = req.user._id;

      const userRoles = await UserRole.find({
        tenantId,
        userId,
        status: "active",
      }).lean();
      if (userRoles.length === 0) return next();

      const roleIds = userRoles.map((ur) => ur.roleId);
      const permissions = await RolePermission.find({
        tenantId,
        roleId: { $in: roleIds },
        permissionKey: `${resource}.${action}`,
      }).lean();

      if (permissions.length === 0) return next();

      const fieldRestrictions = buildFieldRestrictionMap(permissions);
      req.fieldRestrictions = fieldRestrictions;

      if (
        req.body &&
        typeof req.body === "object" &&
        Object.keys(fieldRestrictions).length > 0
      ) {
        req.body = filterFields(req.body, fieldRestrictions, "write");
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function applyFieldRestrictionsToResponse(data, fieldRestrictions) {
  if (!fieldRestrictions || Object.keys(fieldRestrictions).length === 0)
    return data;
  return filterFields(data, fieldRestrictions, "read");
}

module.exports = {
  requireFieldPermission,
  applyFieldRestrictionsToResponse,
  filterFields,
  buildFieldRestrictionMap,
};
