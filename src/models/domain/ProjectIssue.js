const mongoose = require('mongoose');
const projectIssueSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  number: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['bug', 'feature', 'improvement', 'task'], default: 'bug' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: Date,
  resolvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ProjectIssue || mongoose.model('ProjectIssue', projectIssueSchema);
