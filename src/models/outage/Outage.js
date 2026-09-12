const { Schema, model } = require('mongoose');
const OutageSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['planned', 'unplanned'], required: true, default: 'unplanned', index: true },
  severity: { type: String, enum: ['minor', 'major', 'critical'], required: true, default: 'minor', index: true },
  status: { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved', 'closed', 'canceled'], default: 'investigating', index: true },
  impact: { type: String, trim: true, default: '' },
  rootCause: { type: String, trim: true, default: '' },
  startTime: { type: Date, required: true, index: true },
  estimatedRestoration: { type: Date },
  actualRestoration: { type: Date },
  plannedStart: { type: Date },
  plannedEnd: { type: Date },
  detectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  communicationPlan: {
    internal: { enabled: { type: Boolean, default: true }, cadenceMinutes: { type: Number, default: 30 } },
    external: { enabled: { type: Boolean, default: true }, cadenceMinutes: { type: Number, default: 60 } },
    stakeholder: { enabled: { type: Boolean, default: true }, cadenceMinutes: { type: Number, default: 60 } },
  },
  lastCommunicationAt: { type: Date },
  nextCommunicationAt: { type: Date },
  timeline: [{
    status: { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved', 'closed', 'canceled'], required: true },
    message: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
OutageSchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
OutageSchema.index({ tenantId: 1, startTime: -1 });
OutageSchema.index({ tenantId: 1, ownerId: 1, status: 1 });
module.exports = model('Outage', OutageSchema);
