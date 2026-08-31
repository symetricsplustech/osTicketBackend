const mongoose = require('mongoose');
const mentionSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['ticket', 'note', 'comment'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mentionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  mentionedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  read: { type: Boolean, default: false },
  readAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Mention || mongoose.model('Mention', mentionSchema);
