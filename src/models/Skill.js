const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    expertiseLevels: { type: [String], default: ['Beginner', 'Intermediate', 'Expert'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

skillSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Skill', skillSchema);