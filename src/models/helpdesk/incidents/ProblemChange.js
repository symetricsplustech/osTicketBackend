const mongoose = require('mongoose');

const problemChangeSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    relationshipType: { type: String, enum: ['remediation', 'workaround', 'investigation'], default: 'remediation' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemChangeSchema.index({ problem: 1, change: 1 }, { unique: true });
problemChangeSchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('ProblemChange', problemChangeSchema);
