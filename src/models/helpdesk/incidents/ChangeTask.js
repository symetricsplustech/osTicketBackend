const mongoose = require('mongoose');

const changeTaskSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    change: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    order: { type: Number, default: 0 },
    assignmentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    result: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

changeTaskSchema.index({ company: 1, change: 1, order: 1 });

module.exports = mongoose.model('ChangeTask', changeTaskSchema);
