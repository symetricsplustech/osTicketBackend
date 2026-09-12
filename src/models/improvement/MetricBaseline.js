const { Schema, model } = require('mongoose');
const MetricBaselineSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'ImprovementGoal', index: true },
  number: { type: String, required: true, unique: true },
  metricName: { type: String, required: true, trim: true },
  metricCategory: { type: String, enum: ['performance', 'quality', 'cost', 'customer_satisfaction', 'efficiency', 'availability', 'capacity', 'security', 'compliance', 'other'], default: 'performance', index: true },
  metricUnit: { type: String, required: true, trim: true },
  baselineValue: { type: Number, required: true },
  baselineDate: { type: Date, required: true },
  measurementMethod: { type: String, required: true, trim: true },
  dataSource: { type: String, required: true, trim: true },
  sampleSize: { type: Number },
  confidenceLevel: { type: Number },
  isActive: { type: Boolean, default: true, index: true },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
MetricBaselineSchema.index({ tenantId: 1, metricName: 1, isActive: 1, isDeleted: 1 });
MetricBaselineSchema.index({ tenantId: 1, initiativeId: 1, isActive: 1 });
module.exports = model('MetricBaseline', MetricBaselineSchema);
