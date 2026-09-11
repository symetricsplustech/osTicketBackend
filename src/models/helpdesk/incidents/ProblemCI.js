const mongoose = require('mongoose');

const problemCISchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    ci: { type: mongoose.Schema.Types.ObjectId, ref: 'CI', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['causal', 'affected', 'related'], default: 'affected' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemCISchema.index({ problem: 1, ci: 1 }, { unique: true });
problemCISchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('ProblemCI', problemCISchema);
