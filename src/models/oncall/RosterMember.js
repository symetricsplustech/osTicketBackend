const { Schema, model } = require('mongoose');
const RosterMemberSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  rosterId: { type: Schema.Types.ObjectId, ref: 'Roster', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['primary', 'secondary', 'backup', 'manager'], default: 'primary' },
  order: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
RosterMemberSchema.index({ tenantId: 1, rosterId: 1, userId: 1 });
module.exports = model('RosterMember', RosterMemberSchema);
