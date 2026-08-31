const mongoose = require('mongoose');
const threatFeedSchema = new mongoose.Schema({
  source: { type: String, required: true },
  indicators: [{ type: { type: String, enum: ['ip', 'domain', 'url', 'hash'] }, value: String, reputation: String }],
  lastSyncAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ThreatFeed || mongoose.model('ThreatFeed', threatFeedSchema);
