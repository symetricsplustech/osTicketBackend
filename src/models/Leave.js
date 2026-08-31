const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['annual', 'sick', 'personal', 'maternity', 'paternity', 'bereavement', 'unpaid', 'other'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    attachments: { type: [String], default: [] },
    backfill: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

leaveSchema.index({ company: 1, employee: 1 });
leaveSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
