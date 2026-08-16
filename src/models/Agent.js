const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const agentSchema = new mongoose.Schema(
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
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    password: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissions: { type: [String], default: [] },
    departments: [
      {
        department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    signature: { type: String, default: '' },
    notes: { type: String, default: '' },
    lastLogin: { type: Date },
    avatar: { type: String, default: '' },
    lockedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    // ---- Enterprise: Workforce management ----
    skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    presence: {
      type: String,
      enum: ['online', 'away', 'busy', 'offline', 'on_break', 'in_meeting', 'dnd'],
      default: 'offline',
      index: true,
    },
    presenceChangedAt: { type: Date, default: Date.now },
    capacity: { type: Number, default: 10 },
    timezone: { type: String, default: '' },
    qaScore: { type: Number, default: null },
notificationPrefs: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

agentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

agentSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

agentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Agent', agentSchema);
