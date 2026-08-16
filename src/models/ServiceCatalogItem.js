const mongoose = require('mongoose');

const serviceCatalogItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    category: { type: String, default: 'General' },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    visibleInPortal: { type: Boolean, default: true },
    helpTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    priority: { type: String, default: 'Normal' },
    autoAssignAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    autoAssignTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    estimatedTime: { type: String, default: '' },
    requiresApproval: { type: Boolean, default: false },
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
    approvalNote: { type: String, default: '' },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketForm', default: null },
    price: { type: Number, default: 0 },
    needsPayment: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

serviceCatalogItemSchema.index({ company: 1, category: 1, isActive: 1 });

module.exports = mongoose.model('ServiceCatalogItem', serviceCatalogItemSchema);