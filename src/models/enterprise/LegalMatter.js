const mongoose = require('mongoose');
const legalMatterSchema = new mongoose.Schema({
  matterRef: String,
  title: { type: String, required: true },
  practiceArea: { type: String, enum: ['commercial', 'employment', 'ip', 'privacy', 'litigation', 'regulatory', 'corporate', 'other'], default: 'commercial' },
  privilege: { type: Boolean, default: false },
  conflictCheckDone: { type: Boolean, default: false },
  openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
  outsideCounsel: { firm: String, engagementLetterUrl: String, spendToDate: Number },
  budget: Number,
  status: { type: String, enum: ['intake', 'conflict_check', 'open', 'on_hold', 'closed'], default: 'intake' },
  milestones: [{ title: String, dueDate: Date, done: Boolean }],
  holds: [{ custodianName: String, noticeSentAt: Date, acknowledged: Boolean, releasedAt: Date }],
  closedAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.LegalMatter || mongoose.model('LegalMatter', legalMatterSchema);
