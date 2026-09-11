const mongoose = require('mongoose');

const problemKnowledgeSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    knowledgeArticle: { type: mongoose.Schema.Types.ObjectId, ref: 'Faq', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['workaround', 'root_cause', 'resolution', 'related'], default: 'related' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

problemKnowledgeSchema.index({ problem: 1, knowledgeArticle: 1 }, { unique: true });
problemKnowledgeSchema.index({ company: 1, problem: 1 });

module.exports = mongoose.model('ProblemKnowledge', problemKnowledgeSchema);
