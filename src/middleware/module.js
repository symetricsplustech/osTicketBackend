const ApiError = require('../utils/ApiError');

const resolveTenantId = (req) =>
  req.user?.tenantId || req.user?.companyId ||
  req.agent?.tenantId || req.agent?.company ||
  req.companyId || null;

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
        return next(new ApiError(403, 'Tenant context required'));
      }

      const mongoose = require('mongoose');

      // Check tenant_modules collection
      const db = mongoose.connection.db;
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      let subscription = await db.collection('tenant_modules').findOne({
        tenantId: tenantObjectId,
        moduleKey,
        status: 'active',
      });
      let graceReadOnly = false;

      if (!subscription) {
        // Read-only grace period: recently deactivated modules stay readable until graceUntil
        const graceDoc = await db.collection('tenant_modules').findOne({
          tenantId: tenantObjectId,
          moduleKey,
          status: 'disabled',
          graceUntil: { $gt: new Date() },
        });
        if (graceDoc) {
          if (req.method !== 'GET') {
            return next(new ApiError(403, `Module "${moduleKey}" is in read-only grace period until ${graceDoc.graceUntil.toISOString()}`));
          }
          subscription = graceDoc;
          graceReadOnly = true;
        }
      }

      if (!subscription) {
        // Trial expiry check
        const trialDoc = await db.collection('tenant_modules').findOne({
          tenantId: tenantObjectId,
          moduleKey,
          status: 'trial',
        });
        if (trialDoc && trialDoc.trialEndsAt && trialDoc.trialEndsAt < new Date()) {
          await db.collection('tenant_modules').updateOne({ _id: trialDoc._id }, { $set: { status: 'expired' } });
          return next(new ApiError(403, `Trial for "${moduleKey}" has expired`));
        }
        if (!trialDoc || trialDoc.status !== 'trial') {
          return next(new ApiError(403, `Module "${moduleKey}" is not activated for this organization`));
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
        return next(new ApiError(403, 'Tenant context required'));
      }

      const mongoose = require('mongoose');
      const db = mongoose.connection.db;

      const subscription = await db.collection('tenant_modules').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        moduleKey: { $in: moduleKeys },
        status: 'active',
      });

      if (!subscription) {
        return next(new ApiError(403, `One of these modules is required: ${moduleKeys.join(', ')}`));
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
    // Super admin has access to all modules
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'super_admin' || req.superAdmin)) {
      const allModules = ['helpdesk', 'crm', 'csm', 'itam', 'itom', 'projects', 'hr', 'field-service', 'workflow', 'analytics', 'ai', 'settings', 'cmdb', 'secops', 'grc', 'workplace', 'legal', 'procurement', 'finance', 'esg'];
      return res.json({ modules: allModules });
    }
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.json({ modules: [] });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const modules = await db.collection('tenant_modules')
      .find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active',
      })
      .toArray();

    res.json({ modules });
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
      return next(new ApiError(403, 'Tenant context required'));
    }

    const { modules: moduleKeys } = req.body;
    if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) {
      return next(new ApiError(400, 'modules array is required'));
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Valid module keys
    const validModules = [
      'helpdesk', 'crm', 'csm', 'itam', 'itom',
      'projects', 'hr', 'field-service', 'workflow',
      'analytics', 'ai', 'settings',
    ];

    const now = new Date();

    // Upsert each module
    for (const key of moduleKeys) {
      if (!validModules.includes(key)) continue;

      await db.collection('tenant_modules').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          moduleKey: key,
        },
        {
          $set: {
            status: 'active',
            activatedAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            moduleKey: key,
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }

    // Return updated modules list
    const modules = await db.collection('tenant_modules')
      .find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active',
      })
      .toArray();

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
      return next(new ApiError(403, 'Tenant context required'));
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Don't allow deactivating settings
    if (moduleKey === 'settings') {
      return next(new ApiError(400, 'Cannot deactivate settings module'));
    }

    await db.collection('tenant_modules').updateOne(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        moduleKey,
      },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    const modules = await db.collection('tenant_modules')
      .find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active',
      })
      .toArray();

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
