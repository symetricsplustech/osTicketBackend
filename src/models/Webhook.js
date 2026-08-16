const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    url: { type: String, required: true },
    secret: { type: String, default: '' },
    events: { type: [String], default: ['ticket.created'] },
    isActive: { type: Boolean, default: true },
    lastDeliveryAt: { type: Date, default: null },
    lastStatus: { type: String, default: '' },
    failureCount: { type: Number, default: 0 },
    deliveryLogs: [
      {
        at: { type: Date, default: Date.now },
        status: { type: String, default: '' },
        response: { type: String, default: '' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

webhookSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);