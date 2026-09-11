const { Schema, model } = require('mongoose');
const AssignmentRuleSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true, index: true },
  priority: { type: Number, default: 0, index: true },
  conditions: {
    matchAll: { type: Boolean, default: true },
    rules: [{
      field: { type: String, required: true },
      operator: { type: String, required: true, enum: ['equals', 'not_equals', 'in', 'not_in', 'contains', 'gt', 'lt', 'gte', 'lte', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'] },
      value: { type: Schema.Types.Mixed },
    }],
  },
  actions: [{
    type: { type: String, required: true, enum: ['assign_agent', 'assign_group', 'set_priority', 'set_category', 'set_sla', 'add_tag', 'send_notification', 'escalate', 'require_approval'] },
    target: { type: String },
    value: { type: Schema.Types.Mixed },
  }],
  assignmentStrategy: { type: String, enum: ['round_robin', 'least_workload', 'skill_based', 'availability', 'manual'], default: 'round_robin' },
  targetGroups: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  targetAgents: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
  requiredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
  fallbackAction: { type: String, enum: ['notify_admin', 'queue', 'reject', 'escalate'], default: 'notify_admin' },
  hitCount: { type: Number, default: 0 },
  lastHitAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
AssignmentRuleSchema.index({ tenantId: 1, isActive: 1, priority: -1, isDeleted: 1 });
module.exports = model('AssignmentRule', AssignmentRuleSchema);
