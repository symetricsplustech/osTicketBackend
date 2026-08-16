const mongoose = require('mongoose');

const healthScoreSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    subjectType: { type: String, enum: ['user', 'organization'], default: 'organization', index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    score: { type: Number, default: 0 }, // 0-100, higher = healthier
    grade: { type: String, enum: ['healthy', 'at_risk', 'critical', 'unknown'], default: 'unknown' },
    signals: {
      openTickets: { type: Number, default: 0 },
      overdueTickets: { type: Number, default: 0 },
      slaBreaches: { type: Number, default: 0 },
      unresolvedPerWeek: { type: Number, default: 0 },
      avgSentiment: { type: String, default: 'neutral' },
      negativeShare: { type: Number, default: 0 },
      csatAvg: { type: Number, default: null },
      npsAvg: { type: Number, default: null },
      incidents: { type: Number, default: 0 },
      criticalIncidents: { type: Number, default: 0 },
      churnSignals: { type: [String], default: [] },
      renewalDays: { type: Number, default: null },
    },
    lastComputed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

healthScoreSchema.index({ company: 1, subjectType: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('HealthScore', healthScoreSchema);