const mongoose = require('mongoose');
const activitySequenceSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  target: { type: String, enum: ['lead', 'opportunity', 'contact'], required: true },
  steps: [{
    order: Number,
    type: { type: String, enum: ['email', 'task', 'wait', 'condition'], required: String },
    template: String,
    subject: String,
    body: String,
    waitDays: Number,
    condition: { field: String, operator: String, value: String },
  }],
  status: { type: String, enum: ['active', 'paused', 'draft'], default: 'draft' },
  enrolledCount: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.ActivitySequence || mongoose.model('ActivitySequence', activitySequenceSchema);
