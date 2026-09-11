const mongoose = require('mongoose');

const taskAttachmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskActivity', default: null, index: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, default: '' },
    version: { type: Number, default: 1 },
    hash: { type: String, default: '' },
  },
  { timestamps: true }
);

taskAttachmentSchema.index({ tenantId: 1, taskId: 1, isDeleted: 1 });

module.exports = mongoose.model('TaskAttachment', taskAttachmentSchema);
