const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const routingStateSchema = new mongoose.Schema({
  scopeKey: { type: String, unique: true }, lastIndex: { type: Number, default: 0 },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.RoutingState || mongoose.model('RoutingState', routingStateSchema);
