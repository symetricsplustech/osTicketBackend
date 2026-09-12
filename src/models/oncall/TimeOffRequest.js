const { Schema, model } = require('mongoose');
const TimeOffRequestSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  scheduleId: { type: Schema.Types.ObjectId, ref: 'OnCallSchedule', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String, trim: true, default: '' },
  affectedShifts: [{ type: Schema.Types.ObjectId, ref: 'Shift' }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
TimeOffRequestSchema.index({ tenantId: 1, scheduleId: 1, userId: 1, status: 1 });
module.exports = model('TimeOffRequest', TimeOffRequestSchema);
