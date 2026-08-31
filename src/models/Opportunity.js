const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    stage: { type: String, enum: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'], default: 'prospecting' },
    value: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    probability: { type: Number, default: 0, min: 0, max: 100 },
    closeDate: { type: Date, default: null },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    type: { type: String, enum: ['new_business', 'renewal', 'expansion', 'upsell'], default: 'new_business' },
    description: { type: String, default: '' },
    lossReason: { type: String, default: '' },
    products: [{
      name: String,
      quantity: { type: Number, default: 1 },
      unitPrice: Number,
      total: Number,
    }],
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

opportunitySchema.index({ company: 1, stage: 1 });
opportunitySchema.index({ company: 1, assignedTo: 1 });
opportunitySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Opportunity', opportunitySchema);
