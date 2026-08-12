const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    priority: { type: String, enum: ['Low', 'Normal', 'High', 'Emergency'], default: null },
    statuses: { type: [String], default: ['open', 'assigned', 'overdue'] },
    overdueMinutes: { type: Number, default: 0, min: 0 },
    action: {
      raisePriorityTo: { type: String, enum: ['Low', 'Normal', 'High', 'Emergency'], default: null },
      reassignAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
      reassignTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
      notifyAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    },
    isActive: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ruleSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model('EscalationRule', ruleSchema);
