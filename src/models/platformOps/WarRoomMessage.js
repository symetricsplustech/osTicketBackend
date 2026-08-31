const mongoose = require('mongoose');
const warRoomMessageSchema = new mongoose.Schema({
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  authorName: String,
  message: { type: String, required: true },
  kind: { type: String, enum: ['chat', 'status', 'decision', 'action_item'], default: 'chat' },
  resolved: Boolean,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.WarRoomMessage || mongoose.model('WarRoomMessage', warRoomMessageSchema);
