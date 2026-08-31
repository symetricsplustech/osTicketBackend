const mongoose = require('mongoose');

const crmActivitySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    type: { type: String, enum: ['call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'sms'], required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    relatedTo: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedModel', default: null },
    relatedModel: { type: String, enum: ['Lead', 'Company', 'Opportunity', 'Quote', 'Ticket'], default: null },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
    outcome: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  { timestamps: true }
);

crmActivitySchema.index({ company: 1, type: 1 });
crmActivitySchema.index({ company: 1, lead: 1 });
crmActivitySchema.index({ company: 1, opportunity: 1 });

module.exports = mongoose.model('CrmActivity', crmActivitySchema);
