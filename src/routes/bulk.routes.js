const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const { hasPermission: authzHasPermission } = require('../services/authorization.service');
const { getOrgOwner, hasPermission: hasUserPerm, USER_PERMISSIONS } = require('../utils/userPermissions');
const ApiError = require('../utils/ApiError');

const router = express.Router();

const MAX_BULK = 100;

const requireCompany = (req) => {
  if (!req.companyId) throw new ApiError(403, 'A tenant membership is required for bulk operations');
  return req.companyId;
};

const agentCan = (req, perm) => req.agent && authzHasPermission(req.agent, perm);

// Bulk status change with the same transitions, SLA handling, mails, events
// and audit as the single-ticket endpoint (ticket.service.applyStatusChange).
// Agents act company-wide; customers only on their own tickets and only
// close (their open tickets) / reopen (their resolved+closed tickets).
router.post('/status', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, status, reason } = req.body;
    if (!Array.isArray(ticketIds) || !ticketIds.length || !status) {
      return res.status(400).json({ error: 'ticketIds and status required' });
    }
    if (ticketIds.length > MAX_BULK) {
      return res.status(400).json({ error: `At most ${MAX_BULK} tickets per bulk request` });
    }
    const companyId = requireCompany(req);
    const isAgent = !!req.agent;
    if (!isAgent && !hasUserPerm(req.user, USER_PERMISSIONS.TICKET_REPLY)) {
      return res.status(403).json({ error: 'You do not have permission to change tickets' });
    }

    const Ticket = require('../models/Ticket');
    const ticketService = require('../services/ticket.service');
    const { canAccessTicket } = require('../controllers/agent.controller');
    const tickets = await Ticket.find({ _id: { $in: ticketIds }, company: companyId })
      .populate('user', 'name email');
    const found = new Set(tickets.map((t) => String(t._id)));
    const skipped = ticketIds
      .filter((id) => !found.has(String(id)))
      .map((id) => ({ id, reason: 'not found in your tenant' }));
    const updated = [];
    const ownerId = !isAgent && req.user ? getOrgOwner(req.user) : null;

    for (const ticket of tickets) {
      const tag = { id: ticket._id, number: ticket.number };
      try {
        if (!isAgent) {
          const ticketOwner = String(ticket.user?._id || ticket.user || '');
          if (!ownerId || ticketOwner !== String(ownerId)) {
            skipped.push({ ...tag, reason: 'not your ticket' });
            continue;
          }
          if (status !== Ticket.STATUSES.CLOSED && status !== Ticket.STATUSES.OPEN) {
            skipped.push({ ...tag, reason: 'customers can only close or reopen' });
            continue;
          }
        } else if (
          ticket.lockedBy &&
          String(ticket.lockedBy) !== String(req.agent._id) &&
          ticket.lockExpiresAt &&
          ticket.lockExpiresAt > new Date()
        ) {
          skipped.push({ ...tag, reason: 'locked by another agent' });
          continue;
        } else if (!(await canAccessTicket(req.agent, ticket))) {
          skipped.push({ ...tag, reason: 'no access to this ticket' });
          continue;
        }
        if (ticket.status === status) {
          skipped.push({ ...tag, reason: 'already in that status' });
          continue;
        }
        await ticketService.applyStatusChange(
          ticket,
          status,
          isAgent
            ? { actorType: 'agent', actorId: req.agent._id, actorName: req.agent.name, reason: reason || 'bulk update' }
            : { actorType: 'user', actorId: req.user._id, actorName: req.user.name, reason: reason || 'bulk update' }
        );
        updated.push(ticket.number);
      } catch (err) {
        skipped.push({ ...tag, reason: err.message });
      }
    }
    res.json({ success: true, modified: updated.length, updated, skipped });
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

router.post('/assign', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, assignedTo } = req.body;
    if (!ticketIds?.length || !assignedTo) {
      return res.status(400).json({ error: 'ticketIds and assignedTo required' });
    }
    if (ticketIds.length > MAX_BULK) {
      return res.status(400).json({ error: `At most ${MAX_BULK} tickets per bulk request` });
    }
    const companyId = requireCompany(req);
    if (!agentCan(req, 'tickets.assign')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const Ticket = require('../models/Ticket');
    const Agent = require('../models/Agent');
    const { notifyAgent } = require('../services/notification.service');
    const { emit } = require('../services/events');
    const ticketService = require('../services/ticket.service');
    const { canAccessTicket } = require('../controllers/agent.controller');
    const assignee = await Agent.findOne({ _id: assignedTo, company: companyId, isActive: true });
    if (!assignee) return res.status(404).json({ error: 'Agent not found in this tenant' });
    const tickets = await Ticket.find({ _id: { $in: ticketIds }, company: companyId });
    const found = new Set(tickets.map((t) => String(t._id)));
    const skipped = ticketIds
      .filter((id) => !found.has(String(id)))
      .map((id) => ({ id, reason: 'not found in your tenant' }));
    const updated = [];
    for (const ticket of tickets) {
      const tag = { id: ticket._id, number: ticket.number };
      try {
        if (!(await canAccessTicket(req.agent, ticket))) {
          skipped.push({ ...tag, reason: 'no access to this ticket' });
          continue;
        }
        ticket.agent = assignee._id;
        ticket.status = Ticket.STATUSES.ASSIGNED;
        ticket.isOverdue = false;
        await ticket.save();
        await ticketService.addSystemEvent({ ticket, message: `Ticket bulk-assigned to ${assignee.name} by ${req.agent.name}` });
        emit('ticket.assigned', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, agentId: assignee._id, teamId: null, actor: req.agent._id });
        await notifyAgent({ agentId: assignee._id, company: ticket.company, type: 'assignment', message: `Ticket ${ticket.number} assigned to you`, link: `/tickets/${ticket.number}`, ticket: ticket._id }).catch(() => {});
        updated.push(ticket.number);
      } catch (err) {
        skipped.push({ ...tag, reason: err.message });
      }
    }
    res.json({ success: true, modified: updated.length, updated, skipped });
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

