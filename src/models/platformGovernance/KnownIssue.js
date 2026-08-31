const mongoose = require('mongoose');
const knownIssueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  affectedServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  affectedCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
  workaround: String,
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  notifyCustomers: { type: Boolean, default: false },
  notifiedCount: { type: Number, default: 0 },
  resolvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.KnownIssue || mongoose.model('KnownIssue', knownIssueSchema);
