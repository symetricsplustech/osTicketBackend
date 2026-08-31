const mongoose = require('mongoose');
const ciSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  ciClass: { type: String, enum: ['server', 'vm', 'application', 'database', 'network', 'cloud_resource', 'container', 'kubernetes_cluster', 'storage', 'service', 'service_offering', 'business_application'], default: 'server' },
  status: { type: String, enum: ['planned', 'ordered', 'installed', 'operational', 'maintenance', 'retired', 'stale'], default: 'operational' },
  environment: { type: String, enum: ['prod', 'staging', 'dev', 'test'], default: 'prod' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  ipAddress: String,
  serialNumber: String,
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  relationships: [{ type: { type: String, enum: ['depends_on', 'runs_on', 'hosted_on', 'connects_to', 'uses', 'part_of'], default: 'depends_on' }, target: { type: mongoose.Schema.Types.ObjectId, ref: 'CI' } }],
  sourceSystem: { type: String, default: 'manual' },
  identificationKey: String,
  lastCertifiedAt: Date,
  dataQuality: { completeness: Number, correctness: Number },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
ciSchema.index({ name: 1, tenantId: 1 });
module.exports = mongoose.models.CI || mongoose.model('CI', ciSchema);
