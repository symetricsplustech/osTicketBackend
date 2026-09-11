const mongoose = require('mongoose');

const problemAssignmentHistorySchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    assignmentType: {
      type: String,
      enum: ['initial', 'reassignment', 'escalation', 'delegation'],
      required: true,
    },
    fromGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    fromAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    toGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    toAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

problemAssignmentHistorySchema.index({ company: 1, problem: 1, assignedAt: -1 });

module.exports = mongoose.model('ProblemAssignmentHistory', problemAssignmentHistorySchema);
