const mongoose = require('mongoose');
const connectorExecLogSchema = new mongoose.Schema({
  connectorSystem: String, action: String,
  ok: Boolean, detail: String, correlationId: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.ConnectorExecLog || mongoose.model('ConnectorExecLog', connectorExecLogSchema);
