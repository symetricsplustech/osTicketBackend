/**
 * FulfillmentStep — individual step in a fulfillment plan.
 * Steps can be sequential or parallel, with conditions and automation.
 */
const { Schema, model } = require('mongoose');

const FulfillmentStepSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'FulfillmentPlan', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },

  // Ordering
  order: { type: Number, required: true },
  parallelGroup: { type: String },
  executionType: { type: String, enum: ['sequential', 'parallel', 'conditional'], default: 'sequential' },

  // Assignment
  assignmentGroup: { type: Schema.Types.ObjectId, ref: 'Group' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  team: { type: Schema.Types.ObjectId, ref: 'Team' },

  // Task generation
  generateTask: { type: Boolean, default: true },
  taskTitle: { type: String, trim: true },
  taskDescription: { type: String, trim: true },
  taskType: { type: String, enum: ['task', 'approval', 'notification', 'automation'], default: 'task' },

  // Automation
  isAutomated: { type: Boolean, default: false },
  automationScript: { type: String },
  webhookUrl: { type: String },

  // Conditions
  condition: { type: Schema.Types.Mixed, default: {} },
  skipCondition: { type: Schema.Types.Mixed, default: {} },

  // Dependencies
  dependsOn: [{ type: Schema.Types.ObjectId, ref: 'FulfillmentStep' }],

  // Timing
  estimatedDuration: { type: Number },
  timeoutMinutes: { type: Number },

  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

FulfillmentStepSchema.index({ tenantId: 1, planId: 1, order: 1, isDeleted: 1 });

module.exports = model('FulfillmentStep', FulfillmentStepSchema);
