const mongoose = require('mongoose');
const erpConnectionSchema = new mongoose.Schema({
  system: { type: String, enum: ['netsuite', 'sap', 'quickbooks', 'xero', 'custom'], required: true },
  apiUrl: String, apiKeyMasked: String,
  status: { type: String, enum: ['unconfigured', 'connected', 'error'], default: 'unconfigured' },
  pushes: [{ invoice: mongoose.Schema.Types.ObjectId, erpRef: String, ok: Boolean, at: Date }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ErpConnection || mongoose.model('ErpConnection', erpConnectionSchema);
