const mongoose = require('mongoose');

const taskActivitySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    type: {
      type: String,
      enum: ['comment', 'work_note', 'state_change', 'assignment', 'field_update', 'attachment', 'system'],
      required: true,
      index: true,
    },
    content: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' },
    fieldChanged: { type: String, default: null },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

taskActivitySchema.index({ tenantId: 1, taskId: 1, createdAt: -1 });
taskActivitySchema.index({ tenantId: 1, taskId: 1, type: 1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
