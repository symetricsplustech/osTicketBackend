const mongoose = require('mongoose');

const PERMISSIONS = [
  'tickets.view',
  'tickets.create',
  'tickets.edit',
  'tickets.assign',
  'tickets.transfer',
  'tickets.close',
  'tickets.delete',
  'tickets.reply',
  'tickets.note',
  'tickets.tasks',
  'users.manage',
  'kb.manage',
  'canned.manage',
  'admin.manage',
  'orgs.manage',
  'escalations.manage',
  'organization.manage', 'organization.units.manage', 'organization.locations.manage',
  'access.manage', 'roles.manage', 'modules.manage', 'billing.view', 'billing.manage',
  'workflow.manage', 'integrations.manage', 'reports.manage', 'data.manage', 'audit.view',
  'approvals.decide', 'records.view', 'records.create', 'records.update', 'records.delete',
  'exports.create', 'security.manage',
];

const ROLE_CATEGORIES = ['platform', 'organization', 'administrative', 'module', 'operational', 'auditor'];
const ROLE_SCOPES = ['platform', 'tenant'];

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ROLE_SCOPES, default: 'tenant', immutable: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    // Explicit role-level DENYs (MD §22). No enum on purpose — deny keys
    // mirror permission keys and must never be silently dropped by validation.
    deniedPermissions: { type: [String], default: [] },
    category: { type: String, enum: ROLE_CATEGORIES, default: 'operational', index: true },
    moduleKeys: { type: [String], default: [] },
    recordScopes: { type: [String], enum: ['own', 'assigned', 'team', 'department', 'location', 'business_unit', 'organization'], default: ['own'] },
    fieldAccess: { type: [String], default: [] },
    approvalLimit: { type: Number, default: null, min: 0 },
    protected: { type: Boolean, default: false },
    assignableBy: { type: [String], default: [] },
    isAdmin: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

roleSchema.index({ company: 1, name: 1 }, { unique: true });

roleSchema.pre('validate', function validateRoleBoundary(next) {
  if (this.scope === 'platform') {
    if (this.company) return next(new Error('Platform roles cannot belong to a tenant'));
    if (this.category !== 'platform') return next(new Error('Platform roles must use the platform category'));
  } else {
    if (!this.company) return next(new Error('Tenant roles require a tenant company'));
    if (this.category === 'platform') return next(new Error('Tenant roles cannot use the platform category'));
  }
  next();
});

roleSchema.statics.PERMISSIONS = PERMISSIONS;
roleSchema.statics.ROLE_CATEGORIES = ROLE_CATEGORIES;
roleSchema.statics.ROLE_SCOPES = ROLE_SCOPES;

module.exports = mongoose.model('Role', roleSchema);
