const { Schema, model } = require('mongoose');
const SLAConditionSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  slaPlanId: { type: Schema.Types.ObjectId, ref: 'SlaPlan', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 0 },
  conditions: [{ field: { type: String, required: true }, operator: { type: String, required: true, enum: ['equals', 'not_equals', 'in', 'not_in', 'contains', 'gt', 'lt', 'gte', 'lte'] }, value: { type: Schema.Types.Mixed } }],
  conditionGroups: [{ name: { type: String }, conditions: [{ field: { type: String, required: true }, operator: { type: String, required: true }, value: { type: Schema.Types.Mixed } }] }],
  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
SLAConditionSchema.index({ tenantId: 1, slaPlanId: 1, isActive: 1, isDeleted: 1 });
module.exports = model('SLACondition', SLAConditionSchema);
