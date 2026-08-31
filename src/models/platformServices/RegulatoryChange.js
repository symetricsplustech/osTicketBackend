const mongoose = require('mongoose');
const regulatoryChangeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  authority: String, jurisdiction: String,
  effectiveDate: Date, summary: String,
  impactedControls: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Control' }],
  reviewStatus: { type: String, enum: ['new', 'assessed', 'actioned'], default: 'new' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RegulatoryChange || mongoose.model('RegulatoryChange', regulatoryChangeSchema);
