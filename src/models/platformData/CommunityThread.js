const mongoose = require('mongoose');
const oid = { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' };
const communityThreadSchema = new mongoose.Schema({
  title: { type: String, required: true }, body: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answers: [{ author: mongoose.Schema.Types.ObjectId, body: String, votes: { type: Number, default: 0 }, accepted: Boolean }],
  moderated: { type: Boolean, default: false },
  status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.CommunityThread || mongoose.model('CommunityThread', communityThreadSchema);
