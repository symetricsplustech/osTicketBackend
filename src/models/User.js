const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: '' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    password: { type: String },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    // Hierarchy: company employees vs external customers (MD hierarchy).
    // External org managers approve their org's requests (org_manager steps).
    userType: { type: String, enum: ['employee', 'external'], default: 'employee', index: true },
    orgRole: { type: String, enum: ['member', 'manager'], default: 'member' },
    isRegistered: { type: Boolean, default: false },
    emailConfirmed: { type: Boolean, default: false },
    confirmationToken: { type: String },
    confirmationExpires: { type: Date },
    // ---- Self-service support-email change (email-to-ticket sender address) ----
    // Keeps the same User _id so historic tickets stay linked in the portal.
    pendingEmail: { type: String, default: '', lowercase: true, trim: true },
    pendingEmailToken: { type: String, default: null },
    pendingEmailExpires: { type: Date, default: null },
    resetToken: { type: String },
    resetExpires: { type: Date },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorBackupCodes: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    permissions: { type: [String], default: [] },
    lastLogin: { type: Date },
    notes: { type: String, default: '' },
    avatar: { type: String, default: '' },
    // ---- Enterprise: Customer 360 ----
    tier: { type: String, enum: ['standard', 'priority', 'enterprise'], default: 'standard' },
    locale: { type: String, default: '' },
    timezone: { type: String, default: '' },
    health: {
      score: { type: Number, default: null },
      signals: { type: mongoose.Schema.Types.Mixed, default: {} },
      lastComputed: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.confirmationToken;
  delete obj.confirmationExpires;
  delete obj.resetToken;
  delete obj.resetExpires;
  delete obj.pendingEmailToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
