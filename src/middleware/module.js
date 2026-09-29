const ApiError = require("../utils/ApiError");

const resolveTenantId = (req) =>
  req.user?.tenantId ||
  req.user?.companyId ||
  req.agent?.tenantId ||
  req.agent?.company ||
  req.companyId ||
  null;

/**
 * Middleware factory: checks if the tenant has a specific module activated.
 * Usage: router.post('/tickets', moduleRequired('helpdesk'), handler)
 */
function moduleRequired(moduleKey) {
  return async (req, res, next) => {
    try {
      // Superadmin bypasses module checks - they manage the platform, not tenant modules
      if (req.agent?.isSuperAdmin || req.superAdmin) {
        return next();
      }
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return next(new ApiError(403, "Tenant context required"));
      }

      const { getDB } = require("../config/db");

      // Check PostgreSQL module entitlements.
      let subscription = await getDB()("tenant_modules").where({
        tenant_id: tenantId,
        module_key: moduleKey,
        status: "active",
      }).first();
      let graceReadOnly = false;

      if (!subscription) {
        // Read-only grace period: recently deactivated modules stay readable until graceUntil
        const graceDoc = await getDB()("tenant_modules").where({
          tenant_id: tenantId,
          module_key: moduleKey,
          status: "disabled",
        }).where("grace_until", ">", new Date()).first();
        if (graceDoc) {
          if (req.method !== "GET") {
            return next(
              new ApiError(
                403,
                `Module "${moduleKey}" is in read-only grace period until ${graceDoc.grace_until.toISOString()}`,
              ),
            );
          }
          subscription = graceDoc;
          graceReadOnly = true;
        }
      }

      if (!subscription) {
        // Trial expiry check
        const trialDoc = await getDB()("tenant_modules").where({
          tenant_id: tenantId,
          module_key: moduleKey,
          status: "trial",
        }).first();
        if (
          trialDoc &&
          trialDoc.trial_ends_at &&
          trialDoc.trial_ends_at < new Date()
        ) {
          await getDB()("tenant_modules")
            .where({ id: trialDoc.id })
            .update({ status: "expired" });
          return next(
            new ApiError(403, `Trial for "${moduleKey}" has expired`),
          );
        }
        if (!trialDoc || trialDoc.status !== "trial") {
          return next(
            new ApiError(
              403,
              `Module "${moduleKey}" is not activated for this organization`,
            ),
          );
        }
        subscription = trialDoc;
      }

      req.moduleGraceReadOnly = graceReadOnly;

      // Attach activated modules to request for downstream use
      req.activatedModules = req.activatedModules || [];
      req.activatedModules.push(moduleKey);

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware factory: checks if the tenant has any of the specified modules.
 * Usage: router.get('/dashboard', moduleAnyRequired(['helpdesk', 'crm']), handler)
 */
function moduleAnyRequired(moduleKeys) {
  return async (req, res, next) => {
    try {
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return next(new ApiError(403, "Tenant context required"));
      }

      const { getDB } = require("../config/db");

      const subscription = await getDB()("tenant_modules").where({
        tenant_id: tenantId,
      }).whereIn("module_key", moduleKeys).where({ status: "active" }).first();

      if (!subscription) {
        return next(
          new ApiError(
            403,
            `One of these modules is required: ${moduleKeys.join(", ")}`,
          ),
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * GET /auth/modules - List activated modules for the current tenant
 */
async function getTenantModules(req, res, next) {
  try {
    // Only Helpdesk (default) and Settings (owner-owned) are enabled for now.
    const allModules = ["helpdesk", "settings"];
    // Super admin has access to all modules
    if (
      req.user &&
      (req.user.role === "superadmin" ||
        req.user.role === "super_admin" ||
        req.superAdmin)
    ) {
      return res.json({ modules: allModules });
    }
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      // No tenant context: still default to the HelpDesk module so a newly
      // registered user can actually use the product instead of bouncing to
      // the dashboard from every sidebar click.
      return res.json({ modules: allModules });
    }

    const { getDB } = require("../config/db");

    const modules = await getDB()("tenant_modules")
      .where({ tenant_id: tenantId, status: "active" });

    const active = modules
      .map((m) => m.module_key)
      .filter((m) => allModules.includes(m));

    res.json({ modules: active.length ? active : allModules });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/modules - Activate modules for the current tenant
 * Body: { modules: ['helpdesk', 'crm', 'itam'] }
 */
async function activateModules(req, res, next) {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return next(new ApiError(403, "Tenant context required"));
    }

    const { modules: moduleKeys } = req.body;
    if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) {
      return next(new ApiError(400, "modules array is required"));
    }

    const { getDB } = require("../config/db");

    // Valid module keys (only Helpdesk + owner Settings for now)
    const validModules = ["helpdesk", "settings"];

    const now = new Date();

    // Upsert each module
    for (const key of moduleKeys) {
      if (!validModules.includes(key)) continue;

      await getDB()("tenant_modules").insert({
        tenant_id: tenantId,
        module_key: key,
        status: "active",
        activated_at: now,
        updated_at: now,
        created_at: now,
      }).onConflict(["tenant_id", "module_key"]).merge({
        status: "active",
        activated_at: now,
        updated_at: now,
      });
    }

    // Return updated modules list
    const modules = await getDB()("tenant_modules")
      .where({ tenant_id: tenantId, status: "active" });

    res.json({ modules });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /auth/modules/:moduleKey - Deactivate a module
 */
async function deactivateModule(req, res, next) {
  try {
    const tenantId = resolveTenantId(req);
    const { moduleKey } = req.params;

    if (!tenantId) {
      return next(new ApiError(403, "Tenant context required"));
    }

    const { getDB } = require("../config/db");

    // Don't allow deactivating settings
    if (moduleKey === "settings") {
      return next(new ApiError(400, "Cannot deactivate settings module"));
    }

    await getDB()("tenant_modules").where({
      tenant_id: tenantId,
      module_key: moduleKey,
    }).update({ status: "inactive", updated_at: new Date() });

    const modules = await getDB()("tenant_modules")
      .where({ tenant_id: tenantId, status: "active" });

    res.json({ modules });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  moduleRequired,
  moduleAnyRequired,
  getTenantModules,
  activateModules,
  deactivateModule,
};
