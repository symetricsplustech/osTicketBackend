const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    isRecurring: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

holidaySchema.index({ company: 1, date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
