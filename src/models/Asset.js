const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  name: { type: String, required: true, trim: true },
  serial: { type: String, default: '' },
  ip: { type: String, default: '' },
  hostname: { type: String, default: '' },
  status: { type: String, default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
