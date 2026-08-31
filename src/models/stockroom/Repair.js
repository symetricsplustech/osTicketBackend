const mongoose = require('mongoose');
const repairSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  type: { type: String, enum: ['warranty', 'repair', 'maintenance', 'upgrade', 'replacement'], default: 'repair' },
  status: { type: String, enum: ['reported', 'in_progress', 'completed', 'cancelled'], default: 'reported' },
  reportedDate: { type: Date, default: Date.now },
  completedDate: Date,
  description: String,
  partsUsed: [{ name: String, quantity: Number, cost: Number }],
  laborHours: { type: Number, default: 0 },
  laborCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  vendor: String,
  warranty: { type: Boolean, default: false },
  warrantyExpiry: Date,
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
repairSchema.index({ asset: 1 });
module.exports = mongoose.models.Repair || mongoose.model('Repair', repairSchema);
