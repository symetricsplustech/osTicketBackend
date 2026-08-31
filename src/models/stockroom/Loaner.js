const mongoose = require('mongoose');
const loanerSchema = new mongoose.Schema({
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  loanedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loanDate: { type: Date, default: Date.now },
  expectedReturnDate: Date,
  actualReturnDate: Date,
  status: { type: String, enum: ['active', 'returned', 'overdue'], default: 'active' },
  condition: String,
  notes: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
loanerSchema.index({ asset: 1 });
loanerSchema.index({ status: 1 });
module.exports = mongoose.models.Loaner || mongoose.model('Loaner', loanerSchema);
