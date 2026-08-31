const mongoose = require('mongoose');
const dashboardConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent', 'manager', 'client'], required: true },
  widgets: [{
    type: { type: String, enum: ['stat', 'chart', 'table', 'list'], required: true },
    title: String,
    metric: String,
    source: String,
    size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    position: { x: Number, y: Number },
  }],
  isDefault: { type: Boolean, default: false },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.DashboardConfig || mongoose.model('DashboardConfig', dashboardConfigSchema);
