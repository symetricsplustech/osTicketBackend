const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminSchema = new mongoose.Schema(
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
    password: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'support'], default: 'super_admin' },
    platformRole: { type: String, enum: ['platform_owner', 'platform_administrator', 'platform_support_administrator', 'platform_security_administrator', 'platform_auditor'], default: 'platform_owner', index: true },
    isActive: { type: Boolean, default: true },
    permissions: { type: [String], default: [] },
    moduleKeys: { type: [String], default: [] },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    allowedIps: { type: [String], default: [] },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

superAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

superAdminSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

superAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactorSecret;
  return obj;
};

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
