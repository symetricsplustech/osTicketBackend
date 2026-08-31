const mongoose = require('mongoose');
const savedPageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  layout: [{ widget: { type: String, enum: ['stat', 'table', 'chart', 'text'] }, title: String, dataset: String, groupBy: String, text: String }],
  shared: Boolean, shareToken: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.SavedPage || mongoose.model('SavedPage', savedPageSchema);
