const mongoose = require('mongoose');
const portfolioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  totalBudget: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);
