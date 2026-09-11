const Task = require('../models/core/Task');
const TaskActivity = require('../models/core/TaskActivity');
const TaskWatcher = require('../models/core/TaskWatcher');
const TaskRelationship = require('../models/core/TaskRelationship');
const NotificationEvent = require('../models/core/NotificationEvent');
const { nextNumber } = require('./numbering.service');
const { assertTransition, TASK_TRANSITIONS, allowedTransitions } = require('./stateMachine.service');
const auditService = require('./audit.service');
const { getIO } = require('../config/socket');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const TYPE_PREFIXES = {
  incident: 'INC',
  problem: 'PRB',
  change: 'CHG',
  request: 'REQ',
  task: 'TASK',
  subtask: 'TASK',
};

const TASK_TERMINAL = ['closed', 'cancelled'];
const TASK_FINAL = ['resolved', 'closed', 'cancelled'];

function emitToTaskRoom(taskId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`task:${taskId}`).emit(event, data);
  } catch (_) {}
}

async function createActivity({ tenantId, taskId, type, content, actor, actorName, isPublic = true, fieldChanged, oldValue, newValue }) {
  const activity = await TaskActivity.create({
    tenantId, taskId, type, content, actor, actorName,
    isPublic, fieldChanged, oldValue, newValue,
  });
  emitToTaskRoom(taskId, 'activity:new', activity);
  return activity;
}

async function createNotification({ tenantId, taskId, eventType, recipientId, channel = 'in_app', subject, body }) {
  return NotificationEvent.create({
    tenantId, taskId, eventType, recipientId, channel, subject, body,
  }).catch((err) => logger.error('Notification create failed', { error: err.message }));
}

async function addWatcher(taskId, userId, tenantId, addedBy) {
  const watcher = await TaskWatcher.findOneAndUpdate(
    { tenantId, taskId, userId },
    { $setOnInsert: { tenantId, taskId, userId, addedBy } },
    { upsert: true, new: true }
  );
  return watcher;
}

async function removeWatcher(taskId, userId, tenantId) {
  return TaskWatcher.findOneAndDelete({ tenantId, taskId, userId });
}

async function getWatchers(taskId, tenantId) {
  return TaskWatcher.find({ tenantId, taskId }).populate('userId', 'name email avatar');
}

async function createRelationship({ tenantId, sourceTaskId, targetTaskId, relationshipType, createdBy }) {
  if (String(sourceTaskId) === String(targetTaskId)) {
    throw new ApiError(400, 'Cannot create relationship between a task and itself');
  }
  const rel = await TaskRelationship.findOneAndUpdate(
    { tenantId, sourceTaskId, targetTaskId, relationshipType },
    { $setOnInsert: { tenantId, sourceTaskId, targetTaskId, relationshipType, createdBy } },
    { upsert: true, new: true }
  );
  return rel;
}

async function removeRelationship(relId, tenantId) {
  return TaskRelationship.findOneAndDelete({ _id: relId, tenantId });
}

async function getRelationships(taskId, tenantId) {
  const outgoing = await TaskRelationship.find({ tenantId, sourceTaskId: taskId })
    .populate('targetTaskId', 'number title state priority assignedTo');
  const incoming = await TaskRelationship.find({ tenantId, targetTaskId: taskId })
    .populate('sourceTaskId', 'number title state priority assignedTo');
  return { outgoing, incoming };
}

