const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const router = express.Router();

// Bulk operations
router.post('/bulk/status', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, status } = req.body;
    if (!ticketIds?.length || !status) {
      return res.status(400).json({ error: 'ticketIds and status required' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds }, tenantId: req.user.tenantId },
      { $set: { status } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/assign', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, assignedTo } = req.body;
    if (!ticketIds?.length || !assignedTo) {
      return res.status(400).json({ error: 'ticketIds and assignedTo required' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds }, tenantId: req.user.tenantId },
      { $set: { assignedTo } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/priority', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, priority } = req.body;
    if (!ticketIds?.length || !priority) {
      return res.status(400).json({ error: 'ticketIds and priority required' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds }, tenantId: req.user.tenantId },
      { $set: { priority } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/tag', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds, tags } = req.body;
    if (!ticketIds?.length || !tags?.length) {
      return res.status(400).json({ error: 'ticketIds and tags required' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds }, tenantId: req.user.tenantId },
      { $addToSet: { tags: { $each: tags } } }
    );
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk/delete', protectTenantPrincipal, async (req, res) => {
  try {
    const { ticketIds } = req.body;
    if (!ticketIds?.length) {
      return res.status(400).json({ error: 'ticketIds required' });
    }
    const Ticket = require('../models/Ticket');
    const result = await Ticket.deleteMany(
      { _id: { $in: ticketIds }, tenantId: req.user.tenantId }
    );
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
