const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const maintenanceFlagSchema = new mongoose.Schema({
  enabled: Boolean, message: String, setBy: oid,
  tenantId: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
}, { timestamps: true });
module.exports = mongoose.models.MaintenanceFlag || mongoose.model('MaintenanceFlag', maintenanceFlagSchema);
