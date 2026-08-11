const mongoose = require('mongoose');

const faqCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    description: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

faqCategorySchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('FaqCategory', faqCategorySchema);
