const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    dueDate: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
