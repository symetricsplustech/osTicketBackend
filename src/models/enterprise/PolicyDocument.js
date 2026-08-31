const mongoose = require('mongoose');
const policyDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  version: { type: String, default: '1.0' },
  category: String,
  content: String,
  status: { type: String, enum: ['draft', 'in_review', 'approved', 'published', 'retired'], default: 'draft' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  publishedAt: Date,
  nextReviewDate: Date,
  acknowledgements: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, acknowledgedAt: Date }],
  controls: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Control' }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PolicyDocument || mongoose.model('PolicyDocument', policyDocumentSchema);
