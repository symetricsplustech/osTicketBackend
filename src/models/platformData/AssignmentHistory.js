const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const assignmentHistorySchema = new mongoose.Schema({
  ticketNumber: { type: String, index: true },
  fromAgent: oid, toAgent: oid, strategy: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AssignmentHistory || mongoose.model('AssignmentHistory', assignmentHistorySchema);
