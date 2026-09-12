const { Schema, model } = require('mongoose');
const OutageCISchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  outageId: { type: Schema.Types.ObjectId, ref: 'Outage', required: true, index: true },
  ciId: { type: Schema.Types.ObjectId, ref: 'ConfigurationItem', required: true, index: true },
  role: { type: String, enum: ['primary', 'affected', 'related', 'dependency', 'root_cause'], default: 'affected' },
  impact: { type: String, enum: ['none', 'degraded', 'partial', 'complete'], default: 'degraded' },
  addedAt: { type: Date, default: Date.now },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  removedAt: { type: Date },
  removedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });
OutageCISchema.index({ tenantId: 1, outageId: 1, ciId: 1 }, { unique: true });
OutageCISchema.index({ tenantId: 1, ciId: 1 });
module.exports = model('OutageCI', OutageCISchema);
