const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  name: { type: String, required: true },
  type: { type: String, default: 'csat' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model('Survey', schema);
