const mongoose = require('mongoose');

const slaPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    gracePeriod: { type: Number, required: true, default: 24 }, // hours to first response
    schedule: { type: String, enum: ['24/7', 'Business Hours'], default: '24/7' },
    timezone: { type: String, default: 'UTC' },
    businessHours: {
      days: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0=Sun..6=Sat
      start: { type: String, default: '09:00' }, // HH:mm local to timezone
      end: { type: String, default: '17:00' },
    },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    notes: { type: String, default: '' },
    // ---- Enterprise: Advanced SLA (per-type targets, hours) ----
    targets: {
      first_response: { type: Number, default: null }, // hours; null -> gracePeriod
      next_response: { type: Number, default: null },
      resolution: { type: Number, default: null },
      update: { type: Number, default: null },
      escalation: { type: Number, default: null },
      callback: { type: Number, default: null },
      approval: { type: Number, default: null },
    },
    pauseOnWaiting: { type: Boolean, default: true }, // pause timer while waiting on customer
    notifyOnBreach: { type: Boolean, default: true },
    notifyOnAtRisk: { type: Boolean, default: false },
    breachEscalate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

slaPlanSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SlaPlan', slaPlanSchema);
