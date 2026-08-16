const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    email: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    autoAssignAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    autoAssignTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    signature: { type: String, default: '' },
    schedule: {
      timezone: { type: String, default: '' },
      businessHoursEnabled: { type: Boolean, default: false },
      days: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
