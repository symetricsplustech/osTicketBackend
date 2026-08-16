const mongoose = require('mongoose');

const LINK_TYPES = ['parent', 'child', 'related', 'duplicate', 'incident', 'problem', 'change', 'asset', 'blocks', 'blocked_by', 'refers_to', 'merged'];

const ticketLinkSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    type: { type: String, enum: LINK_TYPES, default: 'related' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

ticketLinkSchema.index({ company: 1, from: 1, to: 1 }, { unique: true });
ticketLinkSchema.statics.TYPES = LINK_TYPES;

module.exports = mongoose.model('TicketLink', ticketLinkSchema);