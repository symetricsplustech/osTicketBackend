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

const CREATE_INCIDENT = {
  title: { required: true, type: 'string' },
  description: { type: 'string' },
  severity: { type: 'string', enum: ['Sev1', 'Sev2', 'Sev3', 'Sev4'] },
  priority: { type: 'string', enum: ['Low', 'Normal', 'High', 'Emergency'] },
  impact: { type: 'string', enum: ['1', '2', '3', '4'] },
  urgency: { type: 'string', enum: ['1', '2', '3', '4'] },
  category: { type: 'string' },
  subcategory: { type: 'string' },
  caller: { type: 'string' },
  affectedUser: { type: 'string' },
  assignmentGroup: { type: 'string' },
  assignedTo: { type: 'string' },
};

const UPDATE_INCIDENT = {
  title: { type: 'string' },
  description: { type: 'string' },
  severity: { type: 'string', enum: ['Sev1', 'Sev2', 'Sev3', 'Sev4'] },
  priority: { type: 'string', enum: ['Low', 'Normal', 'High', 'Emergency'] },
  impact: { type: 'string', enum: ['1', '2', '3', '4'] },
  urgency: { type: 'string', enum: ['1', '2', '3', '4'] },
  category: { type: 'string' },
  subcategory: { type: 'string' },
  assignedTo: { type: 'string' },
  assignmentGroup: { type: 'string' },
};

const TRANSITION_INCIDENT = {
  status: { required: true, type: 'string', enum: ['new', 'in_progress', 'on_hold_caller', 'on_hold_change', 'on_hold_problem', 'on_hold_vendor', 'resolved', 'closed', 'canceled', 'investigating', 'identified', 'monitoring'] },
  notes: { type: 'string' },
};

const ASSIGN_INCIDENT = {
  assignedTo: { type: 'string' },
  assignmentGroup: { type: 'string' },
  commander: { type: 'string' },
  type: { type: 'string', enum: ['initial', 'reassignment', 'escalation', 'delegation'] },
  reason: { type: 'string' },
};

const RESOLVE_INCIDENT = {
  resolutionCode: { required: true, type: 'string', enum: ['fixed', 'workaround', 'duplicate', 'not_reproducible', 'not_a_bug', 'user_error', 'by_design', 'third_party', 'will_not_fix'] },
  notes: { type: 'string' },
  rootCause: { type: 'string' },
  rootCauseCategory: { type: 'string', enum: ['code_defect', 'configuration', 'infrastructure', 'third_party', 'user_error', 'process_gap', 'unknown'] },
  workaround: { type: 'string' },
};

const CREATE_INCIDENT_COMMENT = {
  message: { required: true, type: 'string' },
  type: { type: 'string', enum: ['comment', 'work_note', 'status_update'] },
};

const CREATE_MAJOR_INCIDENT_NOMINATION = {
  justification: { type: 'string' },
};

const CREATE_PIR = {
  incident: { required: true, type: 'string' },
  title: { required: true, type: 'string' },
  summary: { type: 'string' },
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
    CREATE_INCIDENT,
    UPDATE_INCIDENT,
    TRANSITION_INCIDENT,
    ASSIGN_INCIDENT,
    RESOLVE_INCIDENT,
    CREATE_INCIDENT_COMMENT,
    CREATE_MAJOR_INCIDENT_NOMINATION,
    CREATE_PIR,
  },
};
