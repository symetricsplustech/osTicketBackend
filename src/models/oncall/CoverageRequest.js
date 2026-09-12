const { Schema, model } = require('mongoose');
const CoverageRequestSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  scheduleId: { type: Schema.Types.ObjectId, ref: 'OnCallSchedule', required: true, index: true },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['swap', 'cover', 'trade'], default: 'cover' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'], default: 'pending', index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String, trim: true, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CoverageRequestSchema.index({ tenantId: 1, shiftId: 1, status: 1 });
CoverageRequestSchema.index({ tenantId: 1, requesterId: 1, status: 1 });
module.exports = model('CoverageRequest', CoverageRequestSchema);
