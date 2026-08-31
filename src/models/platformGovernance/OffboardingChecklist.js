const mongoose = require('mongoose');
const offboardingChecklistSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastWorkingDate: Date,
  reason: { type: String, enum: ['resignation', 'termination', 'retirement', 'contract_end'], default: 'resignation' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  tasks: [{ title: String, category: { type: String, enum: ['access_revocation', 'equipment_return', 'knowledge_transfer', 'payroll', 'other'] }, assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }, completedAt: Date }],
  completedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.OffboardingChecklist || mongoose.model('OffboardingChecklist', offboardingChecklistSchema);
