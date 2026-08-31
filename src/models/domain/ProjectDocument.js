const mongoose = require('mongoose');
const projectDocumentSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  filename: String,
  url: String,
  type: { type: String, enum: ['document', 'image', 'spreadsheet', 'presentation', 'other'], default: 'document' },
  size: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ProjectDocument || mongoose.model('ProjectDocument', projectDocumentSchema);
