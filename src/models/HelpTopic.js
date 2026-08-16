const mongoose = require('mongoose');

const helpTopicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    category: { type: String, default: '' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    priority: {
      type: String,
      default: 'Normal',
    },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    autoAssignAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    autoAssignTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    formId: { type: String, default: '' },
    autoresponder: {
      enabled: { type: Boolean, default: true },
      subject: { type: String, default: '' },
      body: { type: String, default: '' },
    },
    isPublic: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

helpTopicSchema.index({ company: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('HelpTopic', helpTopicSchema);
