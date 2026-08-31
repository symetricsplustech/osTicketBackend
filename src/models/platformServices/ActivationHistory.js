const mongoose = require('mongoose');
const activationHistorySchema = new mongoose.Schema({
  moduleKey: String, action: { type: String, enum: ['activated', 'deactivated', 'reactivated'] },
  by: mongoose.Schema.Types.ObjectId, detail: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ActivationHistory || mongoose.model('ActivationHistory', activationHistorySchema);
