const mongoose = require('mongoose');
const contractorAssignmentSchema = new mongoose.Schema({
  contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
  accepted: Boolean, performanceScore: Number,
  completedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ContractorAssignment || mongoose.model('ContractorAssignment', contractorAssignmentSchema);
