const mongoose = require('mongoose');
const complaintSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  category: { type: String, enum: ['product', 'service', 'billing', 'delivery', 'quality', 'other'], default: 'other' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'closed', 'escalated'], default: 'open' },
  subject: String,
  description: String,
  rootCause: String,
  resolution: String,
  sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan' },
  dueAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  satisfaction: { type: Number, min: 1, max: 5 },
  feedback: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  attachments: [{ filename: String, url: String, uploadedAt: Date }],
  thread: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    message: String,
    createdAt: { type: Date, default: Date.now },
  }],
  metadata: mongoose.Schema.Types.Mixed,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
complaintSchema.index({ customer: 1 });
complaintSchema.index({ status: 1 });
module.exports = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
