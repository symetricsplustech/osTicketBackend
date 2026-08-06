const mongoose = require('mongoose');

const filterRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true }, // subject, from, name, body, topic, priority
    method: { type: String, enum: ['contains', 'equals', 'regex', 'starts_with', 'ends_with'], default: 'contains' },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const filterActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // dept, agent, team, priority, sla, reject, canned_response, topic
    target: { type: String, default: '' },
  },
  { _id: false }
);

const ticketFilterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rules: { type: [filterRuleSchema], default: [] },
    actions: { type: [filterActionSchema], default: [] },
    match: { type: String, enum: ['all', 'any'], default: 'all' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    order: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TicketFilter', ticketFilterSchema);
