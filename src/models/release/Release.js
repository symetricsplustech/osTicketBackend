const { Schema, model } = require('mongoose');
const ReleaseSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['major', 'minor', 'patch', 'hotfix', 'emergency', 'maintenance'], default: 'minor', index: true },
  status: { type: String, enum: ['planning', 'build', 'test', 'ready', 'deploying', 'completed', 'failed', 'cancelled'], default: 'planning', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  version: { type: String, required: true },
  previousVersion: { type: String },
  environment: { type: String, enum: ['development', 'test', 'staging', 'production', 'dr'], default: 'production' },
  startDate: { type: Date },
  endDate: { type: Date },
  plannedStartDate: { type: Date },
  plannedEndDate: { type: Date },
  actualStartDate: { type: Date },
  actualEndDate: { type: Date },
  releaseManagerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  releaseCoordinatorId: { type: Schema.Types.ObjectId, ref: 'User' },
  approvalGroupId: { type: Schema.Types.ObjectId, ref: 'Team' },
  isActive: { type: Boolean, default: true },
  isRollback: { type: Boolean, default: false },
  rollbackReleaseId: { type: Schema.Types.ObjectId, ref: 'Release' },
  rollbackReason: { type: String, trim: true, default: '' },
  rolloutStrategy: { type: String, enum: ['big_bang', 'phased', 'canary', 'blue_green', 'rolling'], default: 'phased' },
  rolloutPercentage: { type: Number, default: 100 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleaseSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
ReleaseSchema.index({ tenantId: 1, version: 1 });
ReleaseSchema.index({ tenantId: 1, releaseManagerId: 1 });
module.exports = model('Release', ReleaseSchema);
