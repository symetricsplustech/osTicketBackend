const mongoose = require('mongoose');
const moveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fromSpace: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' },
  toSpace: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' },
  requestedDate: Date,
  tasks: [{ task: String, done: Boolean }],
  status: { type: String, enum: ['requested', 'scheduled', 'completed', 'cancelled'], default: 'requested' },
  completedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.MoveRequest || mongoose.model('MoveRequest', moveRequestSchema);
