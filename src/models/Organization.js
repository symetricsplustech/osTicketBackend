const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
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

module.exports = mongoose.model('Organization', organizationSchema);
