const mongoose = require('mongoose');
const crisisEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  severity: { type: String, enum: ['minor', 'serious', 'critical'], default: 'serious' },
  continuityPlan: mongoose.Schema.Types.ObjectId,
  activatedAt: Date, stoodDownAt: Date,
  actions: [{ at: Date, action: String, by: String }],
  comms: [{ audience: String, message: String, at: Date }],
  status: { type: String, enum: ['active', 'stood_down'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CrisisEvent || mongoose.model('CrisisEvent', crisisEventSchema);
