const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    budget: { type: Number, default: 0 },
    spent: { type: Number, default: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

projectSchema.index({ company: 1, status: 1 });
projectSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Project', projectSchema);
