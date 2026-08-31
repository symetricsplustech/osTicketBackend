const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    company_name: { type: String, default: '' },
    title: { type: String, default: '' },
    website: { type: String, default: '' },
    source: { type: String, enum: ['website', 'referral', 'cold_call', 'advertisement', 'social_media', 'partner', 'other'], default: 'other' },
    status: { type: String, enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'], default: 'new' },
    score: { type: Number, default: 0 },
    rating: { type: String, enum: ['hot', 'warm', 'cold'], default: 'cold' },
    industry: { type: String, default: '' },
    employees: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    convertedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

leadSchema.index({ company: 1, status: 1 });
leadSchema.index({ company: 1, assignedTo: 1 });
leadSchema.index({ name: 'text', email: 'text', company_name: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
