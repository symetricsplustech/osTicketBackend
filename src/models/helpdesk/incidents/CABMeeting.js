const mongoose = require('mongoose');

const cabMeetingSchema = new mongoose.Schema(
  {
    cab: { type: mongoose.Schema.Types.ObjectId, ref: 'CABDefinition', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true },
    location: { type: String, default: '' },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

cabMeetingSchema.index({ company: 1, scheduledAt: 1 });

module.exports = mongoose.model('CABMeeting', cabMeetingSchema);
