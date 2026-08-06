const mongoose = require('mongoose');

const helpTopicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, unique: true, trim: true },
    category: { type: String, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Emergency'],
      default: 'Normal',
    },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    autoAssignAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    autoAssignTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    formId: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HelpTopic', helpTopicSchema);
