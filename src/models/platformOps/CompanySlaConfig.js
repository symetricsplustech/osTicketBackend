const mongoose = require('mongoose');
const companySlaConfigSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', required: true },
  priorityOverrides: [{ ticketPriority: String, sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan' } }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
companySlaConfigSchema.index({ company: 1 }, { unique: true });
module.exports = mongoose.models.CompanySlaConfig || mongoose.model('CompanySlaConfig', companySlaConfigSchema);
