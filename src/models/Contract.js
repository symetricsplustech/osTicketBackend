const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'active', 'expired', 'terminated'], default: 'draft' },
    support24x7: { type: Boolean, default: false },
    supportHours: { type: String, default: '' },
    includedTicketsPerMonth: { type: Number, default: 0 },
    slaPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan' }],
    entitlements: [
      {
        service: { type: String, default: '' },
        type: { type: String, enum: ['included', 'paid', 'blocked'], default: 'included' },
        qty: { type: Number, default: 0 },
        unit: { type: String, default: 'tickets' },
        usedCount: { type: Number, default: 0 },
      },
    ],
    renewal: {
      autoRenew: { type: Boolean, default: false },
      renewalPeriod: { type: String, default: '' },
      noticeDays: { type: Number, default: 30 },
    },
    notes: { type: String, default: '' },
    accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

contractSchema.index({ company: 1, organization: 1 });
contractSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);