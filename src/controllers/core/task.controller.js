const taskService = require('../../services/task.service');
const { validate, schemas } = require('../../middleware/validation');
const { applyFieldRestrictionsToResponse } = require('../../middleware/fieldRbac');
const ApiError = require('../../utils/ApiError');

const ok = (res, data, status = 200) => res.status(status).json(data);

exports.create = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    if (!tenantId) throw new ApiError(400, 'Tenant context required');
    validate(schemas.CREATE_TASK, req.body);

    const task = await taskService.createTask({
      tenantId,
      title: req.body.title,
      description: req.body.description,
      type: req.body.type,
      priority: req.body.priority,
      impact: req.body.impact,
      urgency: req.body.urgency,
      category: req.body.category,
      subcategory: req.body.subcategory,
      assignmentGroup: req.body.assignmentGroup,
      assignedTo: req.body.assignedTo,
      requestedBy: req.user._id,
      requestedFor: req.body.requestedFor,
      parentTask: req.body.parentTask,
      company: req.body.company || tenantId,
      department: req.body.department,
      location: req.body.location,
      service: req.body.service,
      serviceOffering: req.body.serviceOffering,
      configurationItem: req.body.configurationItem,
      dueDate: req.body.dueDate,
      tags: req.body.tags,
      isMajorIncident: req.body.isMajorIncident,
      metadata: req.body.metadata,
    });

    ok(res, task, 201);
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    if (!tenantId) throw new ApiError(400, 'Tenant context required');

    const result = await taskService.listTasks({
      tenantId,
      state: req.query.state,
      type: req.query.type,
      priority: req.query.priority,
      assignedTo: req.query.assignedTo,
      assignmentGroup: req.query.assignmentGroup,
      requestedBy: req.query.requestedBy,
      category: req.query.category,
      page: parseInt(req.query.page, 10) || 1,
      limit: Math.min(parseInt(req.query.limit, 10) || 50, 200),
      sort: req.query.sort || '-createdAt',
      search: req.query.search,
      includeDeleted: req.query.includeDeleted === 'true',
    });

    ok(res, result);
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const task = await taskService.getTask(req.params.id, tenantId);

    const [watchers, relationships] = await Promise.all([
      taskService.getWatchers(task._id, tenantId),
      taskService.getRelationships(task._id, tenantId),
    ]);

    ok(res, { ...task.toObject(), watchers, relationships });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    validate(schemas.UPDATE_TASK, req.body);
    const task = await taskService.updateTask(req.params.id, tenantId, req.body, req.user._id);
    ok(res, task);
  } catch (err) {
    next(err);
  }
};

exports.transition = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    validate(schemas.TRANSITION_TASK, req.body);
    const task = await taskService.transitionTask(req.params.id, tenantId, req.body.state, req.user._id, req.body.comment);
    ok(res, task);
  } catch (err) {
    next(err);
  }
};

exports.comment = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    validate(schemas.ADD_COMMENT, req.body);
    const activity = await taskService.addComment(req.params.id, tenantId, {
      content: req.body.content, actorId: req.user._id, isPublic: req.body.isPublic,
    });
    ok(res, activity, 201);
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    await taskService.softDeleteTask(req.params.id, tenantId, req.user._id);
    ok(res, { message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

exports.restore = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const task = await taskService.restoreTask(req.params.id, tenantId, req.user._id);
    ok(res, task);
  } catch (err) {
    next(err);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const stats = await taskService.getTaskStats(tenantId);
    ok(res, stats);
  } catch (err) {
    next(err);
  }
};

exports.allowedTransitions = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const task = await taskService.getTask(req.params.id, tenantId);
    const { allowedTransitions } = require('../../services/stateMachine.service');
    const transitions = allowedTransitions('task', task.state);
    ok(res, { from: task.state, allowed: transitions });
  } catch (err) {
    next(err);
  }
};

exports.addWatcher = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const { userId } = req.body;
    if (!userId) throw new ApiError(400, 'userId is required');
    const watcher = await taskService.addWatcher(req.params.id, userId, tenantId, req.user._id);
    ok(res, watcher, 201);
  } catch (err) {
    next(err);
  }
};

exports.removeWatcher = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    await taskService.removeWatcher(req.params.id, req.params.userId, tenantId);
    ok(res, { message: 'Watcher removed' });
  } catch (err) {
    next(err);
  }
};

exports.listWatchers = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const watchers = await taskService.getWatchers(req.params.id, tenantId);
    ok(res, watchers);
  } catch (err) {
    next(err);
  }
};

exports.addRelationship = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const { targetTaskId, relationshipType } = req.body;
    if (!targetTaskId || !relationshipType) throw new ApiError(400, 'targetTaskId and relationshipType required');
    const rel = await taskService.createRelationship({
      tenantId, sourceTaskId: req.params.id, targetTaskId, relationshipType, createdBy: req.user._id,
    });
    ok(res, rel, 201);
  } catch (err) {
    next(err);
  }
};

exports.removeRelationship = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    await taskService.removeRelationship(req.params.relId, tenantId);
    ok(res, { message: 'Relationship removed' });
  } catch (err) {
    next(err);
  }
};

exports.listRelationships = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const rels = await taskService.getRelationships(req.params.id, tenantId);
    ok(res, rels);
  } catch (err) {
    next(err);
  }
};
