const { Schema, model } = require('mongoose');
const WaitTimeEventSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  queueId: { type: Schema.Types.ObjectId, ref: 'WalkupQueue', required: true, index: true },
  checkinId: { type: Schema.Types.ObjectId, ref: 'WalkupCheckin' },
  timestamp: { type: Date, default: Date.now, index: true },
  queueSize: { type: Number, required: true },
  waitTimeMinutes: { type: Number, required: true },
  servedCount: { type: Number, default: 0 },
  abandonedCount: { type: Number, default: 0 },
  avgServiceMinutes: { type: Number, default: 0 },
  eventType: { type: String, enum: ['checkin', 'called', 'started', 'completed', 'abandoned', 'reestimate'], default: 'reestimate' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
WaitTimeEventSchema.index({ tenantId: 1, queueId: 1, timestamp: -1 });
module.exports = model('WaitTimeEvent', WaitTimeEventSchema);
