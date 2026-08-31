const mongoose = require('mongoose');
const recurringRequestSchema = new mongoose.Schema({
  catalogItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCatalogItem' },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'], required: true },
  nextRun: { type: Date, required: true },
  lastRun: Date,
  status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
  formData: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RecurringRequest || mongoose.model('RecurringRequest', recurringRequestSchema);
