const mongoose = require('mongoose');
const documentRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['employment_letter', 'salary_certificate', 'experience_letter', ' noc', 'other'], required: true },
  purpose: String,
  status: { type: String, enum: ['pending', 'processing', 'ready', 'delivered', 'rejected'], default: 'pending' },
  deliveredAt: Date,
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DocumentRequest || mongoose.model('DocumentRequest', documentRequestSchema);
