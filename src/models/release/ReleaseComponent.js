const { Schema, model } = require('mongoose');
const ReleaseComponentSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  releaseId: { type: Schema.Types.ObjectId, ref: 'Release', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['application', 'service', 'database', 'library', 'infrastructure', 'configuration', 'documentation', 'script', 'other'], default: 'application', index: true },
  version: { type: String, required: true },
  previousVersion: { type: String },
  sourceRepository: { type: String, trim: true, default: '' },
  sourceBranch: { type: String, trim: true, default: '' },
  commitHash: { type: String, trim: true, default: '' },
  buildArtifact: { type: String, trim: true, default: '' },
  buildUrl: { type: String, trim: true, default: '' },
  buildStatus: { type: String, enum: ['pending', 'building', 'built', 'failed', 'promoted'], default: 'pending' },
  artifactUrl: { type: String, trim: true, default: '' },
  artifactChecksum: { type: String, trim: true, default: '' },
  environment: { type: String, enum: ['development', 'test', 'staging', 'production', 'dr'], default: 'development' },
  deployedAt: { type: Date },
  deployedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deploymentStatus: { type: String, enum: ['not_deployed', 'deploying', 'deployed', 'failed', 'rolled_back'], default: 'not_deployed' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ReleaseComponentSchema.index({ tenantId: 1, releaseId: 1, type: 1 });
ReleaseComponentSchema.index({ tenantId: 1, name: 1, version: 1 });
module.exports = model('ReleaseComponent', ReleaseComponentSchema);
