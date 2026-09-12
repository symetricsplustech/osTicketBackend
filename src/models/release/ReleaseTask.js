const { Schema, model } = require('mongoose');
const ReleaseTaskSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  releaseId: { type: Schema.Types.ObjectId, ref: 'Release', required: true, index: true },
  phaseId: { type: Schema.Types.ObjectId, ref: 'ReleasePhase', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['build', 'test', 'deploy', 'validation', 'configuration', 'documentation', 'approval', 'communication', 'rollback', 'custom'], default: 'custom', index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled', 'blocked'], default: 'pending', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  plannedStartDate: { type: Date },
  plannedEndDate: { type: Date },
  actualStartDate: { type: Date },
  actualEndDate: { type: Date },
  estimatedDuration: { type: Number, default: 0 },
  actualDuration: { type: Number, default: 0 },
  dependencies: [{ taskId: { type: Schema.Types.ObjectId, ref: 'ReleaseTask' }, type: { type: String, enum: ['blocks', 'is_blocked_by', 'relates_to', 'duplicates'], default: 'blocks' } }],
  isAutomated: { type: Boolean, default: false },
  automationScript: { type: String, trim: true, default: '' },
  automationParams: { type: Schema.Types.Mixed, default: {} },
  scriptOutput: { type: String, trim: true, default: '' },
  scriptExitCode: { type: Number },
  rollbackTaskId: { type: Schema.Types.ObjectId, ref: 'ReleaseTask' },
  isRollbackTask: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleaseTaskSchema.index({ tenantId: 1, releaseId: 1, status: 1 });
ReleaseTaskSchema.index({ tenantId: 1, phaseId: 1, status: 1 });
ReleaseTaskSchema.index({ tenantId: 1, assigneeId: 1, status: 1 });
module.exports = model('ReleaseTask', ReleaseTaskSchema);
