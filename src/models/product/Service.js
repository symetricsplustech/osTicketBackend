const mongoose = require('mongoose');
const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  category: { type: String, enum: ['it', 'business', 'external', 'internal'], default: 'it' },
  status: { type: String, enum: ['active', 'inactive', 'deprecated'], default: 'active' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan' },
  businessHours: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String },
  },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  cost: { type: Number, default: 0 },
  metadata: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
serviceSchema.index({ name: 'text', description: 'text' });
module.exports = mongoose.models.Service || mongoose.model('Service', serviceSchema);
