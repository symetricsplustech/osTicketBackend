const { Schema, model } = require('mongoose');
const CostSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative', required: true, index: true },
  number: { type: String, required: true, unique: true },
  category: { type: String, enum: ['labor', 'technology', 'training', 'consulting', 'materials', 'licenses', 'infrastructure', 'cloud', 'travel', 'other'], required: true, index: true },
  description: { type: String, trim: true, default: '' },
  plannedAmount: { type: Number, required: true },
  actualAmount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  incurredAt: { type: Date },
  paidAt: { type: Date },
  status: { type: String, enum: ['planned', 'committed', 'incurred', 'paid', 'cancelled'], default: 'planned', index: true },
  vendor: { type: String, trim: true, default: '' },
  invoiceNumber: { type: String, trim: true, default: '' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  isRecurring: { type: Boolean, default: false },
  recurringPeriod: { type: String, enum: ['monthly', 'quarterly', 'annual'] },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
CostSchema.index({ tenantId: 1, initiativeId: 1, category: 1, status: 1, isDeleted: 1 });
module.exports = model('Cost', CostSchema);
