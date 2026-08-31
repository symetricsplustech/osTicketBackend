const mongoose = require('mongoose');
const maintenanceWindowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  resources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
  suppressAlerts: { type: Boolean, default: true },
  status: { type: String, enum: ['scheduled', 'active', 'completed', 'cancelled'], default: 'scheduled' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.MaintenanceWindow || mongoose.model('MaintenanceWindow', maintenanceWindowSchema);
