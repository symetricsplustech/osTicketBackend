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
    password: { type: String },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    isRegistered: { type: Boolean, default: false },
    emailConfirmed: { type: Boolean, default: false },
    confirmationToken: { type: String },
    confirmationExpires: { type: Date },
    resetToken: { type: String },
    resetExpires: { type: Date },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    lastLogin: { type: Date },
    notes: { type: String, default: '' },
    avatar: { type: String, default: '' },
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
  return obj;
};

module.exports = mongoose.model('User', userSchema);
