const mongoose = require('mongoose');
const draftAutosaveSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId, contextKey: { type: String, required: true },
  content: String, updatedAt: { type: Date, default: Date.now },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
draftAutosaveSchema.index({ user: 1, contextKey: 1 }, { unique: true });
module.exports = mongoose.models.DraftAutosave || mongoose.model('DraftAutosave', draftAutosaveSchema);
