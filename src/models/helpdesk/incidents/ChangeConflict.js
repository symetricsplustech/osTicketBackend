const mongoose = require('mongoose');

const changeConflictSchema = new mongoose.Schema(
  {
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true, index: true },
    conflictingChange: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    conflictType: {
      type: String,
      enum: ['schedule_overlap', 'resource_conflict', 'ci_conflict', 'blackout_violation'],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, default: '' },
    isResolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolution: { type: String, default: '' },
    detectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

changeConflictSchema.index({ company: 1, change: 1 });
changeConflictSchema.index({ company: 1, isResolved: 1 });

module.exports = mongoose.model('ChangeConflict', changeConflictSchema);
