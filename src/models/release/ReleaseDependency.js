const { Schema, model } = require('mongoose');
const ReleaseDependencySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  releaseId: { type: Schema.Types.ObjectId, ref: 'Release', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['release', 'change', 'ci', 'service', 'environment', 'external', 'manual'], default: 'release', index: true },
  dependencyType: { type: String, enum: ['blocks', 'is_blocked_by', 'requires', 'provides', 'conflicts_with', 'depends_on'], default: 'depends_on', index: true },
  targetReleaseId: { type: Schema.Types.ObjectId, ref: 'Release' },
  targetChangeId: { type: Schema.Types.ObjectId, ref: 'Change' },
  targetCiId: { type: Schema.Types.ObjectId, ref: 'ConfigurationItem' },
  targetServiceId: { type: Schema.Types.ObjectId, ref: 'BusinessService' },
  targetEnvironment: { type: String },
  description: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['pending', 'resolved', 'blocked', 'waived', 'cancelled'], default: 'pending', index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  resolutionNotes: { type: String, trim: true, default: '' },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleaseDependencySchema.index({ tenantId: 1, releaseId: 1, status: 1 });
ReleaseDependencySchema.index({ tenantId: 1, targetReleaseId: 1 });
ReleaseDependencySchema.index({ tenantId: 1, targetChangeId: 1 });
ReleaseDependencySchema.index({ tenantId: 1, targetCiId: 1 });
module.exports = model('ReleaseDependency', ReleaseDependencySchema);
