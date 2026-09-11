const mongoose = require('mongoose');

const taskAssignmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignmentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    assignmentType: {
      type: String,
      enum: ['manual', 'auto', 'escalation', 'reassignment'],
      default: 'manual',
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
    previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

taskAssignmentSchema.index({ tenantId: 1, taskId: 1, isActive: 1 });
taskAssignmentSchema.index({ tenantId: 1, assignedTo: 1, isActive: 1 });

module.exports = mongoose.model('TaskAssignment', taskAssignmentSchema);
