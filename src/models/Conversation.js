const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  channel: { type: String, default: 'chat' },
  guestName: { type: String, default: '' },
  guestEmail: { type: String, default: '' },
  guestPhone: { type: String, default: '' },
  subject: { type: String, default: '' },
  status: { type: String, default: 'open' },
}, { timestamps: true });
module.exports = mongoose.model('Conversation', schema);
