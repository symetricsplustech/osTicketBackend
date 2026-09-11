const mongoose = require('mongoose');

const changeServiceSchema = new mongoose.Schema(
  {
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOffering', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    impactLevel: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'low' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

changeServiceSchema.index({ change: 1, service: 1 }, { unique: true });
changeServiceSchema.index({ company: 1, change: 1 });

module.exports = mongoose.model('ChangeService', changeServiceSchema);
