const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    scopes: { type: [String], default: ['tickets:read', 'tickets:write'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.statics.generateKey = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw: `ost_${raw}`, prefix: `ost_${raw.slice(0, 8)}` };
};

apiKeySchema.statics.hashKey = function (raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
};

module.exports = mongoose.model('ApiKey', apiKeySchema);