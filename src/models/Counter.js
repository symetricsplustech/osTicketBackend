const mongoose = require('mongoose');

// Atomic per-tenant sequences backing NumberingService (MD §68).
// _id format: "<tenantId>:<PREFIX>" e.g. "64f...:INC".
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', counterSchema);
