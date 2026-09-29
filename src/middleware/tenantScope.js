/**
 * Tenant Scope — request-scoped tenant isolation via AsyncLocalStorage.
 *
 * Every PostgreSQL repository automatically reads the current tenant
 * from this context and injects the appropriate WHERE clause.
 */

const { AsyncLocalStorage } = require("async_hooks");

const tenantContext = new AsyncLocalStorage();

const getTenantId = () => tenantContext.getStore()?.tenantId || null;

const runWithTenant = (tenantId, callback) =>
  tenantContext.run({ tenantId: tenantId ? String(tenantId) : null }, callback);

module.exports = { getTenantId, runWithTenant };
