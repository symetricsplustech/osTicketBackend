const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const defaultSettings = {
  company: {
    name: 'My Support Center',
    phone: '',
    email: '',
    url: '',
    logo: '',
  },
  system: {
    defaultDept: '',
    defaultTicketNumberFormat: '0',
    defaultPriority: 'Normal',
    defaultSla: '',
    dateFormat: 'dd-MM-yyyy',
    timeFormat: '24h',
    autoLockTickets: true,
    ticketLockMinutes: 5,
    maxOpenTickets: 0,
    allowTicketReopen: true,
    enableKb: true,
    enableAnnouncements: true,
    registrationEnabled: true,
    emailToTicket: '',
  },
  tickets: {
    autoResponder: true,
    autoAssign: true,
    notifyNewTicketToDept: true,
    notifyNewTicketToTeam: true,
    notifyAssignment: true,
    notifyTransfer: true,
    notifyReplyToUser: true,
    closedTicketEmail: true,
    overdueNotice: true,
    // Resolved → Closed waiting period: auto-close resolved tickets with no
    // customer reply after this many hours (0/disabled = never auto-close).
    autoCloseEnabled: true,
    autoCloseAfterHours: 72,
  },
  emails: {
    banList: [],
  },
  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    fromEmail: '',
    fromName: '',
  },
  autoresponder: {
    enabled: true,
    subject: 'Ticket received - [ticket.number]',
    body:
      'Dear [user.name],\n\nThank you for contacting us. Your ticket [ticket.number] has been created and a member of our team will get back to you shortly.\n\nRegards,\nSupport Team',
  },
  alerts: {
    notifyNewTicket: true,
    notifyMessage: true,
    notifyAssignment: true,
    notifyTransfer: true,
    notifyOverdue: true,
    notifyEscalation: true,
    notifyClosed: true,
  },
  auth: {
    registrationEnabled: true,
    emailVerification: false,
    allowGuestTickets: true,
    passwordMinLength: 8,
    sessionTimeoutMinutes: 0,
    lockoutEnabled: false,
    maxLoginAttempts: 5,
  },
  schedules: {
    timezone: 'UTC',
    businessHoursEnabled: false,
    monday: { enabled: true, open: '09:00', close: '17:00' },
    tuesday: { enabled: true, open: '09:00', close: '17:00' },
    wednesday: { enabled: true, open: '09:00', close: '17:00' },
    thursday: { enabled: true, open: '09:00', close: '17:00' },
    friday: { enabled: true, open: '09:00', close: '17:00' },
    saturday: { enabled: false, open: '09:00', close: '17:00' },
    sunday: { enabled: false, open: '09:00', close: '17:00' },
    enforceBusinessHours: false,
  },
  // ---- Enterprise: engines configuration ----
  routing: {
    algorithm: 'skill_based', // none | round_robin | least_workload | skill_based | availability
  },
  csat: {
    enabled: true,
    ratingScale: 5,
    npsEnabled: true,
  },
  ai: {
    enabled: true,
    autoResolveEnabled: false,
    autoResolveThreshold: 0.8,
    qaEnabled: true,
  },
  automation: {
    slaBreachNotify: true,
    slaWarningNotify: false,
    waitingForCustomerNotify: true,
  },
};

systemSettingSchema.statics.defaultSettings = defaultSettings;

systemSettingSchema.statics.getSettings = async function () {
  const docs = await this.find();
  const merged = JSON.parse(JSON.stringify(defaultSettings));
  for (const doc of docs) {
    const keys = doc.key.split('.');
    let target = merged;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] = target[keys[i]] || {};
    }
    target[keys[keys.length - 1]] = doc.value;
  }
  return merged;
};

systemSettingSchema.statics.setSetting = async function (key, value) {
  return this.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true });
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
