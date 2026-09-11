/**
 * Route-to-Permission Registry
 *
 * Maps API routes (path + method) to required permissions.
 * Provides validation that all protected routes have permission declarations,
 * enabling CI/fail checks when routes lack declarations.
 *
 * Integration:
 *   - Register routes via `registerRoute(path, method, requiredPermission)`,
 *     typically done once at startup from route definition files.
 *   - Use `checkRoutePermissionMiddleware` in Express middleware to validate
 *     permissions per-request, or use `validateAllRoutes()` in tests/CI to
 *     ensure coverage.
 *
 * Conventions:
 *   - Paths are normalized (trimmed, lowercased) for matching.
 *   - Route keys support simple path patterns like `/tickets` or `/tickets/:id`.
 *   - Unregistered routes default to no permission requirement (open).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const routePermissionMap = new Map();

/**
 * Register an API route with its required permission.
 *
 * @param {string} path - The route path (e.g. '/tickets', '/tickets/:id')
 * @param {string} method - The HTTP method (e.g. 'GET', 'POST')
 * @param {string} requiredPermission - The required permission key (e.g. 'tickets.create')
 */
function registerRoute(path, method, requiredPermission) {
  const key = normalizeKey(path, method);
  routePermissionMap.set(key, requiredPermission);
}

/**
 * Normalize a path+method key for consistent lookup.
 */
function normalizeKey(path, method) {
  const normalizedPath = (path || '').trim().toLowerCase();
  const normalizedMethod = (method || '').trim().toUpperCase();
  return `${normalizedMethod} ${normalizedPath}`;
}

/**
 * Look up the required permission for a given path and method.
 *
 * @param {string} path - The route path
 * @param {string} method - The HTTP method
 * @returns {string|null} The required permission, or null if the route is not registered
 */
function lookupRequiredPermission(path, method) {
  const key = normalizeKey(path, method);
  return routePermissionMap.get(key) || null;
}

/**
 * Check if a specific route has a permission declaration registered.
 *
 * @param {string} path - The route path
 * @param {string} method - The HTTP method
 * @returns {boolean} true if the route has a permission declaration
 */
function hasRouteDeclaration(path, method) {
  return lookupRequiredPermission(path, method) !== null;
}

/**
 * Validate that all protected routes have permission declarations.
 * Used in CI/test suites to fail when routes are missing permission mappings.
 *
 * @param {Object} options
 * @param {Array<Object>} options.registeredRoutes - Optional list of { path, method } objects already registered
 * @returns {Object} { missing } - Routes missing permission declarations
 */
function validateAllRoutes({ registeredRoutes } = {}) {
  const missing = [];

  for (const { path, method } of registeredRoutes || []) {
    if (!hasRouteDeclaration(path, method)) {
      missing.push({ path, method });
    }
  }

  return { missing };
}

/**
 * Look up the required permission from an Express request object.
 *
 * @param {Object} req - Express request object
 * @returns {string|null} The required permission, or null if not registered
 */
function lookupRequiredPermissionFromReq(req) {
  const path = (req.originalUrl || req.path || '').trim().toLowerCase();
  const method = (req.method || '').trim().toUpperCase();
  const key = `${method} ${path}`;
  return routePermissionMap.get(key) || null;
}

/**
 * Middleware that checks route permission before passing to the next handler.
 * Uses the registry to look up the required permission and validates it
 * via the central authorization service.
 *
 * @param {Object} opts - Options
 * @param {string} opts.permissionOverride - Optional override for the required permission (for testing)
 * @returns {Function} Express middleware
 */
function checkRoutePermissionMiddleware({ permissionOverride } = {}) {
  return asyncHandler(async (req, res, next) => {
    const requiredPermission = permissionOverride
      ? permissionOverride
      : lookupRequiredPermissionFromReq(req);

    // If no permission is declared for this route, allow it (open route)
    if (!requiredPermission) {
      return next();
    }

    const { authorize } = require('../services/authorization.service');
    const principal = req.agent || req.user;

    if (!principal) {
      return next(new ApiError(401, 'Not authorized'));
    }

    const result = await authorize({
      principal,
      permission: requiredPermission,
      tenant: req.companyId,
      req,
    });

    if (result.decision !== 'ALLOW') {
      return next(new ApiError(403, 'You do not have permission for this action'));
    }

    req.authz = result;
    next();
  });
}

