const { Schema, model } = require('mongoose');
const ImprovementGoalSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', required: true, index: true },
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  metricName: { type: String, required: true, trim: true },
  metricUnit: { type: String, required: true, trim: true },
  baselineValue: { type: Number, required: true },
  targetValue: { type: Number, required: true },
  currentValue: { type: Number },
  targetDate: { type: Date },
  achievedDate: { type: Date },
  status: { type: String, enum: ['planned', 'in_progress', 'at_risk', 'achieved', 'missed', 'abandoned'], default: 'planned', index: true },
  direction: { type: String, enum: ['increase', 'decrease', 'maintain'], default: 'increase' },
  threshold: {
    warning: { type: Number },
    critical: { type: Number },
  },
  measurementFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'on_demand'], default: 'monthly' },
  lastMeasuredAt: { type: Date },
  lastMeasuredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  measurementSource: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ImprovementGoalSchema.index({ tenantId: 1, initiativeId: 1, status: 1 });
ImprovementGoalSchema.index({ tenantId: 1, metricName: 1 });
module.exports = model('ImprovementGoal', ImprovementGoalSchema);
