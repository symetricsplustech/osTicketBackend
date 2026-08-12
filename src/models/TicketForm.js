const mongoose = require('mongoose');

const ticketFormSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    helpTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
    fields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CustomField' }],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

ticketFormSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('TicketForm', ticketFormSchema);
