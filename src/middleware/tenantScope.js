const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

// The authenticated tenant is kept request-local, so model code cannot
// accidentally lose its tenant predicate when a controller omits one.
const tenantContext = new AsyncLocalStorage();
const QUERY_HOOKS = [
  'countDocuments', 'deleteMany', 'deleteOne', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate',
  'replaceOne', 'updateMany', 'updateOne',
];

const getTenantId = () => tenantContext.getStore()?.tenantId || null;
const runWithTenant = (tenantId, callback) => tenantContext.run(
  { tenantId: String(tenantId) },
  callback
);

const tenantScopePlugin = (schema) => {
  // Models which do not contain a tenant key are global reference data and are
  // intentionally left alone. Tenant-bearing records are fail-closed to the
  // request tenant whenever a tenant context exists.
  const field = schema.path('tenantId') ? 'tenantId' : (schema.path('company') ? 'company' : null);
  if (!field) return;

  const applyQueryScope = function applyQueryScope(next) {
    const tenantId = getTenantId();
    if (tenantId) this.where({ [field]: tenantId });
    next();
  };

  for (const hook of QUERY_HOOKS) schema.pre(hook, applyQueryScope);

  schema.pre('aggregate', function applyAggregateScope(next) {
    const tenantId = getTenantId();
    if (tenantId) {
      const match = { $match: { [field]: new mongoose.Types.ObjectId(tenantId) } };
      const pipeline = this.pipeline();
      pipeline[0]?.$geoNear ? pipeline.splice(1, 0, match) : pipeline.unshift(match);
    }
    next();
  });

  schema.pre('save', function applyDocumentScope(next) {
    const tenantId = getTenantId();
    if (!tenantId) return next();
    if (this[field] && String(this[field]) !== tenantId) {
      return next(new Error('Tenant scope violation'));
    }
    this[field] = tenantId;
    next();
  });
};

mongoose.plugin(tenantScopePlugin);

module.exports = { getTenantId, runWithTenant };
