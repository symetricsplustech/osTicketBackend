const mongoose = require('mongoose');

const slaPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    gracePeriod: { type: Number, required: true, default: 24 }, // hours to first response
    schedule: { type: String, enum: ['24/7', 'Business Hours'], default: '24/7' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

slaPlanSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SlaPlan', slaPlanSchema);
