const mongoose = require('mongoose');

const ticketStatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    color: { type: String, default: '#4a86b0' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    description: { type: String, default: '' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

ticketStatusSchema.index({ company: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('TicketStatus', ticketStatusSchema);
