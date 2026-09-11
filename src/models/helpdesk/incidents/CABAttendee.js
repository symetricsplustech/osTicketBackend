const mongoose = require('mongoose');

const cabAttendeeSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'CABMeeting', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    status: { type: String, enum: ['invited', 'accepted', 'declined', 'attended'], default: 'invited' },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cabAttendeeSchema.index({ meeting: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('CABAttendee', cabAttendeeSchema);
