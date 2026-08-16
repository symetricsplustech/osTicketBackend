const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    actorType: { type: String, enum: ['agent', 'user', 'system', 'superadmin', 'api'], default: 'system' },
    actor: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: '', index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    changes: [
      {
        field: { type: String, default: '' },
        from: { type: mongoose.Schema.Types.Mixed, default: null },
        to: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],
    reason: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    source: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditEventSchema.index({ company: 1, entityType: 1, entityId: 1, createdAt: -1 });
auditEventSchema.index({ company: 1, actor: 1, createdAt: -1 });
auditEventSchema.index({ company: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);