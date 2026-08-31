const mongoose = require('mongoose');
const attachmentTextSchema = new mongoose.Schema({
  ticketNumber: { type: String, index: true }, filename: String,
  extractedText: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.AttachmentText || mongoose.model('AttachmentText', attachmentTextSchema);
