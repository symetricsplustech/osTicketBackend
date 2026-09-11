/**
 * SLA timer service — start, pause, resume, breach detection, notification.
 * Uses the existing sla.service for business-hours calculation.
 */
const TaskSLA = require('../models/core/TaskSLA');
const NotificationEvent = require('../models/core/NotificationEvent');
const { getIO } = require('../config/socket');
const logger = require('../utils/logger');

function emitToTaskRoom(taskId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`task:${taskId}`).emit(event, data);
  } catch (_) {}
}

async function startSla({ tenantId, taskId, slaPlanId, name, type, dueAt }) {
  const sla = await TaskSLA.create({
    tenantId, taskId, slaPlanId, name, type, dueAt,
    status: 'active', startedAt: new Date(),
  });
  emitToTaskRoom(taskId, 'sla:started', sla);
  return sla;
}

async function pauseSla(slaId, tenantId) {
  const sla = await TaskSLA.findOne({ _id: slaId, tenantId });
  if (!sla || sla.status !== 'active') return null;
  sla.status = 'paused';
  sla.pausedAt = new Date();
  sla.lastPauseStart = new Date();
  sla.pauseCount += 1;
  await sla.save();
  emitToTaskRoom(sla.taskId, 'sla:paused', sla);
  return sla;
}

async function resumeSla(slaId, tenantId) {
  const sla = await TaskSLA.findOne({ _id: slaId, tenantId });
  if (!sla || sla.status !== 'paused') return null;
  if (sla.lastPauseStart) {
    const pauseMs = Date.now() - new Date(sla.lastPauseStart).getTime();
    sla.totalPauseDurationMs += pauseMs;
  }
  sla.status = 'active';
  sla.pausedAt = null;
  sla.resumedAt = new Date();
  sla.lastPauseStart = null;
  await sla.save();
  emitToTaskRoom(sla.taskId, 'sla:resumed', sla);
  return sla;
}

async function achieveSla(slaId, tenantId) {
  const sla = await TaskSLA.findOne({ _id: slaId, tenantId });
  if (!sla || sla.status !== 'active') return null;
  sla.status = 'achieved';
  sla.completedAt = new Date();
  await sla.save();
  emitToTaskRoom(sla.taskId, 'sla:achieved', sla);
  return sla;
}

async function breachSla(slaId, tenantId) {
  const sla = await TaskSLA.findOne({ _id: slaId, tenantId });
  if (!sla || !['active', 'paused'].includes(sla.status)) return null;
  sla.status = 'breached';
  sla.breached = true;
  sla.breachedAt = new Date();
  sla.completedAt = new Date();
  await sla.save();

  await NotificationEvent.create({
    tenantId, taskId: sla.taskId, eventType: 'sla.breached',
    recipientId: sla.taskId, subject: `SLA breached: ${sla.name}`,
    body: `SLA "${sla.name}" for task has been breached.`,
    channel: 'in_app',
  }).catch(() => {});

  emitToTaskRoom(sla.taskId, 'sla:breached', sla);
  return sla;
}

async function cancelSla(slaId, tenantId) {
  const sla = await TaskSLA.findOne({ _id: slaId, tenantId });
  if (!sla) return null;
  sla.status = 'cancelled';
  sla.completedAt = new Date();
  await sla.save();
  return sla;
}

async function getSlaByTask(taskId, tenantId) {
  return TaskSLA.find({ tenantId, taskId }).sort({ createdAt: -1 });
}

async function getActiveSlaForTask(taskId, tenantId) {
  return TaskSLA.find({ tenantId, taskId, status: { $in: ['active', 'paused'] } });
}

async function checkBreaches(tenantId) {
  const now = new Date();
  const breached = await TaskSLA.find({
    tenantId, status: 'active', dueAt: { $lte: now },
  });
  for (const sla of breached) {
    await breachSla(sla._id, tenantId);
  }
  return breached.length;
}

module.exports = {
  startSla, pauseSla, resumeSla, achieveSla, breachSla, cancelSla,
  getSlaByTask, getActiveSlaForTask, checkBreaches,
};
