const mongoose = require('mongoose');

const projectTaskSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    milestone: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', default: null },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['todo', 'in_progress', 'review', 'done', 'blocked'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    estimatedHours: { type: Number, default: 0 },
    loggedHours: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' }],
    tags: { type: [String], default: [] },
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' }],
    attachments: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

projectTaskSchema.index({ project: 1, status: 1 });
projectTaskSchema.index({ project: 1, assignedTo: 1 });
projectTaskSchema.index({ title: 'text' });

module.exports = mongoose.model('ProjectTask', projectTaskSchema);