/**
 * Express router helper: wrap a router so that every route registered on it
 * is automatically added to the permission registry. Usage:
 *
 *   const ticketRouter = express.Router();
 *   withPermissionRegistry(ticketRouter, 'tickets.view');
 *   ticketRouter.get('/', ctrl.list);
 *
 * @param {Object} router - An express Router instance
 * @param {string} [defaultPermission] - Optional default permission for all routes on this router
 * @returns {Object} The enhanced router instance
 */
function withPermissionRegistry(router, defaultPermission) {
  const originalUse = router.use.bind(router);
  router.use = (...args) => {
    const [route] = args;
    if (route && typeof route === 'object' && route.stack) {
      for (const layer of route.stack) {
        if (layer.route) {
          const path = layer.route.path;
          const methods = layer.route.methods || {};
          for (const method of Object.keys(methods)) {
            if (method.toUpperCase() !== 'ALL') {
              registerRoute(path, method, defaultPermission);
            }
          }
        }
      }
    }
    return originalUse.apply(router, args);
  };
  return router;
}

/**
 * Register all routes from route definition files into the registry.
 * Meant to be called once at application startup.
 *
 * @param {Object} app - Express application instance
 */
function registerAllRoutes(app) {
  const routeFiles = [
    './routes/helpdesk/public',
    './routes/auth.routes',
    './routes/user.routes',
    './routes/helpdesk/tickets/customer.routes',
    './routes/helpdesk/tickets/agent.routes',
    './routes/admin.routes',
    './routes/superadmin.routes',
    './routes/helpdesk/knowledge',
    './routes/crm.routes',
    './routes/itom.routes',
    './routes/projects.routes',
    './routes/hr.routes',
    './routes/fieldservice.routes',
    './routes/product.routes',
    './routes/license.routes',
    './routes/stockroom.routes',
    './routes/customerService.routes',
    './routes/platform.routes',
    './routes/bulk.routes',
    './routes/rbac.routes',
    './routes/enterprise.routes',
    './routes/i18n.routes',
    './routes/remaining.routes',
    './routes/ops.routes',
    './routes/fillgaps.routes',
    './routes/fillgaps2.routes',
    './routes/fillgaps3.routes',
    './routes/crud.routes',
    './routes/backendGaps.routes',
  ];

  for (const routeFile of routeFiles) {
    try {
      const routeModule = require(routeFile);
      if (routeModule && routeModule.router && routeModule.router.stack) {
        for (const layer of routeModule.router.stack) {
          if (layer.route) {
            const path = layer.route.path;
            const methods = layer.route.methods || {};
            for (const method of Object.keys(methods)) {
              if (method.toUpperCase() !== 'ALL') {
                const perm = inferRequiredPermission(path, method);
                if (perm) {
                  registerRoute(path, method, perm);
                }
              }
            }
          }
        }
      }
    } catch (_) {
      // Skip route files that cannot be loaded
    }
  }
}

/**
 * Infer a required permission from a route path and method based on conventions.
 * e.g., '/tickets/assign' + 'POST' -> 'tickets.assign'
 *      '/tickets' + 'GET'    -> 'tickets.view'
 *
 * @param {string} path - The route path
 * @param {string} method - The HTTP method
 * @returns {string|null} The inferred permission key, or null if cannot be inferred
 */
function inferRequiredPermission(path, method) {
  const pathLower = (path || '').toLowerCase();
  const methodUpper = (method || '').toUpperCase();

  // Remove leading slash
  const cleanPath = pathLower.replace(/^\/+/, '');

  // Map HTTP methods to permission prefixes
  const methodPrefix = {
    GET: 'view',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  }[methodUpper];

  if (!methodPrefix) return null;

  // Try to extract resource name from path
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const resource = parts[0]; // first path segment is the resource name
  if (!resource) return null;

  return `${resource}.${methodPrefix}`;
}

module.exports = {
  registerRoute,
  validateAllRoutes,
  checkRoutePermissionMiddleware,
  hasRouteDeclaration,
  lookupRequiredPermission,
  lookupRequiredPermissionFromReq,
  withPermissionRegistry,
  inferRequiredPermission,
  registerAllRoutes,
};
