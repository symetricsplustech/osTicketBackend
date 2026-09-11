const mongoose = require('mongoose');

const userRoleSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

userRoleSchema.index({ tenantId: 1, userId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('UserRole', userRoleSchema);