async function createTask({ tenantId, title, description, type = 'task', priority = 'medium', impact, urgency, category, subcategory, assignmentGroup, assignedTo, requestedBy, requestedFor, parentTask, company, department, location, service, serviceOffering, configurationItem, dueDate, tags, isMajorIncident, metadata }) {
  const prefix = TYPE_PREFIXES[type] || 'TASK';
  const number = await nextNumber(tenantId, prefix);

  const task = await Task.create({
    tenantId, number, title, description, type, priority, impact, urgency,
    category, subcategory, assignmentGroup, assignedTo, requestedBy, requestedFor,
    parentTask, company, department, location, service, serviceOffering, configurationItem,
    dueDate, tags, isMajorIncident, metadata,
    createdBy: requestedBy,
  });

  await createActivity({
    tenantId, taskId: task._id, type: 'system',
    content: `Task ${number} created`, actor: requestedBy,
    actorName: '', isPublic: false,
  });

  if (assignedTo && String(assignedTo) !== String(requestedBy)) {
    await addWatcher(task._id, assignedTo, tenantId, requestedBy);
    await createNotification({
      tenantId, taskId: task._id, eventType: 'task.assigned',
      recipientId: assignedTo, subject: `Task ${number} assigned to you`,
      body: `You have been assigned task ${number}: ${title}`,
    });
  }

  if (assignmentGroup) {
    await createNotification({
      tenantId, taskId: task._id, eventType: 'task.group_assigned',
      recipientId: assignmentGroup, subject: `Task ${number} assigned to group`,
      body: `Task ${number} has been assigned to your group: ${title}`,
    });
  }

  emitToTaskRoom(task._id, 'task:created', task);
  return task;
}

async function getTask(taskId, tenantId) {
  const task = await Task.findOne({ _id: taskId, tenantId })
    .populate('assignedTo', 'name email avatar')
    .populate('requestedBy', 'name email')
    .populate('requestedFor', 'name email')
    .populate('assignmentGroup', 'name')
    .populate('company', 'name')
    .populate('department', 'name')
    .populate('parentTask', 'number title state');
  if (!task) throw new ApiError(404, 'Task not found');
  return task;
}

async function listTasks({ tenantId, state, type, priority, assignedTo, assignmentGroup, requestedBy, category, page = 1, limit = 50, sort = '-createdAt', search, includeDeleted = false }) {
  const query = { tenantId };
  if (!includeDeleted) query.deletedAt = null;
  if (state) query.state = Array.isArray(state) ? { $in: state } : state;
  if (type) query.type = Array.isArray(type) ? { $in: type } : type;
  if (priority) query.priority = Array.isArray(priority) ? { $in: priority } : priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (assignmentGroup) query.assignmentGroup = assignmentGroup;
  if (requestedBy) query.requestedBy = requestedBy;
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { number: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate('assignedTo', 'name email avatar')
      .populate('requestedBy', 'name email')
      .populate('assignmentGroup', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Task.countDocuments(query),
  ]);

  return { tasks, total, page, limit, pages: Math.ceil(total / limit) };
}

async function updateTask(taskId, tenantId, updates, actorId) {
  const task = await Task.findOne({ _id: taskId, tenantId });
  if (!task) throw new ApiError(404, 'Task not found');

  const allowedFields = [
    'title', 'description', 'priority', 'impact', 'urgency', 'category', 'subcategory',
    'assignmentGroup', 'assignedTo', 'department', 'location', 'service', 'serviceOffering',
    'configurationItem', 'dueDate', 'tags', 'metadata', 'isMajorIncident',
  ];

  const changes = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined && JSON.stringify(updates[key]) !== JSON.stringify(task[key])) {
      changes[key] = { from: task[key], to: updates[key] };
      task[key] = updates[key];
    }
  }

  task.updatedBy = actorId;
  await task.save();

  if (changes.assignedTo && changes.assignedTo.to) {
    await addWatcher(task._id, changes.assignedTo.to, tenantId, actorId);
    await createNotification({
      tenantId, taskId: task._id, eventType: 'task.assigned',
      recipientId: changes.assignedTo.to, subject: `Task ${task.number} assigned to you`,
      body: `You have been assigned task ${task.number}: ${task.title}`,
    });
  }

  if (Object.keys(changes).length > 0) {
    for (const [field, { from, to }] of Object.entries(changes)) {
      await createActivity({
        tenantId, taskId: task._id, type: 'field_update',
        content: `Changed ${field}`, actor: actorId, actorName: '',
        fieldChanged: field, oldValue: from, newValue: to,
        isPublic: false,
      });
    }
  }

  emitToTaskRoom(task._id, 'task:updated', task);
  return task;
}

