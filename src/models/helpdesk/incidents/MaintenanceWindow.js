const mongoose = require('mongoose');

const maintenanceWindowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    recurrenceDays: [{ type: Number }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

maintenanceWindowSchema.index({ company: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('MaintenanceWindow', maintenanceWindowSchema);
