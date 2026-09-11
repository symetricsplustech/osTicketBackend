const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    number: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['incident', 'problem', 'change', 'request', 'task', 'subtask'],
      default: 'task',
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: ['new', 'open', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'resolved', 'closed', 'cancelled'],
      default: 'new',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'planning'],
      default: 'medium',
      index: true,
    },
    impact: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    urgency: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    category: { type: String, default: '', index: true },
    subcategory: { type: String, default: '' },
    assignmentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    location: { type: String, default: '' },
    service: { type: mongoose.Schema.Types.ObjectId, default: null },
    serviceOffering: { type: mongoose.Schema.Types.ObjectId, default: null },
    configurationItem: { type: mongoose.Schema.Types.ObjectId, default: null },
    resolution: { type: String, default: '' },
    resolutionCode: { type: String, default: '' },
    dueDate: { type: Date, default: null, index: true },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    slaPausedAt: { type: Date, default: null },
    totalPauseDuration: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isMajorIncident: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

taskSchema.index({ tenantId: 1, state: 1 });
taskSchema.index({ tenantId: 1, assignedTo: 1, state: 1 });
taskSchema.index({ tenantId: 1, assignmentGroup: 1, state: 1 });
taskSchema.index({ tenantId: 1, type: 1, state: 1 });
taskSchema.index({ tenantId: 1, priority: 1 });
taskSchema.index({ title: 'text', description: 'text', number: 'text' });

taskSchema.pre('save', function (next) {
  if (this.isNew && !this.number) {
    return next(new Error('Task number must be generated before save'));
  }
  next();
});

taskSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Task', taskSchema);
