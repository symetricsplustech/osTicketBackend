const mongoose = require('mongoose');

const hrCaseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['leave', 'payroll', 'benefits', 'onboarding', 'offboarding', 'grievance', 'policy', 'training', 'other'], required: true },
    status: { type: String, enum: ['open', 'in_progress', 'pending_approval', 'resolved', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    confidential: { type: Boolean, default: false },
    thread: [{
      author: { type: mongoose.Schema.Types.ObjectId, refPath: 'threadAuthorModel' },
      authorModel: { type: String, enum: ['Agent', 'User'], default: 'User' },
      content: { type: String, required: true },
      attachments: { type: [String], default: [] },
      isInternal: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    }],
    resolution: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

hrCaseSchema.index({ company: 1, status: 1 });
hrCaseSchema.index({ company: 1, employee: 1 });
hrCaseSchema.index({ number: 1 });

module.exports = mongoose.model('HrCase', hrCaseSchema);
