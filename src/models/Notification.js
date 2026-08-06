const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: ['agent', 'user'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: ['new_ticket', 'reply', 'assignment', 'transfer', 'overdue', 'system', 'status_change'],
      default: 'system',
    },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
