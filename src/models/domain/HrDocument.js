const mongoose = require('mongoose');
const hrDocumentSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['contract', 'id', 'certificate', 'evaluation', 'disciplinary', 'other'], required: true },
  filename: String,
  url: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  confidential: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.HrDocument || mongoose.model('HrDocument', hrDocumentSchema);
