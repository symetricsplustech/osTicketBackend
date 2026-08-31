const mongoose = require('mongoose');

const accessAssignmentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  principalType: { type: String, enum: ['User', 'Agent'], required: true },
  principal: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  unitScopes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationUnit' }],
  departmentScopes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  locationScopes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationUnit' }],
  teamScopes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  moduleKeys: { type: [String], default: [] },
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
}, { timestamps: true });
accessAssignmentSchema.index({ company: 1, principal: 1, active: 1 });
module.exports = mongoose.model('AccessAssignment', accessAssignmentSchema);
