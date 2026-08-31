const mongoose = require('mongoose');
const sprintSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  startDate: Date, endDate: Date,
  backlogTaskRefs: [String],
  status: { type: String, enum: ['planned', 'active', 'done'], default: 'planned' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.Sprint || mongoose.model('Sprint', sprintSchema);
