const mongoose = require('mongoose');
const ticketTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  subject: String,
  body: String,
  category: String,
  priority: String,
  status: String,
  sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan' },
  fields: [{ name: String, type: String, required: Boolean, defaultValue: String, options: [String] }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.TicketTemplate || mongoose.model('TicketTemplate', ticketTemplateSchema);
