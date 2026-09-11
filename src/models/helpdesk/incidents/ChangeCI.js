const mongoose = require('mongoose');

const changeCISchema = new mongoose.Schema(
  {
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true, index: true },
    ci: { type: mongoose.Schema.Types.ObjectId, ref: 'CI', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['primary', 'affected', 'testing', 'rollback'], default: 'affected' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

changeCISchema.index({ change: 1, ci: 1 }, { unique: true });
changeCISchema.index({ company: 1, change: 1 });

module.exports = mongoose.model('ChangeCI', changeCISchema);
