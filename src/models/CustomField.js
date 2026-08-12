const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'select', 'checkbox', 'date', 'number'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    placeholder: { type: String, default: '' },
    helpTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpTopic', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  },
  { timestamps: true }
);

customFieldSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomField', customFieldSchema);
