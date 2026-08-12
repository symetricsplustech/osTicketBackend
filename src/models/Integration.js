const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['chat', 'email', 'phone', 'messaging', 'authentication', 'automation', 'other'],
      default: 'other',
    },
    icon: { type: String, default: '' },
    isEnabled: { type: Boolean, default: false },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

integrationSchema.index({ company: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Integration', integrationSchema);
