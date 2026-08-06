const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
