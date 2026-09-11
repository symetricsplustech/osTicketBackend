const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: String, default: 'user' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  body: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.model('ChatMessage', schema);
