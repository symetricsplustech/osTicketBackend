const { Schema, model } = require('mongoose');
const RoutingRuleSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true, index: true },
  priority: { type: Number, default: 0, index: true },
  source: { type: String, enum: ['email', 'phone', 'web', 'chat', 'api', 'social', 'all'], default: 'all' },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  conditions: {
    matchAll: { type: Boolean, default: true },
    rules: [{
      field: { type: String, required: true },
      operator: { type: String, required: true },
      value: { type: Schema.Types.Mixed },
    }],
  },
  targetQueue: { type: Schema.Types.ObjectId, ref: 'Queue' },
  targetGroup: { type: Schema.Types.ObjectId, ref: 'Team' },
  targetAgent: { type: Schema.Types.ObjectId, ref: 'Agent' },
  routingMethod: { type: String, enum: ['queue', 'group', 'agent', 'skill_based', 'round_robin', 'least_workload', 'manual'], default: 'queue' },
  requiredSkills: [{ type: Schema.Types.ObjectId, ref: 'Skill' }],
  fallbackQueue: { type: Schema.Types.ObjectId, ref: 'Queue' },
  fallbackGroup: { type: Schema.Types.ObjectId, ref: 'Team' },
  autoAssign: { type: Boolean, default: false },
  notifyOnAssign: { type: Boolean, default: true },
  hitCount: { type: Number, default: 0 },
  lastHitAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
RoutingRuleSchema.index({ tenantId: 1, isActive: 1, priority: -1, isDeleted: 1 });
module.exports = model('RoutingRule', RoutingRuleSchema);
