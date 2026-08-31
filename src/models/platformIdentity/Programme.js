const mongoose = require('mongoose');
const programmeSchema = new mongoose.Schema({
  portfolio: mongoose.Schema.Types.ObjectId,
  name: { type: String, required: true },
  projects: [mongoose.Schema.Types.ObjectId],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Programme || mongoose.model('Programme', programmeSchema);
