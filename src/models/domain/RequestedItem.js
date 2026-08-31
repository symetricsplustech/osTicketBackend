const mongoose = require('mongoose');
const requestedItemSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  catalogItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCatalogItem' },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fulfilledFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'in_progress', 'fulfilled', 'cancelled'], default: 'pending' },
  formData: mongoose.Schema.Types.Mixed,
  fulfillmentTasks: [{ title: String, status: { type: String, enum: ['pending', 'completed'], default: 'pending' }, completedAt: Date }],
  fulfilledAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RequestedItem || mongoose.model('RequestedItem', requestedItemSchema);
