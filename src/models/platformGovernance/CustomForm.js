const mongoose = require('mongoose');
const customFormSchema = new mongoose.Schema({
  name: { type: String, required: true },
  entityType: { type: String, enum: ['ticket', 'asset', 'lead', 'hr_case', 'work_order', 'custom'], default: 'ticket' },
  fields: [{
    label: String,
    name: String,
    type: { type: String, enum: ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'] },
    options: [String],
    required: Boolean,
    condition: { field: String, operator: { type: String, enum: ['equals', 'not_equals', 'contains'] }, value: String },
    order: Number,
  }],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  version: { type: Number, default: 1 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CustomForm || mongoose.model('CustomForm', customFormSchema);
