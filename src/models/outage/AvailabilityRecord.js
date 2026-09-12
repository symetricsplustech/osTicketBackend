const { Schema, model } = require('mongoose');
const AvailabilityRecordSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  entityType: { type: String, enum: ['business_service', 'technical_service', 'ci'], required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  granularity: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], default: 'hourly', index: true },
  totalMinutes: { type: Number, required: true, default: 0 },
  uptimeMinutes: { type: Number, required: true, default: 0 },
  downtimeMinutes: { type: Number, required: true, default: 0 },
  plannedDowntimeMinutes: { type: Number, default: 0 },
  unplannedDowntimeMinutes: { type: Number, default: 0 },
  availabilityPercentage: { type: Number, required: true, default: 100 },
  outageCount: { type: Number, default: 0 },
  incidentCount: { type: Number, default: 0 },
  outageIds: [{ type: Schema.Types.ObjectId }],
  incidentIds: [{ type: Schema.Types.ObjectId }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  calculatedAt: { type: Date, default: Date.now },
  calculatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
AvailabilityRecordSchema.index({ tenantId: 1, entityType: 1, entityId: 1, periodStart: -1 });
AvailabilityRecordSchema.index({ tenantId: 1, granularity: 1, periodStart: -1 });
module.exports = model('AvailabilityRecord', AvailabilityRecordSchema);
