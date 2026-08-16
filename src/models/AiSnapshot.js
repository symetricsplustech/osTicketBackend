const mongoose = require('mongoose');

const aiSnapshotSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true, index: true },
    model: { type: String, default: 'heuristic' },
    provider: { type: String, default: 'local' },
    summary: { type: String, default: '' },
    intent: { type: String, default: '' },
    sentiment: { type: String, default: '' },
    urgency: { type: String, default: '' },
    language: { type: String, default: '' },
    entities: { type: mongoose.Schema.Types.Mixed, default: {} },
    category: { type: String, default: '' },
    complexity: { type: String, default: '' },
    suggestedDepartment: { type: String, default: '' },
    suggestedAgent: { type: String, default: '' },
    suggestedPriority: { type: String, default: '' },
    suggestedSla: { type: String, default: '' },
    suggestedTags: { type: [String], default: [] },
    similarTickets: [
      {
        number: { type: String, default: '' },
        subject: { type: String, default: '' },
        status: { type: String, default: '' },
        resolution: { type: String, default: '' },
        score: { type: Number, default: 0 },
      },
    ],
    kbArticles: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, default: null },
        question: { type: String, default: '' },
        score: { type: Number, default: 0 },
      },
    ],
    replySuggestions: { type: [String], default: [] },
    slaRisk: { type: Number, default: 0 }, // percentage 0-100
    churnRisk: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    qa: {
      score: { type: Number, default: null },
      checks: { type: mongoose.Schema.Types.Mixed, default: {} },
      evaluatedAt: { type: Date, default: null },
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiSnapshotSchema.index({ company: 1, ticket: 1 });

module.exports = mongoose.model('AiSnapshot', aiSnapshotSchema);