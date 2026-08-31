const mongoose = require('mongoose');
const preventiveMaintenanceSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  name: { type: String, required: true },
  description: String,
  frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'], required: true },
  nextDue: { type: Date, required: true },
  lastCompleted: Date,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  checklist: [String],
  estimatedMinutes: Number,
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.PreventiveMaintenance || mongoose.model('PreventiveMaintenance', preventiveMaintenanceSchema);
