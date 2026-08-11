const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    domain: { type: String, default: '' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

organizationSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Organization', organizationSchema);
