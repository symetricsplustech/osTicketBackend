const { Schema, model } = require('mongoose');
const ReleasePhaseSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  releaseId: { type: Schema.Types.ObjectId, ref: 'Release', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true },
  order: { type: Number, required: true },
  type: { type: String, enum: ['build', 'test', 'staging', 'deploy', 'validate', 'rollback', 'custom'], default: 'custom', index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled'], default: 'pending', index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  plannedStartDate: { type: Date },
  plannedEndDate: { type: Date },
  actualStartDate: { type: Date },
  actualEndDate: { type: Date },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  approverIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  approvalStatus: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required' },
  approvalRequired: { type: Boolean, default: false },
  gateCriteria: { type: String, trim: true, default: '' },
  gateResult: { type: String, enum: ['passed', 'failed', 'waived'], default: 'passed' },
  tasks: [{ type: Schema.Types.ObjectId, ref: 'ReleaseTask' }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleasePhaseSchema.index({ tenantId: 1, releaseId: 1, order: 1 });
ReleasePhaseSchema.index({ tenantId: 1, releaseId: 1, status: 1 });
module.exports = model('ReleasePhase', ReleasePhaseSchema);
