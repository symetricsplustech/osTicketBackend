const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'transition', 'assign', 'approve', 'reject', 'comment', 'attach', 'restore', 'export'],
      required: true,
      index: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    changedFields: { type: [String], default: [] },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    correlationId: { type: String, default: null, index: true },
    sessionId: { type: String, default: null },
    requestId: { type: String, default: null },
    outcome: { type: String, enum: ['success', 'failure', 'denied'], default: 'success' },
    denialReason: { type: String, default: '' },
    duration: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditEventSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });
auditEventSchema.index({ tenantId: 1, actor: 1, createdAt: -1 });
auditEventSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditEventSchema.index({ tenantId: 1, correlationId: 1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
