const mongoose = require('mongoose');
const sourcingEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  eventType: { type: String, enum: ['RFI', 'RFP', 'RFQ'], default: 'RFP' },
  suppliersInvited: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
  responses: [{ supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }, receivedAt: Date, sealed: Boolean, scores: { technical: Number, commercial: Number } }],
  weightedCriteria: [{ criterion: String, weightPct: Number }],
  awardTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  status: { type: String, enum: ['draft', 'issued', 'responses_open', 'evaluation', 'awarded', 'cancelled'], default: 'draft' },
  savingsEstimate: Number,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SourcingEvent || mongoose.model('SourcingEvent', sourcingEventSchema);
