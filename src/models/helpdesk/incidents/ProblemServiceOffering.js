const mongoose = require('mongoose');

const problemServiceOfferingSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    serviceOffering: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOffering', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['primary', 'affected', 'related'], default: 'affected' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemServiceOfferingSchema.index({ problem: 1, serviceOffering: 1 }, { unique: true });
problemServiceOfferingSchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('ProblemServiceOffering', problemServiceOfferingSchema);
