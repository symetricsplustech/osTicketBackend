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
  },
  emails: {
    banList: [],
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
