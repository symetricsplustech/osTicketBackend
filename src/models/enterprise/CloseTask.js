const mongoose = require('mongoose');
const closeTaskSchema = new mongoose.Schema({
  period: { type: String, required: true },
  task: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CloseTask' }],
  certification: String,
  signOffBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  completedAt: Date,
  status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
closeTaskSchema.index({ period: 1 });
module.exports = mongoose.models.CloseTask || mongoose.model('CloseTask', closeTaskSchema);
