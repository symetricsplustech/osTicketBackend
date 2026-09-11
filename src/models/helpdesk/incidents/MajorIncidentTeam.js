const { Schema, model } = require('mongoose');
const MajorIncidentTeamSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  majorIncidentId: { type: Schema.Types.ObjectId, ref: 'MajorIncident', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['commander', 'technical_lead', 'communications', 'subject_matter_expert', 'stakeholder', 'coordinator', 'resolver', 'observer'], required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  isActive: { type: Boolean, default: true },
  assignedAreas: [{ type: String, trim: true }],
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });
MajorIncidentTeamSchema.index({ tenantId: 1, majorIncidentId: 1, userId: 1 });
module.exports = model('MajorIncidentTeam', MajorIncidentTeamSchema);
