const mongoose = require('mongoose');

const changeSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['standard', 'normal', 'emergency'], default: 'normal' },
    risk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    riskScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'draft',
        'requested',
        'for_approval',
        'approved',
        'scheduled',
        'implementing',
        'validating',
        'closed',
        'rejected',
        'rolled_back',
      ],
      default: 'draft',
    },
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    maintenanceWindow: { type: Boolean, default: false },
    implementationPlan: { type: String, default: '' },
    rollbackPlan: { type: String, default: '' },
    validationPlan: { type: String, default: '' },
    cab: { type: String, default: '' },
    approval: { type: mongoose.Schema.Types.ObjectId, ref: 'Approval', default: null },
    linkedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    linkedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    submittedAt: { type: Date, default: null },
    implementedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    implementedAt: { type: Date, default: null },
    validatedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

changeSchema.index({ company: 1, status: 1 });
changeSchema.statics.STATUSES = [
  'draft',
  'requested',
  'for_approval',
  'approved',
  'scheduled',
  'implementing',
  'validating',
  'closed',
  'rejected',
  'rolled_back',
];

module.exports = mongoose.model('Change', changeSchema);