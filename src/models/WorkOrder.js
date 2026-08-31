const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    number: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['installation', 'repair', 'maintenance', 'inspection', 'consultation', 'other'], required: true },
    status: { type: String, enum: ['draft', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'], default: 'draft' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    scheduledDate: { type: Date, default: null },
    scheduledEnd: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    location: {
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    tasks: [{
      title: { type: String, required: true },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date, default: null },
      notes: { type: String, default: '' },
    }],
    parts: [{
      name: String,
      quantity: Number,
      cost: Number,
    }],
    timeEntries: [{
      agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
      date: Date,
      hours: Number,
      description: String,
    }],
    attachments: { type: [String], default: [] },
    customerSignature: { type: String, default: '' },
    serviceReport: { type: String, default: '' },
    totalCost: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

workOrderSchema.index({ company: 1, status: 1 });
workOrderSchema.index({ company: 1, assignedTo: 1 });
workOrderSchema.index({ company: 1, scheduledDate: 1 });
workOrderSchema.index({ number: 1 });

module.exports = mongoose.model('WorkOrder', workOrderSchema);
