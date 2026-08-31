const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['travel', 'meals', 'office', 'training', 'medical', 'other'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    receiptUrl: { type: String, default: '' },
    status: { type: String, enum: ['submitted', 'approved', 'rejected', 'paid'], default: 'submitted' },
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    expenseDate: { type: Date, required: true },
    tags: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

claimSchema.index({ company: 1, employee: 1 });
claimSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
