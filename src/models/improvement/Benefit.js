const { Schema, model } = require('mongoose');
const BenefitSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', required: true, index: true },
  number: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['financial', 'efficiency', 'quality', 'customer_satisfaction', 'risk_reduction', 'compliance', 'employee_satisfaction', 'revenue', 'cost_avoidance', 'time_savings', 'other'], default: 'financial', index: true },
  estimatedValue: { type: Number, required: true },
  actualValue: { type: Number },
  unit: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  realizationDate: { type: Date },
  isRecurring: { type: Boolean, default: false },
  recurringPeriod: { type: String, enum: ['monthly', 'quarterly', 'annual'] },
  status: { type: String, enum: ['estimated', 'validated', 'realized', 'not_realized', 'disputed'], default: 'estimated', index: true },
  validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  validatedAt: { type: Date },
  realizationMethod: { type: String, trim: true, default: '' },
  assumptions: { type: String, trim: true, default: '' },
  dependencies: [{ type: Schema.Types.ObjectId, ref: 'Benefit' }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
BenefitSchema.index({ tenantId: 1, initiativeId: 1, type: 1, status: 1, isDeleted: 1 });
module.exports = model('Benefit', BenefitSchema);
