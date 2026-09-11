const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['normal', 'standard', 'emergency', 'registration'], default: 'normal' },
    model: { type: mongoose.Schema.Types.ObjectId, ref: 'ChangeModel', default: null },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'StandardChangeTemplate', default: null },
    risk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    riskScore: { type: Number, default: 0 },
    impact: { type: String, enum: ['1', '2', '3', '4'], default: '3' },
    urgency: { type: String, enum: ['1', '2', '3', '4'], default: '3' },
    status: {
      type: String,
      enum: ['new', 'assess', 'authorize', 'scheduled', 'implement', 'review', 'closed', 'canceled'],
      default: 'new',
    },
    justification: { type: String, default: '' },
    implementationPlan: { type: String, default: '' },
    testPlan: { type: String, default: '' },
    rollbackPlan: { type: String, default: '' },
    validationPlan: { type: String, default: '' },
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    assignmentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changeManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    implementedAt: { type: Date, default: null },
    validatedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    closeCode: { type: String, enum: ['successful', 'unsuccessful', 'cancelled'], default: null },
    closeNotes: { type: String, default: '' },
    linkedIncidents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Incident' }],
    linkedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    timeline: [
      {
        at: { type: Date, default: Date.now },
        by: { type: String, default: '' },
        message: { type: String, default: '' },
      },
    ],
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

changeSchema.index({ company: 1, status: 1 });
changeSchema.index({ company: 1, type: 1 });
changeSchema.index({ company: 1, risk: 1 });
changeSchema.index({ company: 1, windowStart: 1, windowEnd: 1 });
changeSchema.index({ isActive: 1, deletedAt: 1 });

changeSchema.statics.STATUSES = ['new', 'assess', 'authorize', 'scheduled', 'implement', 'review', 'closed', 'canceled'];
changeSchema.statics.TYPES = ['normal', 'standard', 'emergency', 'registration'];
changeSchema.statics.RISKS = ['low', 'medium', 'high', 'critical'];

module.exports = mongoose.models.Change || mongoose.model('Change', changeSchema);
