const mongoose = require('mongoose');

const botFlowSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    trigger: { type: String, default: '' },
    enabled: { type: Boolean, default: true, index: true },
    nodes: [
      {
        id: { type: String, required: true },
        label: { type: String, default: '' },
        type: { type: String, enum: ['start', 'message', 'question', 'condition', 'handoff', 'end', 'ticket_status', 'kb_search'], default: 'message' },
        text: { type: String, default: '' },
        options: { type: mongoose.Schema.Types.Mixed, default: [] },
        conditions: { type: mongoose.Schema.Types.Mixed, default: [] },
        next: { type: String, default: '' },
        config: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    startNode: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

botFlowSchema.index({ company: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.BotFlow || mongoose.model('BotFlow', botFlowSchema);
