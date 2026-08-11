const mongoose = require('mongoose');

const cannedResponseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    response: { type: String, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    dept: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CannedResponse', cannedResponseSchema);
