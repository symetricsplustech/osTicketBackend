const mongoose = require('mongoose');
const continuityPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  scope: String,
  rtoHours: Number,
  rpoHours: Number,
  dependencies: [String],
  procedures: [{ step: Number, action: String, owner: String }],
  lastTestedAt: Date,
  testResult: String,
  gapsIdentified: [String],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ContinuityPlan || mongoose.model('ContinuityPlan', continuityPlanSchema);
