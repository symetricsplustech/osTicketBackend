const mongoose = require('mongoose');
const backupTestSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now }, scope: String, result: { type: String, enum: ['pass', 'fail'], default: 'pass' },
  rtoMinutes: Number, notes: String, testedBy: mongoose.Schema.Types.ObjectId,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.BackupTest || mongoose.model('BackupTest', backupTestSchema);
