const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['server', 'vm', 'database', 'application', 'network', 'cloud', 'storage', 'container', 'service', 'other'], required: true },
    status: { type: String, enum: ['healthy', 'degraded', 'down', 'maintenance', 'unknown'], default: 'unknown' },
    environment: { type: String, enum: ['production', 'staging', 'development', 'test'], default: 'production' },
    ipAddress: { type: String, default: '' },
    hostname: { type: String, default: '' },
    location: { type: String, default: '' },
    provider: { type: String, default: '' },
    region: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    dependents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    metrics: {
      cpu: { type: Number, default: 0 },
      memory: { type: Number, default: 0 },
      disk: { type: Number, default: 0 },
      uptime: { type: Number, default: 0 },
      lastChecked: { type: Date, default: null },
    },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

resourceSchema.index({ company: 1, type: 1 });
resourceSchema.index({ company: 1, status: 1 });
resourceSchema.index({ name: 'text', hostname: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
