const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

teamSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
