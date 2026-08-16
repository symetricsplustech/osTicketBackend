const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    type: { type: String, enum: ['csat', 'nps', 'ces'], default: 'csat' },
    question: { type: String, default: '' },
    scale: { type: Number, enum: [5, 10], default: 5 },
    trigger: { type: String, enum: ['on_close', 'on_resolution', 'manual'], default: 'on_close' },
    isActive: { type: Boolean, default: true },
    sendTo: { type: String, enum: ['user', 'org'], default: 'user' },
    followUpAfterHours: { type: Number, default: 0 },
    customMessage: { type: String, default: '' },
    emailTemplate: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

surveySchema.index({ company: 1, type: 1, isActive: 1 });

module.exports = mongoose.model('Survey', surveySchema);