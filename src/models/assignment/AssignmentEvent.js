const { Schema, model } = require('mongoose');
const AssignmentEventSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  ticketNumber: { type: String, required: true, index: true },
  eventType: { type: String, enum: ['assign', 'reassign', 'unassign', 'claim', 'transfer', 'escalate', 'auto_assign', 'overflow', 'decline', 'accept', 'timeout'], required: true, index: true },
  fromAgent: { type: Schema.Types.ObjectId, ref: 'Agent' },
  toAgent: { type: Schema.Types.ObjectId, ref: 'Agent' },
  fromGroup: { type: Schema.Types.ObjectId, ref: 'Team' },
  toGroup: { type: Schema.Types.ObjectId, ref: 'Team' },
  fromQueue: { type: Schema.Types.ObjectId, ref: 'Queue' },
  toQueue: { type: Schema.Types.ObjectId, ref: 'Queue' },
  reason: { type: String, trim: true, default: '' },
  method: { type: String, enum: ['manual', 'auto', 'rule', 'escalation', 'overflow', 'skill_match', 'round_robin', 'least_workload'], default: 'manual' },
  ruleId: { type: Schema.Types.ObjectId, ref: 'RoutingRule' },
  slaImpact: { type: String, enum: ['none', 'reset', 'continue', 'pause'], default: 'continue' },
  duration: { type: Number },
  metadata: { type: Schema.Types.Mixed, default: {} },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  correlationId: { type: String, index: true },
}, { timestamps: true });
AssignmentEventSchema.index({ tenantId: 1, ticketId: 1, createdAt: -1 });
AssignmentEventSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
module.exports = model('AssignmentEvent', AssignmentEventSchema);