router.post('/priority', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, priority } = req.body;
    if (!ticketIds?.length || !priority) {
      return res.status(400).json({ error: 'ticketIds and priority required' });
    }
    if (ticketIds.length > MAX_BULK) {
      return res.status(400).json({ error: `At most ${MAX_BULK} tickets per bulk request` });
    }
    const companyId = requireCompany(req);
    if (!agentCan(req, 'tickets.edit')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { isValidPriority } = require('../services/priority.service');
    if (!(await isValidPriority(priority, companyId))) {
      return res.status(422).json({ error: 'Invalid ticket priority' });
    }
    const Ticket = require('../models/Ticket');
    const ticketService = require('../services/ticket.service');
    const tickets = await Ticket.find({ _id: { $in: ticketIds }, company: companyId });
    const found = new Set(tickets.map((t) => String(t._id)));
    const skipped = ticketIds
      .filter((id) => !found.has(String(id)))
      .map((id) => ({ id, reason: 'not found in your tenant' }));
    const updated = [];
    for (const ticket of tickets) {
      try {
        ticket.priority = priority;
        await ticket.save();
        await ticketService.addSystemEvent({ ticket, message: `Priority bulk-changed to ${priority} by ${req.agent.name}` });
        updated.push(ticket.number);
      } catch (err) {
        skipped.push({ id: ticket._id, number: ticket.number, reason: err.message });
      }
    }
    res.json({ success: true, modified: updated.length, updated, skipped });
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

router.post('/tag', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, tags } = req.body;
    if (!ticketIds?.length || !tags?.length) {
      return res.status(400).json({ error: 'ticketIds and tags required' });
    }
    if (ticketIds.length > MAX_BULK) {
      return res.status(400).json({ error: `At most ${MAX_BULK} tickets per bulk request` });
    }
    requireCompany(req);
    if (!agentCan(req, 'tickets.edit')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds }, company: req.companyId },
      { $addToSet: { tags: { $each: tags } } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

// Bulk soft-delete (mirrors the single delete: status tombstone + audit
// trail, never a hard remove).
router.post('/delete', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds } = req.body;
    if (!ticketIds?.length) {
      return res.status(400).json({ error: 'ticketIds required' });
    }
    if (ticketIds.length > MAX_BULK) {
      return res.status(400).json({ error: `At most ${MAX_BULK} tickets per bulk request` });
    }
    const companyId = requireCompany(req);
    const isAgent = !!req.agent;
    if (isAgent && !agentCan(req, 'tickets.delete')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    if (!isAgent && !hasUserPerm(req.user, USER_PERMISSIONS.TICKET_DELETE)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const Ticket = require('../models/Ticket');
    const ticketService = require('../services/ticket.service');
    const tickets = await Ticket.find({ _id: { $in: ticketIds }, company: companyId });
    const found = new Set(tickets.map((t) => String(t._id)));
    const skipped = ticketIds
      .filter((id) => !found.has(String(id)))
      .map((id) => ({ id, reason: 'not found in your tenant' }));
    const updated = [];
    const ownerId = !isAgent && req.user ? getOrgOwner(req.user) : null;
    for (const ticket of tickets) {
      const tag = { id: ticket._id, number: ticket.number };
      try {
        if (!isAgent) {
          const ticketOwner = String(ticket.user?._id || ticket.user || '');
          if (!ownerId || ticketOwner !== String(ownerId)) {
            skipped.push({ ...tag, reason: 'not your ticket' });
            continue;
          }
        }
        ticket.status = Ticket.STATUSES.DELETED;
        ticket.lockedBy = null;
        ticket.lockExpiresAt = null;
        await ticket.save();
        await ticketService.addSystemEvent({ ticket, message: `Ticket bulk-deleted by ${isAgent ? req.agent.name : req.user.name}` });
        updated.push(ticket.number);
      } catch (err) {
        skipped.push({ ...tag, reason: err.message });
      }
    }
    res.json({ success: true, modified: updated.length, updated, skipped });
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }); }
});

module.exports = router;
