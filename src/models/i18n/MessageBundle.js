const mongoose = require('mongoose');
const messageBundleSchema = new mongoose.Schema(
  {
    locale: { type: String, required: true, index: true }, // 'en', 'ar', ...
    namespace: { type: String, default: 'common' }, // 'common', 'helpdesk', 'crm', ...
    key: { type: String, required: true }, // e.g. 'ticket.create.success'
    value: { type: String, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);
messageBundleSchema.index({ locale: 1, namespace: 1, key: 1 }, { unique: true });
module.exports = mongoose.models.MessageBundle || mongoose.model('MessageBundle', messageBundleSchema);