async function transitionTask(taskId, tenantId, newState, actorId, comment) {
  const task = await Task.findOne({ _id: taskId, tenantId });
  if (!task) throw new ApiError(404, 'Task not found');

  const oldState = task.state;
  assertTransition('task', oldState, newState);

  task.state = newState;
  task.updatedBy = actorId;

  if (newState === 'resolved' && !task.resolvedAt) {
    task.resolvedAt = new Date();
  }
  if (newState === 'closed' && !task.closedAt) {
    task.closedAt = new Date();
  }
  if (TASK_TERMINAL.includes(newState)) {
    task.closedAt = task.closedAt || new Date();
  }

  await task.save();

  await createActivity({
    tenantId, taskId: task._id, type: 'state_change',
    content: `Status changed from ${oldState} to ${newState}${comment ? ': ' + comment : ''}`,
    actor: actorId, actorName: '', isPublic: true,
    fieldChanged: 'state', oldValue: oldState, newValue: newState,
  });

  if (comment) {
    await createActivity({
      tenantId, taskId: task._id, type: 'comment',
      content: comment, actor: actorId, actorName: '', isPublic: true,
    });
  }

  const watchers = await TaskWatcher.find({ tenantId, taskId: task._id });
  for (const w of watchers) {
    if (String(w.userId) !== String(actorId)) {
      await createNotification({
        tenantId, taskId: task._id, eventType: 'task.state_changed',
        recipientId: w.userId, subject: `Task ${task.number} state changed`,
        body: `Task ${task.number} moved from ${oldState} to ${newState}`,
      });
    }
  }

  emitToTaskRoom(task._id, 'task:transitioned', { task, oldState, newState });
  return task;
}

async function addComment(taskId, tenantId, { content, actorId, isPublic = true }) {
  const task = await Task.findOne({ _id: taskId, tenantId });
  if (!task) throw new ApiError(404, 'Task not found');
  if (TASK_TERMINAL.includes(task.state)) throw new ApiError(422, 'Cannot add comment to terminal task');

  const activity = await createActivity({
    tenantId, taskId: task._id, type: 'comment',
    content, actor: actorId, actorName: '', isPublic,
  });

  const watchers = await TaskWatcher.find({ tenantId, taskId: task._id });
  for (const w of watchers) {
    if (String(w.userId) !== String(actorId)) {
      await createNotification({
        tenantId, taskId: task._id, eventType: 'task.commented',
        recipientId: w.userId, subject: `New comment on task ${task.number}`,
        body: `A new comment was added to task ${task.number}`,
      });
    }
  }

  emitToTaskRoom(task._id, 'activity:new', activity);
  return activity;
}

async function softDeleteTask(taskId, tenantId, actorId) {
  const task = await Task.findOne({ _id: taskId, tenantId });
  if (!task) throw new ApiError(404, 'Task not found');
  task.deletedAt = new Date();
  task.updatedBy = actorId;
  await task.save();

  await createActivity({
    tenantId, taskId: task._id, type: 'system',
    content: 'Task soft-deleted', actor: actorId, actorName: '', isPublic: false,
  });

  emitToTaskRoom(task._id, 'task:deleted', { taskId: task._id });
  return task;
}

async function restoreTask(taskId, tenantId, actorId) {
  const task = await Task.findOne({ _id: taskId, tenantId, deletedAt: { $ne: null } });
  if (!task) throw new ApiError(404, 'Deleted task not found');
  task.deletedAt = null;
  task.updatedBy = actorId;
  await task.save();

  await createActivity({
    tenantId, taskId: task._id, type: 'system',
    content: 'Task restored', actor: actorId, actorName: '', isPublic: false,
  });

  return task;
}

async function getTaskStats(tenantId) {
  const [byState, byType, byPriority] = await Promise.all([
    Task.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$state', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
  ]);
  return { byState, byType, byPriority };
}

module.exports = {
  createTask,
  getTask,
  listTasks,
  updateTask,
  transitionTask,
  addComment,
  softDeleteTask,
  restoreTask,
  getTaskStats,
  addWatcher,
  removeWatcher,
  getWatchers,
  createRelationship,
  removeRelationship,
  getRelationships,
  createActivity,
  TASK_TERMINAL,
  TASK_FINAL,
};
