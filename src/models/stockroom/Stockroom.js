const mongoose = require('mongoose');
const stockroomSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  location: String,
  address: String,
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  description: String,
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Stockroom || mongoose.model('Stockroom', stockroomSchema);
