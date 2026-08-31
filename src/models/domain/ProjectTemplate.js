const mongoose = require('mongoose');
const projectTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  category: String,
  tasks: [{ title: String, description: String, estimatedHours: Number, order: Number, assigneeRole: String }],
  milestones: [{ name: String, order: Number, estimatedDays: Number }],
  estimatedDuration: Number,
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
  useCount: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.ProjectTemplate || mongoose.model('ProjectTemplate', projectTemplateSchema);
