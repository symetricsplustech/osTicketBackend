const mongoose = require('mongoose');

const dependencySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
    type: {
      type: String,
      enum: ['depends_on', 'connects_to', 'part_of', 'runs_on', 'uses'],
      default: 'depends_on',
    },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

dependencySchema.index({ company: 1, from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('Dependency', dependencySchema);