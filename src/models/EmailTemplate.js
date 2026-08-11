const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    context: { type: String, default: 'ticket' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);
emailTemplateSchema.index({ company: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
