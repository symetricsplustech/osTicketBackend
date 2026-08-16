const mongoose = require('mongoose');

const savedQueueSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    name: { type: String, required: true, trim: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savedQueueSchema.index({ agent: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SavedQueue', savedQueueSchema);