const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    superAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
