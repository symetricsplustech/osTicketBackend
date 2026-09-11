const { Schema, model } = require('mongoose');
const AgentCapacitySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  maxCapacity: { type: Number, required: true, min: 0, default: 10 },
  currentLoad: { type: Number, default: 0, min: 0 },
  utilizationPercent: { type: Number, default: 0 },
  assignedTickets: { type: Number, default: 0 },
  inProgressTickets: { type: Number, default: 0 },
  pendingTickets: { type: Number, default: 0 },
  overdueTickets: { type: Number, default: 0 },
  completedToday: { type: Number, default: 0 },
  completedThisWeek: { type: Number, default: 0 },
  averageHandleTimeMinutes: { type: Number, default: 0 },
  isOverloaded: { type: Boolean, default: false },
  lastCalculatedAt: { type: Date, default: Date.now },
  effectiveFrom: { type: Date, default: Date.now },
  effectiveUntil: { type: Date },
  overrides: {
    startDate: { type: Date },
    endDate: { type: Date },
    maxCapacity: { type: Number },
    reason: { type: String },
  },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
AgentCapacitySchema.index({ tenantId: 1, agentId: 1, lastCalculatedAt: -1 });
module.exports = model('AgentCapacity', AgentCapacitySchema);
