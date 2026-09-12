const { Schema, model } = require('mongoose');
const ImprovementTaskSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', required: true, index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'ImprovementGoal' },
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['analysis', 'design', 'development', 'testing', 'deployment', 'training', 'documentation', 'review', 'approval', 'data_collection', 'other'], default: 'other' },
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
  dependencies: [{ taskId: { type: Schema.Types.ObjectId, ref: 'ImprovementTask' }, type: { type: String, enum: ['blocks', 'is_blocked_by', 'relates_to'], default: 'blocks' } }],
  deliverables: [{
    name: { type: String },
    description: { type: String },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'accepted', 'rejected'], default: 'pending' },
    dueDate: { type: Date },
    completedAt: { type: Date },
  }],
  notes: { type: String, trim: true, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ImprovementTaskSchema.index({ tenantId: 1, initiativeId: 1, status: 1 });
ImprovementTaskSchema.index({ tenantId: 1, assigneeId: 1, status: 1 });
module.exports = model('ImprovementTask', ImprovementTaskSchema);
