/**
 * Validation schemas for Task Engine mutations.
 * Uses a lightweight inline validator (no external deps needed).
 * Each schema defines required fields, types, enums, and constraints.
 */

const ApiError = require('../utils/ApiError');

function validate(schema, data) {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value === undefined || value === null) continue;

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    }
    if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${field} must be a number`);
    }
    if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
    if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    }
    if (rules.type === 'date' && isNaN(Date.parse(value))) {
      errors.push(`${field} must be a valid date`);
    }
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${field} must be at most ${rules.maxLength} characters`);
    }
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }
  }
  if (errors.length > 0) throw new ApiError(400, errors.join('; '));
}

const CREATE_TASK = {
  title: { required: true, type: 'string', minLength: 1, maxLength: 500 },
  description: { type: 'string' },
  type: { type: 'string', enum: ['incident', 'problem', 'change', 'request', 'task', 'subtask'] },
  priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'planning'] },
  impact: { type: 'string', enum: ['high', 'medium', 'low'] },
  urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
  category: { type: 'string' },
  subcategory: { type: 'string' },
  assignmentGroup: { type: 'string' },
  assignedTo: { type: 'string' },
  requestedFor: { type: 'string' },
  parentTask: { type: 'string' },
  department: { type: 'string' },
  location: { type: 'string' },
  dueDate: { type: 'date' },
  tags: { type: 'array' },
  isMajorIncident: { type: 'boolean' },
};

const UPDATE_TASK = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  description: { type: 'string' },
  priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'planning'] },
  impact: { type: 'string', enum: ['high', 'medium', 'low'] },
  urgency: { type: 'string', enum: ['high', 'medium', 'low'] },
  category: { type: 'string' },
  subcategory: { type: 'string' },
  assignmentGroup: { type: 'string' },
  assignedTo: { type: 'string' },
  department: { type: 'string' },
  location: { type: 'string' },
  dueDate: { type: 'date' },
  tags: { type: 'array' },
  isMajorIncident: { type: 'boolean' },
};

const TRANSITION_TASK = {
  state: { required: true, type: 'string', enum: ['new', 'open', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'resolved', 'closed', 'cancelled'] },
  comment: { type: 'string' },
};

const ADD_COMMENT = {
  content: { required: true, type: 'string', minLength: 1 },
  isPublic: { type: 'boolean' },
};

const ADD_WATCHER = {
  userId: { required: true, type: 'string' },
};

const ADD_RELATIONSHIP = {
  targetTaskId: { required: true, type: 'string' },
  relationshipType: { required: true, type: 'string', enum: ['relates_to', 'blocks', 'blocked_by', 'duplicates', 'caused_by', 'child_of', 'parent_of'] },
};

const CREATE_APPROVAL = {
  taskId: { required: true, type: 'string' },
  type: { type: 'string', enum: ['individual', 'group', 'sequential', 'parallel'] },
  approver: { type: 'string' },
  approvalGroup: { type: 'string' },
  approvers: { type: 'array' },
  requiredApprovals: { type: 'number', min: 1 },
  dueAt: { type: 'date' },
};

const DECIDE_APPROVAL = {
  decision: { required: true, type: 'string', enum: ['approved', 'rejected'] },
  note: { type: 'string' },
};

module.exports = {
  validate,
  schemas: {
    CREATE_TASK,
    UPDATE_TASK,
    TRANSITION_TASK,
    ADD_COMMENT,
    ADD_WATCHER,
    ADD_RELATIONSHIP,
    CREATE_APPROVAL,
    DECIDE_APPROVAL,
  },
};
