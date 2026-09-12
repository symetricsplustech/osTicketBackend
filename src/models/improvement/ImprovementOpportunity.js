const { Schema, model } = require('mongoose');
const ImprovementOpportunitySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  source: { type: String, enum: ['incident', 'problem', 'change', 'survey', 'audit', 'customer_feedback', 'internal_review', 'kpi_breach', 'benchmark', 'innovation', 'other'], required: true, index: true },
  sourceId: { type: Schema.Types.ObjectId },
  category: { type: String, enum: ['process', 'technology', 'people', 'governance', 'cost', 'quality', 'security', 'compliance', 'customer_experience', 'efficiency', 'other'], required: true, index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  status: { type: String, enum: ['new', 'qualified', 'rejected', 'approved', 'on_hold', 'converted', 'implemented'], default: 'new', index: true },
  impact: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  effort: { type: String, enum: ['low', 'medium', 'high', 'very_high'], default: 'medium' },
  risk: { type: String, enum: ['low', 'medium', 'high', 'very_high'], default: 'low' },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  qualifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  qualifiedAt: { type: Date },
  rejectionReason: { type: String, trim: true, default: '' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  initiativeId: { type: Schema.Types.ObjectId, ref: 'ImprovementInitiative' },
  relatedTickets: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }],
  relatedIncidents: [{ type: Schema.Types.ObjectId, ref: 'Incident' }],
  relatedProblems: [{ type: Schema.Types.ObjectId, ref: 'Problem' }],
  relatedChanges: [{ type: Schema.Types.ObjectId, ref: 'Change' }],
  relatedSurveys: [{ type: Schema.Types.ObjectId, ref: 'SurveyResponse' }],
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
ImprovementOpportunitySchema.index({ tenantId: 1, status: 1, isDeleted: 1 });
ImprovementOpportunitySchema.index({ tenantId: 1, category: 1, priority: 1 });
ImprovementOpportunitySchema.index({ tenantId: 1, submittedBy: 1 });
ImprovementOpportunitySchema.index({ tenantId: 1, assignedTo: 1 });
module.exports = model('ImprovementOpportunity', ImprovementOpportunitySchema);
