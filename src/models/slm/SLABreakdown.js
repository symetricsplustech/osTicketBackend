const { Schema, model } = require('mongoose');
const SLABreakdownSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  slaEventId: { type: Schema.Types.ObjectId, ref: 'SlaEvent', required: true, index: true },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
  slaPlanId: { type: Schema.Types.ObjectId, ref: 'SlaPlan', required: true },
  phase: { type: String, enum: ['active', 'paused', 'waiting_customer', 'pending_approval', 'pending_vendor', 'on_hold'], required: true, index: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date },
  durationMs: { type: Number, default: 0 },
  pauseReason: { type: String },
  resumedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  businessDurationMs: { type: Number, default: 0 },
  calendarDurationMs: { type: Number, default: 0 },
  meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
SLABreakdownSchema.index({ tenantId: 1, ticketId: 1, slaEventId: 1 });
module.exports = model('SLABreakdown', SLABreakdownSchema);
