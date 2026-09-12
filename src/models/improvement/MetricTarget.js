const { Schema, model } = require('mongoose');
const MetricTargetSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', required: true, index: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'ImprovementGoal', index: true },
  number: { type: String, required: true, unique: true },
  metricName: { type: String, required: true, trim: true },
  metricCategory: { type: String, enum: ['performance', 'quality', 'cost', 'customer_satisfaction', 'efficiency', 'availability', 'capacity', 'security', 'compliance', 'other'], default: 'performance', index: true },
  metricUnit: { type: String, required: true, trim: true },
  targetValue: { type: Number, required: true },
  currentValue: { type: Number },
  targetDate: { type: Date, required: true },
  baselineId: { type: Schema.Types.ObjectId, ref: 'MetricBaseline' },
  baselineValue: { type: Number },
  improvementPercentage: { type: Number },
  measurementFrequency: { type: String, enum: ['real_time', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'on_demand'], default: 'monthly' },
  lastMeasuredAt: { type: Date },
  lastMeasuredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  dataSource: { type: String },
  status: { type: String, enum: ['active', 'at_risk', 'off_track', 'achieved', 'missed', 'cancelled'], default: 'active', index: true },
  achievedAt: { type: Date },
  trend: { type: String, enum: ['improving', 'stable', 'declining', 'unknown'], default: 'unknown' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
MetricTargetSchema.index({ tenantId: 1, initiativeId: 1, status: 1, isDeleted: 1 });
MetricTargetSchema.index({ tenantId: 1, metricName: 1, targetDate: 1 });
module.exports = model('MetricTarget', MetricTargetSchema);
