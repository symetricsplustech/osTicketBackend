const mongoose = require('mongoose');
const lifecycleTaskSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  milestone: { type: String, enum: ['day_1', 'day_30', 'day_60', 'day_90', 'six_month', 'annual_review', 'promotion', 'exit'], required: true },
  dueDate: Date,
  title: String,
  items: [{ label: String, done: Boolean }],
  status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.LifecycleTask || mongoose.model('LifecycleTask', lifecycleTaskSchema);
