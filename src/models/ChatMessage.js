const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: String, enum: ['user', 'agent', 'system', 'ai'], default: 'user' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    body: { type: String, required: true },
    attachments: [
      { filename: { type: String, default: '' }, path: { type: String, default: '' }, size: { type: Number, default: 0 }, mimetype: { type: String, default: '' } },
    ],
    readByAgent: { type: Boolean, default: false },
    readByUser: { type: Boolean, default: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);