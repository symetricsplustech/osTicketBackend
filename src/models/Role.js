const mongoose = require('mongoose');

const PERMISSIONS = [
  'tickets.view',
  'tickets.create',
  'tickets.edit',
  'tickets.assign',
  'tickets.transfer',
  'tickets.close',
  'tickets.delete',
  'tickets.reply',
  'tickets.note',
  'tickets.tasks',
  'users.manage',
  'kb.manage',
  'canned.manage',
  'admin.manage',
  'orgs.manage',
];

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    isAdmin: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

roleSchema.index({ company: 1, name: 1 }, { unique: true });

roleSchema.statics.PERMISSIONS = PERMISSIONS;

module.exports = mongoose.model('Role', roleSchema);
