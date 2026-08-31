const mongoose = require('mongoose');
const invitationSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  role: { type: String, enum: ['client', 'agent', 'admin'], default: 'client' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  modules: [String],
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired', 'cancelled'], default: 'pending' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
invitationSchema.index({ status: 1 });
module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
