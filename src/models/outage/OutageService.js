const { Schema, model } = require('mongoose');
const OutageServiceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  outageId: { type: Schema.Types.ObjectId, ref: 'Outage', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'BusinessService', required: true, index: true },
  technicalServiceId: { type: Schema.Types.ObjectId, ref: 'TechnicalService' },
  role: { type: String, enum: ['primary', 'supporting', 'dependent', 'customer_facing'], default: 'primary' },
  impact: { type: String, enum: ['none', 'degraded', 'partial', 'complete'], default: 'degraded' },
  slaBreached: { type: Boolean, default: false },
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  restoredAt: { type: Date },
  restoredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });
OutageServiceSchema.index({ tenantId: 1, outageId: 1, serviceId: 1 }, { unique: true });
OutageServiceSchema.index({ tenantId: 1, serviceId: 1 });
module.exports = model('OutageService', OutageServiceSchema);
