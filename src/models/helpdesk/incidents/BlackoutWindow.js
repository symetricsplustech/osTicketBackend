const mongoose = require('mongoose');

const blackoutWindowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    reason: { type: String, default: '' },
    appliesTo: { type: String, enum: ['all', 'emergency_only', 'high_risk'], default: 'all' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

blackoutWindowSchema.index({ company: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('BlackoutWindow', blackoutWindowSchema);
