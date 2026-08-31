const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const handoverNoteSchema = new mongoose.Schema({
  shiftDate: Date, fromAgent: oid, toAgent: oid,
  pendingTickets: [String], risks: String, notes: String,
  acknowledged: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.HandoverNote || mongoose.model('HandoverNote', handoverNoteSchema);
