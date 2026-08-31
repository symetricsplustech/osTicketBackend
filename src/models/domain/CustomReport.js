const mongoose = require('mongoose');
const customReportSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  module: { type: String, enum: ['tickets', 'crm', 'hr', 'projects', 'fieldservice', 'analytics'], required: true },
  type: { type: String, enum: ['table', 'chart'], default: 'table' },
  chartType: { type: String, enum: ['bar', 'line', 'pie', 'area', 'scatter', 'doughnut'] },
  filters: mongoose.Schema.Types.Mixed,
  groupBy: String,
  metrics: [{ field: String, aggregation: String }],
  columns: [String],
  sortBy: String,
  sortOrder: { type: String, enum: ['asc', 'desc'], default: 'desc' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.CustomReport || mongoose.model('CustomReport', customReportSchema);
