const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: ['laptop', 'desktop', 'server', 'router', 'switch', 'firewall', 'printer', 'application', 'network', 'service', 'other'],
      default: 'other',
    },
    serial: { type: String, default: '' },
    ip: { type: String, default: '' },
    hostname: { type: String, default: '' },
    environment: { type: String, enum: ['production', 'staging', 'development', 'test'], default: 'production' },
    criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    location: { type: String, default: '' },
    status: { type: String, enum: ['active', 'maintenance', 'retired', 'lost'], default: 'active' },
    warrantyUntil: { type: Date, default: null },
    purchaseDate: { type: Date, default: null },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

assetSchema.index({ company: 1, organization: 1 });
assetSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model('Asset', assetSchema);