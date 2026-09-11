const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'open',
        'investigation',
        'known_error',
        'workaround',
        'root_cause',
        'fix_in_progress',
        'fixed',
        'closed',
      ],
      default: 'open',
    },
    linkedIncidents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Incident' }],
    linkedChanges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Change' }],
    linkedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
    rootCause: { type: String, default: '' },
    workaround: { type: String, default: '' },
    permanentSolution: { type: String, default: '' },
    postmortem: { type: String, default: '' },
    knownError: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Emergency'],
      default: 'Normal',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

problemSchema.index({ company: 1, status: 1 });
problemSchema.statics.STATUSES = [
  'open',
  'investigation',
  'known_error',
  'workaround',
  'root_cause',
  'fix_in_progress',
  'fixed',
  'closed',
];

module.exports = mongoose.model('Problem', problemSchema);