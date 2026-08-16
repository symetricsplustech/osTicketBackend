const mongoose = require('mongoose');

const prioritySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    level: { type: Number, required: true, default: 2 },
    color: { type: String, default: '#64748b' },
    isDefault: { type: Boolean, default: false },
    sla: { type: mongoose.Schema.Types.ObjectId, ref: 'SlaPlan', default: null },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

prioritySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Priority', prioritySchema);