const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    channel: {
      type: String,
      enum: ['chat', 'whatsapp', 'sms', 'facebook', 'instagram', 'voice', 'web', 'api'],
      default: 'chat',
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, default: '' },
    guestEmail: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null, index: true },
    status: { type: String, enum: ['open', 'pending', 'closed'], default: 'open' },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    subject: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    unreadAgent: { type: Number, default: 0 },
    unreadUser: { type: Number, default: 0 },
  },
  { timestamps: true }
);

conversationSchema.index({ company: 1, status: 1, updatedAt: -1 });
conversationSchema.index({ company: 1, channel: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);