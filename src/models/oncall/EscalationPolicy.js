const { Schema, model } = require('mongoose');
const EscalationPolicySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true, index: true },
  isDefault: { type: Boolean, default: false },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  repeatAfterMinutes: { type: Number, default: 0 }, // 0 = no repeat
  maxRepeats: { type: Number, default: 3 },
  onCallOnly: { type: Boolean, default: true }, // only escalate if on-call
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
EscalationPolicySchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
module.exports = model('EscalationPolicy', EscalationPolicySchema);
