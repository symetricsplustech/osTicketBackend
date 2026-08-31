const mongoose = require('mongoose');
const timesheetSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0, max: 24 },
  description: String,
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  approvedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
timesheetSchema.index({ agent: 1, date: 1 });
module.exports = mongoose.models.Timesheet || mongoose.model('Timesheet', timesheetSchema);
