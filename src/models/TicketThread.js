const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimetype: { type: String, default: '' },
  },
  { _id: true }
);

const threadSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    type: {
      type: String,
      enum: ['message', 'note', 'system', 'event'],
      default: 'message',
    },
    posterType: {
      type: String,
      enum: ['user', 'agent', 'system'],
      default: 'user',
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    systemMessage: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    isSystem: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

threadSchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model('TicketThread', threadSchema);
