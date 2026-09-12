const { Schema, model } = require('mongoose');
const WalkupQueueSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  locationId: { type: Schema.Types.ObjectId, ref: 'WalkupLocation', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'WalkupService', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  status: { type: String, enum: ['open', 'paused', 'closed'], default: 'open', index: true },
  maxSize: { type: Number, default: 50 },
  currentSize: { type: Number, default: 0 },
  avgWaitMinutes: { type: Number, default: 0 },
  estimatedWaitMinutes: { type: Number, default: 0 },
  currentServing: { type: Schema.Types.ObjectId, ref: 'WalkupCheckin' },
  nextNumber: { type: Number, default: 1 },
  priorityHandling: { type: Boolean, default: false },
  autoEstimateWait: { type: Boolean, default: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
WalkupQueueSchema.index({ tenantId: 1, locationId: 1, status: 1, isDeleted: 1 });
module.exports = model('WalkupQueue', WalkupQueueSchema);
