const mongoose = require('mongoose');
const onboardingChecklistSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  tasks: [{ title: String, assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }, status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }, dueDate: Date, completedAt: Date, notes: String }],
  completedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.OnboardingChecklist || mongoose.model('OnboardingChecklist', onboardingChecklistSchema);
